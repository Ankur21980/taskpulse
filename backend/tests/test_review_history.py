from unittest.mock import patch

from app.schemas import ExtractedTask

MOCK_TASKS = [
    ExtractedTask(
        title="Ship dashboard layout",
        assignee_hint="Hiren",
        due_date=None,
        priority="medium",
        source_quote="Hiren will ship the dashboard",
    )
]

DEMO_USER_ID = "00000000-0000-0000-0000-000000000010"


@patch("app.routers.sources.extract_tasks_from_text", return_value=MOCK_TASKS)
def test_list_sources_after_upload(mock_extract, client):
    client.post(
        "/api/sources/upload",
        data={"text": "Hiren will ship the dashboard by Friday."},
    )
    response = client.get("/api/sources")
    assert response.status_code == 200
    sources = response.json()
    assert len(sources) >= 1
    assert sources[0]["review_status"] == "draft"
    assert sources[0]["task_count"] >= 1


@patch("app.routers.sources.extract_tasks_from_text", return_value=MOCK_TASKS)
def test_patch_review_status_completed(mock_extract, client):
    upload = client.post(
        "/api/sources/upload",
        data={"text": "Hiren will ship the dashboard."},
    )
    source_id = upload.json()["source_id"]
    response = client.patch(
        f"/api/sources/{source_id}/review-status",
        json={"review_status": "completed"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["review_status"] == "completed"
    assert body["completed_at"] is not None


@patch("app.routers.sources.extract_tasks_from_text", return_value=MOCK_TASKS)
def test_create_task_on_source(mock_extract, client):
    upload = client.post(
        "/api/sources/upload",
        data={"text": "Hiren will ship the dashboard."},
    )
    source_id = upload.json()["source_id"]
    response = client.post(
        f"/api/sources/{source_id}/tasks",
        json={"title": "Manual follow-up task", "priority": "medium"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["title"] == "Manual follow-up task"
    assert body["status"] == "draft"


@patch("app.routers.sources.extract_tasks_from_text", return_value=MOCK_TASKS)
def test_auto_complete_when_all_assigned(mock_extract, client):
    upload = client.post(
        "/api/sources/upload",
        data={"text": "Hiren will ship the dashboard."},
    )
    source_id = upload.json()["source_id"]
    task_id = upload.json()["tasks"][0]["id"]

    assign = client.post(
        f"/api/tasks/{task_id}/assign",
        json={"assignee_id": DEMO_USER_ID},
    )
    assert assign.status_code == 200

    sources = client.get("/api/sources").json()
    match = next(s for s in sources if s["id"] == source_id)
    assert match["review_status"] == "completed"
