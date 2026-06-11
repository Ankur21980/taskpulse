from typing import List, Optional, Tuple

from app.schemas import ExtractedTask


def _match_by_hint(hint: str, members: List[dict]) -> Optional[dict]:
    if not hint:
        return None
    lower = hint.lower()
    for member in members:
        name = member["name"].lower()
        if lower in name or name in lower:
            return member
    return None


def _role_fallback(task: ExtractedTask, eligible: List[dict]) -> Optional[dict]:
    if not eligible:
        return None
    text = f"{task.title} {task.source_quote or ''}".lower()
    if any(k in text for k in ("api", "backend", "auth", "database", "endpoint")):
        return next((m for m in eligible if "backend" in m.get("role", "").lower()), None)
    if any(k in text for k in ("ui", "frontend", "page", "component", "layout", "screen")):
        fe = [m for m in eligible if "frontend" in m.get("role", "").lower()]
        fe.sort(key=lambda m: m.get("experience_years") or 0, reverse=True)
        return fe[0] if fe else None
    if any(k in text for k in ("test", "unit", "documentation", "doc")):
        return next((m for m in eligible if m.get("role") == "Intern"), None)
    return eligible[0]


def resolve_task_assignee(
    task: ExtractedTask,
    all_members: List[dict],
    eligible_ids: List[str],
) -> Tuple[Optional[str], Optional[str]]:
    eligible = [m for m in all_members if str(m["_id"]) in eligible_ids]
    eligible_ids_set = set(eligible_ids)

    matched = _match_by_hint(task.assignee_hint or "", all_members)
    if matched:
        return str(matched["_id"]), matched["name"]

    fallback = _role_fallback(task, eligible)
    if fallback:
        return str(fallback["_id"]), fallback["name"]

    if task.assignee_hint:
        invalid_match = _match_by_hint(task.assignee_hint, eligible)
        if invalid_match and str(invalid_match["_id"]) in eligible_ids_set:
            return str(invalid_match["_id"]), invalid_match["name"]

    return None, task.assignee_hint
