from unittest.mock import MagicMock, patch

from app.services.extractor import EXTRACTION_PROMPT, parse_extraction_response

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


@patch("app.services.extractor.genai.GenerativeModel")
def test_extract_tasks_from_text(mock_model_cls):
    mock_model = MagicMock()
    mock_model_cls.return_value = mock_model
    mock_model.generate_content.return_value = MagicMock(text=SAMPLE_JSON)

    from app.services.extractor import extract_tasks_from_text

    tasks = extract_tasks_from_text("Meeting notes here")
    assert len(tasks) == 1
    mock_model.generate_content.assert_called_once()
    call_args = mock_model.generate_content.call_args[0][0]
    assert "Meeting notes here" in call_args
    assert EXTRACTION_PROMPT in call_args
