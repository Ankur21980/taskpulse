from unittest.mock import MagicMock, patch

import httpx

from app.services.extractor import extract_tasks_from_text, parse_extraction_response

SAMPLE_JSON = """[
  {
    "title": "Review Q3 budget proposal",
    "assignee_hint": "Priya",
    "due_date": null,
    "priority": "high",
    "source_quote": "Priya will review the Q3 budget"
  }
]"""


def test_parse_extraction_response():
    tasks = parse_extraction_response(SAMPLE_JSON)
    assert len(tasks) == 1
    assert tasks[0].title == "Review Q3 budget proposal"
    assert tasks[0].priority == "high"


@patch("app.services.extractor.httpx.Client")
def test_extract_tasks_from_text(mock_client_cls):
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "candidates": [{"content": {"parts": [{"text": SAMPLE_JSON}]}}]
    }

    mock_client = MagicMock()
    mock_client.__enter__.return_value = mock_client
    mock_client.post.return_value = mock_response
    mock_client_cls.return_value = mock_client

    tasks = extract_tasks_from_text("Meeting notes here")
    assert len(tasks) == 1
    mock_client.post.assert_called_once()
    call_kwargs = mock_client.post.call_args.kwargs
    prompt_text = call_kwargs["json"]["contents"][0]["parts"][0]["text"]
    assert "3-week engineering sprint" in prompt_text
    assert "Eligible team for UNNAMED" in prompt_text
    assert "Meeting notes here" in prompt_text


@patch("app.services.extractor.httpx.Client")
def test_extract_tasks_invalid_key_message(mock_client_cls):
    mock_response = MagicMock()
    mock_response.status_code = 400
    mock_response.json.return_value = {
        "error": {"code": 400, "message": "API key not valid. Please pass a valid API key."}
    }
    mock_response.text = "bad key"

    mock_client = MagicMock()
    mock_client.__enter__.return_value = mock_client
    mock_client.post.return_value = mock_response
    mock_client_cls.return_value = mock_client

    try:
        extract_tasks_from_text("notes")
        assert False, "expected ValueError"
    except ValueError as exc:
        assert "restart uvicorn" in str(exc)


PRD_SAMPLE_JSON = """[
  {
    "title": "Implement user authentication",
    "assignee_hint": "Prerana",
    "due_date": null,
    "priority": "high",
    "source_quote": "Owner: Prerana Shukla",
    "feature_area": "Authentication",
    "task_type": "requirement"
  }
]"""


@patch("app.services.extractor._gemini_request")
def test_extract_tasks_from_prd(mock_gemini):
    mock_gemini.return_value = PRD_SAMPLE_JSON
    from app.services.extractor import extract_tasks_from_prd

    team = [
        "Prerana Shukla (Backend Engineer, 3.0 yrs)",
        "Hiren Chafekar (FrontEnd Engineer, 4.0 yrs)",
    ]
    all_team = team + ["Anisha Kumari (FrontEnd Engineer, 1.0 yrs)"]
    tasks = extract_tasks_from_prd("PRD content here", team, all_team)
    assert len(tasks) == 1
    assert tasks[0].feature_area == "Authentication"
    assert tasks[0].task_type == "requirement"
    call_prompt = mock_gemini.call_args[0][0]
    assert "3-week engineering sprint" in call_prompt
    assert "Eligible team for UNNAMED" in call_prompt
    assert "Prerana Shukla" in call_prompt
