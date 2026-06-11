from app.schemas import ExtractedTask
from app.services.assignment_resolver import resolve_task_assignee

MEMBERS = [
    {"_id": "u1", "name": "Hiren Chafekar", "role": "FrontEnd Engineer", "experience_years": 4},
    {"_id": "u2", "name": "Prerana Shukla", "role": "Backend Engineer", "experience_years": 3},
    {"_id": "u3", "name": "Anisha Kumari", "role": "FrontEnd Engineer", "experience_years": 1},
    {"_id": "u4", "name": "Gowtham L", "role": "Intern", "experience_years": 0.5},
]


def test_named_owner_matched_even_if_not_eligible():
    task = ExtractedTask(title="Ship API", assignee_hint="Prerana", priority="high")
    assignee_id, hint = resolve_task_assignee(task, MEMBERS, eligible_ids=["u1", "u3"])
    assert assignee_id == "u2"
    assert "Prerana" in hint


def test_unnamed_ui_task_uses_eligible_frontend():
    task = ExtractedTask(title="Build login UI page", assignee_hint=None, priority="medium")
    assignee_id, _ = resolve_task_assignee(task, MEMBERS, eligible_ids=["u1", "u3"])
    assert assignee_id == "u1"


def test_unnamed_backend_task_uses_eligible_backend():
    task = ExtractedTask(title="Implement auth API endpoint", assignee_hint=None, priority="high")
    assignee_id, _ = resolve_task_assignee(task, MEMBERS, eligible_ids=["u2", "u4"])
    assert assignee_id == "u2"


def test_hint_in_eligible_list():
    task = ExtractedTask(title="Write tests", assignee_hint="Gowtham", priority="low")
    assignee_id, _ = resolve_task_assignee(task, MEMBERS, eligible_ids=["u4"])
    assert assignee_id == "u4"
