import re


def normalize_pasted_text(text: str) -> str:
    return " ".join(text.split())


def _strip_vtt(content: str) -> str:
    lines = []
    for line in content.splitlines():
        line = line.strip()
        if not line or line == "WEBVTT":
            continue
        if re.match(r"\d{2}:\d{2}:\d{2}", line):
            continue
        if "-->" in line:
            continue
        if line.isdigit():
            continue
        lines.append(line)
    return "\n".join(lines)


def _strip_srt(content: str) -> str:
    lines = []
    for line in content.splitlines():
        line = line.strip()
        if not line:
            continue
        if line.isdigit():
            continue
        if re.match(r"\d{2}:\d{2}:\d{2}", line) and "-->" in line:
            continue
        lines.append(line)
    return "\n".join(lines)


def parse_transcript_file(content: str, filename: str) -> str:
    lower = filename.lower()
    if lower.endswith(".vtt"):
        return _strip_vtt(content)
    if lower.endswith(".srt"):
        return _strip_srt(content)
    return content
