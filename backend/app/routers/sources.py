import os
import uuid
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import SourceDocument, SourceType, Task, TaskPriority, TaskStatus
from app.schemas import TaskOut, UploadResponse
from app.services.extractor import extract_tasks_from_text
from app.services.ocr import extract_text_from_image
from app.services.text_parser import normalize_pasted_text, parse_transcript_file

router = APIRouter(prefix="/api/sources", tags=["sources"])


def _priority_enum(value: str) -> TaskPriority:
    return TaskPriority(value)


@router.post("/upload", response_model=UploadResponse)
async def upload_source(
    db: Session = Depends(get_db),
    file: Optional[UploadFile] = File(None),
    text: Optional[str] = Form(None),
):
    if not file and not text:
        raise HTTPException(400, "Provide either a file or pasted text")

    source_id = str(uuid.uuid4())
    extracted_text = ""
    source_type = SourceType.PASTED_TEXT
    filename = None
    storage_path = None

    if text:
        extracted_text = normalize_pasted_text(text)
        source_type = SourceType.PASTED_TEXT
    elif file:
        filename = file.filename or "upload.txt"
        content_bytes = await file.read()
        source_type = (
            SourceType.SCREENSHOT
            if filename.lower().endswith((".png", ".jpg", ".jpeg"))
            else SourceType.TRANSCRIPT
        )
        os.makedirs(settings.upload_dir, exist_ok=True)
        storage_path = os.path.join(settings.upload_dir, f"{source_id}_{filename}")
        with open(storage_path, "wb") as f:
            f.write(content_bytes)

        if filename.lower().endswith((".png", ".jpg", ".jpeg")):
            extracted_text = extract_text_from_image(storage_path)
        else:
            content = content_bytes.decode("utf-8", errors="replace")
            extracted_text = parse_transcript_file(content, filename)

    if len(extracted_text.strip()) < 10:
        raise HTTPException(400, "Not enough text to extract tasks")

    source = SourceDocument(
        id=source_id,
        type=source_type,
        original_filename=filename,
        storage_path=storage_path,
        extracted_text=extracted_text,
    )
    db.add(source)
    db.flush()

    extracted = extract_tasks_from_text(extracted_text)
    tasks_out: List[Task] = []

    for item in extracted:
        due = None
        if item.due_date:
            try:
                due = datetime.fromisoformat(item.due_date.replace("Z", "+00:00"))
            except ValueError:
                due = None

        task = Task(
            title=item.title[:200],
            assignee_hint=item.assignee_hint,
            priority=_priority_enum(item.priority),
            due_date=due,
            source_ref_id=source_id,
            source_quote=item.source_quote,
            status=TaskStatus.DRAFT,
        )
        db.add(task)
        tasks_out.append(task)

    db.commit()
    for t in tasks_out:
        db.refresh(t)

    return UploadResponse(
        source_id=source_id,
        task_count=len(tasks_out),
        tasks=[TaskOut.model_validate(t) for t in tasks_out],
    )


@router.get("/{source_id}/tasks", response_model=List[TaskOut])
def get_source_tasks(source_id: str, db: Session = Depends(get_db)):
    tasks = db.query(Task).filter(Task.source_ref_id == source_id).all()
    if not tasks:
        raise HTTPException(404, "No tasks found for source")
    return [TaskOut.model_validate(t) for t in tasks]
