from unittest.mock import patch

from app.schemas import ExtractedTask

MOCK_TASKS = [
    ExtractedTask(
        title="Send client update",
        assignee_hint="Rahul",
        due_date=None,
        priority="medium",
        source_quote="Rahul will send the client update",
    )
]


@patch("app.routers.sources.extract_tasks_from_text", return_value=MOCK_TASKS)
def test_upload_pasted_text(mock_extract, client):
    response = client.post(
        "/api/sources/upload",
        data={"text": "Rahul will send the client update by EOD."},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["task_count"] == 1
    assert body["tasks"][0]["title"] == "Send client update"


def test_list_team_members(client):
    response = client.get("/api/teams/demo/members")
    assert response.status_code == 200
    members = response.json()
    assert len(members) >= 4
    assert any(m["name"] == "Priya Sharma" for m in members)
