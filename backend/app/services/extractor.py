import json
import re
from typing import List

import google.generativeai as genai

from app.config import settings
from app.schemas import ExtractedTask

EXTRACTION_PROMPT = """You are a task extraction assistant. From the following meeting transcript or chat, extract every action item. For each task return a JSON object with: title (max 10 words, imperative verb), assignee_hint (name mentioned as responsible, or null), due_date (any date mentioned, ISO 8601 or null), priority (high/medium/low inferred from urgency language), source_quote (the exact sentence that generated this task, max 20 words). Return only a JSON array. No preamble, no markdown.

TEXT:
"""


def _configure_gemini() -> None:
    genai.configure(api_key=settings.gemini_api_key)


def parse_extraction_response(raw: str) -> List[ExtractedTask]:
    cleaned = raw.strip()
    cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
    cleaned = re.sub(r"\s*```$", "", cleaned)
    data = json.loads(cleaned)
    return [ExtractedTask.model_validate(item) for item in data]


def extract_tasks_from_text(text: str) -> List[ExtractedTask]:
    _configure_gemini()
    model = genai.GenerativeModel(
        settings.gemini_model,
        generation_config={"response_mime_type": "application/json"},
    )
    prompt = f"{EXTRACTION_PROMPT}{text}"
    response = model.generate_content(prompt)
    try:
        return parse_extraction_response(response.text)
    except (json.JSONDecodeError, ValueError):
        response = model.generate_content(
            prompt + "\n\nReturn ONLY valid JSON array. No markdown."
        )
        return parse_extraction_response(response.text)
