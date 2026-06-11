from app.services.text_parser import normalize_pasted_text, parse_transcript_file


def test_normalize_pasted_text_collapses_whitespace():
    assert normalize_pasted_text("hello   world\n\nfoo") == "hello world foo"


def test_parse_vtt_strips_cues():
    content = """WEBVTT

00:00:01.000 --> 00:00:04.000
Rahul: We need to ship the dashboard by Friday.
"""
    result = parse_transcript_file(content, "meeting.vtt")
    assert "Rahul" in result
    assert "-->" not in result
