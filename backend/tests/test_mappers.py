from datetime import datetime

from app.mappers import task_doc_to_out, user_doc_to_out


def test_user_doc_to_out():
    doc = {
        "_id": "u1",
        "name": "Prerana Shukla",
        "email": "prerana@taskpulse.io",
        "team_id": "t1",
        "role": "Backend Engineer",
        "experience_years": 3.0,
    }
    out = user_doc_to_out(doc)
    assert out.id == "u1"
    assert out.name == "Prerana Shukla"
    assert out.role == "Backend Engineer"


def test_task_doc_to_out():
    now = datetime.utcnow()
    doc = {
        "_id": "task1",
        "title": "Send update",
        "assignee_id": None,
        "assignee_hint": "Rahul",
        "status": "draft",
        "priority": "medium",
        "due_date": None,
        "source_ref_id": "src1",
        "source_quote": "Rahul will send",
        "created_at": now,
        "updated_at": now,
    }
    out = task_doc_to_out(doc)
    assert out.id == "task1"
    assert out.status == "draft"
