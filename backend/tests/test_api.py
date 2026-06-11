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


@patch("app.routers.sources.extract_tasks_from_text", return_value=MOCK_TASKS)
def test_upload_with_eligible_members(mock_extract, client):
    eligible = '["00000000-0000-0000-0000-000000000010"]'
    response = client.post(
        "/api/sources/upload",
        data={
            "text": "Hiren will send the client update by EOD.",
            "eligible_member_ids": eligible,
        },
    )
    assert response.status_code == 200
    mock_extract.assert_called_once()
    call_kwargs = mock_extract.call_args
    eligible_names = call_kwargs[0][1]
    assert len(eligible_names) == 1


def test_upload_rejects_empty_eligible_members(client):
    response = client.post(
        "/api/sources/upload",
        data={
            "text": "Hiren will send the client update by EOD.",
            "eligible_member_ids": "[]",
        },
    )
    assert response.status_code == 400


def test_list_team_members(client):
    response = client.get("/api/teams/demo/members")
    assert response.status_code == 200
    members = response.json()
    assert len(members) >= 4
    assert any(m["name"] == "Prerana Shukla" for m in members)
    assert any(m["role"] == "Backend Engineer" for m in members)


@patch("app.routers.sources.extract_tasks_from_prd")
@patch("app.routers.sources.parse_prd_file", return_value="Feature: Auth. Owner: Prerana.")
def test_upload_prd_pdf(mock_parse, mock_extract, client):
    mock_extract.return_value = [
        ExtractedTask(
            title="Implement authentication",
            assignee_hint="Prerana",
            feature_area="Authentication",
            task_type="requirement",
            priority="high",
            source_quote="Owner: Prerana",
        )
    ]
    response = client.post(
        "/api/sources/upload",
        files={"file": ("spec.pdf", b"%PDF-1.4 fake", "application/pdf")},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["tasks"][0]["feature_area"] == "Authentication"
    assert body["tasks"][0]["task_type"] == "requirement"
