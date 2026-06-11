import json
import re
import time
from typing import List, Optional

import httpx

from app.config import settings
from app.schemas import ExtractedTask

EXTRACTION_PROMPT = """You are a task extraction assistant for a 3-week engineering sprint. From the following meeting transcript or chat, extract every action item that can realistically be completed within the sprint (21 days from today).

Full team for NAMED owner matching (if document names someone, use their full name):
{all_members}

Eligible team for UNNAMED tasks only (assign by role fit — pick from this list only):
{eligible_members}

Rules:
- Scope tasks to what one person can finish within the sprint; split large epics into sprint-sized chunks.
- Set due_date within the next 21 days when timing is implied or inferable (ISO 8601); otherwise null.
- If the document names an owner, set assignee_hint to their full name (match against full team).
- If no owner is named, set assignee_hint to the best-fit person from the ELIGIBLE list only (frontend/UI → FrontEnd Engineer, API/backend → Backend Engineer, tests/docs → Intern).
- Never assign unnamed tasks to people outside the eligible list.

For each task return a JSON object with: title (max 10 words, imperative verb), assignee_hint (full name or null), due_date (ISO 8601 or null), priority (high/medium/low inferred from urgency language), source_quote (the exact sentence that generated this task, max 20 words). Return only a JSON array. No preamble, no markdown.

TEXT:
"""

PRD_EXTRACTION_PROMPT = """You are a PRD task extraction assistant for a 3-week engineering sprint. From this Product Requirements Document, extract actionable tasks that can be completed within one sprint (21 days).

Full team for NAMED owner matching (if PRD names an owner/DRI, use their full name):
{all_members}

Eligible team for UNNAMED tasks only (assign by role fit — pick from this list only):
{eligible_members}

Rules:
- Break large features into sprint-sized tasks (roughly 1–5 days each).
- If the PRD names an owner/DRI, set assignee_hint to their full name (match against full team).
- If no owner is named, set assignee_hint to the best-fit person from the ELIGIBLE list only.
- Never assign unnamed tasks to people outside the eligible list.
- Set due_date within the next 21 days when milestones or timelines are stated (ISO 8601).

For each task return a JSON object with: title (max 10 words, imperative verb), assignee_hint (full name or null), due_date (ISO 8601 or null), priority (high/medium/low), source_quote (originating sentence, max 20 words), feature_area (module/epic/section e.g. "Auth", "Payments"), task_type (one of: requirement | milestone | deliverable).

Return only a JSON array. No preamble, no markdown.

PRD TEXT:
"""

GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta"


def parse_extraction_response(raw: str) -> List[ExtractedTask]:
    cleaned = raw.strip()
    cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
    cleaned = re.sub(r"\s*```$", "", cleaned)
    data = json.loads(cleaned)
    return [ExtractedTask.model_validate(item) for item in data]


def _gemini_timeout() -> httpx.Timeout:
    read = settings.gemini_timeout_seconds
    return httpx.Timeout(connect=15.0, read=read, write=30.0, pool=15.0)


def _gemini_request(prompt: str, json_mode: bool = True) -> str:
    if not settings.gemini_api_key or settings.gemini_api_key == "your_key_here":
        raise ValueError(
            "GEMINI_API_KEY is missing or still set to the placeholder. "
            "Update backend/.env and restart the server."
        )

    url = f"{GEMINI_API_BASE}/models/{settings.gemini_model}:generateContent"
    body: dict = {"contents": [{"parts": [{"text": prompt}]}]}
    if json_mode:
        body["generationConfig"] = {"responseMimeType": "application/json"}

    timeout = _gemini_timeout()
    response = None
    last_timeout: Optional[Exception] = None

    with httpx.Client(timeout=timeout) as client:
        for attempt in range(3):
            try:
                response = client.post(
                    url,
                    headers={"x-goog-api-key": settings.gemini_api_key},
                    json=body,
                )
            except (httpx.ReadTimeout, httpx.ConnectTimeout, httpx.TimeoutException) as exc:
                last_timeout = exc
                if attempt < 2:
                    time.sleep(2 ** attempt)
                    continue
                raise ValueError(
                    f"Gemini request timed out after {settings.gemini_timeout_seconds:.0f}s "
                    f"(3 attempts). Try a shorter document, set GEMINI_TIMEOUT_SECONDS=180 "
                    f"in backend/.env, or use GEMINI_MODEL=gemini-2.5-flash. "
                    f"Restart uvicorn after changing .env."
                ) from exc

            if response.status_code in (200, 400, 401, 403):
                break
            if response.status_code in (429, 503) and attempt < 2:
                time.sleep(2 ** attempt)
                continue
            break

    if response is None:
        if last_timeout:
            raise ValueError(
                f"Gemini request timed out after {settings.gemini_timeout_seconds:.0f}s."
            ) from last_timeout
        raise ValueError("Gemini request failed with no response")

    if response.status_code != 200:
        _raise_gemini_error(response)

    data = response.json()
    candidates = data.get("candidates") or []
    if not candidates:
        raise ValueError("Gemini returned no candidates")
    parts = candidates[0].get("content", {}).get("parts") or []
    if not parts:
        raise ValueError("Gemini returned empty content")
    return parts[0].get("text", "")


def _raise_gemini_error(response: httpx.Response) -> None:
    try:
        err = response.json().get("error", {})
        message = err.get("message", response.text)
        code = err.get("code", response.status_code)
    except json.JSONDecodeError:
        message = response.text
        code = response.status_code

    if code == 400 and "API key not valid" in message:
        raise ValueError(
            "Gemini rejected the API key. If you just updated backend/.env, "
            "restart uvicorn (env changes are not picked up by --reload). "
            "Also confirm the key is from https://aistudio.google.com/apikey"
        ) from None
    if code == 429:
        raise ValueError(
            f"Gemini quota exceeded for model '{settings.gemini_model}'. "
            "Try GEMINI_MODEL=gemini-2.5-flash in backend/.env, or check billing at "
            "https://ai.dev/rate-limit"
        ) from None

    raise ValueError(f"Gemini API error ({code}): {message}")


def _build_prompt(
    template: str,
    text: str,
    eligible_member_names: Optional[List[str]],
    all_member_names: Optional[List[str]],
) -> str:
    eligible = ", ".join(eligible_member_names) if eligible_member_names else "unknown"
    all_team = ", ".join(all_member_names) if all_member_names else eligible
    return template.format(eligible_members=eligible, all_members=all_team) + text


def extract_tasks_from_text(
    text: str,
    eligible_member_names: Optional[List[str]] = None,
    all_member_names: Optional[List[str]] = None,
) -> List[ExtractedTask]:
    prompt = _build_prompt(EXTRACTION_PROMPT, text, eligible_member_names, all_member_names)
    try:
        raw = _gemini_request(prompt, json_mode=True)
        return parse_extraction_response(raw)
    except (json.JSONDecodeError, ValueError) as first_error:
        if isinstance(first_error, ValueError) and "Gemini" in str(first_error):
            raise
        raw = _gemini_request(
            prompt + "\n\nReturn ONLY valid JSON array. No markdown.",
            json_mode=False,
        )
        return parse_extraction_response(raw)


def extract_tasks_from_prd(
    text: str,
    eligible_member_names: List[str],
    all_member_names: Optional[List[str]] = None,
) -> List[ExtractedTask]:
    prompt = _build_prompt(PRD_EXTRACTION_PROMPT, text, eligible_member_names, all_member_names)
    try:
        raw = _gemini_request(prompt, json_mode=True)
        return parse_extraction_response(raw)
    except (json.JSONDecodeError, ValueError) as first_error:
        if isinstance(first_error, ValueError) and "Gemini" in str(first_error):
            raise
        raw = _gemini_request(
            prompt + "\n\nReturn ONLY valid JSON array. No markdown.",
            json_mode=False,
        )
        return parse_extraction_response(raw)
