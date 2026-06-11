import json
import os
import uuid
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pymongo.database import Database

from app.config import settings
from app.database import get_db
from app.enums import SourceType
from app.mappers import new_source_doc, new_task_doc, source_doc_to_summary, task_doc_to_out
from app.repositories.sources import (
    create_source,
    find_source_by_id,
    list_sources,
    update_source_review_status,
)
from app.repositories.tasks import count_tasks_by_source, create_task, list_tasks_by_source
from app.repositories.users import list_users_by_team
from app.schemas import (
    ReviewStatusUpdate,
    SourceSummaryOut,
    TaskCreate,
    TaskOut,
    UploadResponse,
)
from app.seed import DEMO_TEAM_ID
from app.services.assignment_resolver import resolve_task_assignee
from app.services.extractor import extract_tasks_from_prd, extract_tasks_from_text
from app.services.ocr import extract_text_from_image
from app.services.prd_parser import parse_prd_file, truncate_prd_text
from app.services.text_parser import normalize_pasted_text, parse_transcript_file

router = APIRouter(prefix="/api/sources", tags=["sources"])


def _format_team_for_prompt(members: list, ids: Optional[List[str]] = None) -> List[str]:
    formatted = []
    for m in members:
        if ids is not None and str(m["_id"]) not in ids:
            continue
        role = m.get("role", "Engineer")
        exp = m.get("experience_years")
        exp_label = f"{exp} yrs" if exp is not None else "unknown exp"
        formatted.append(f"{m['name']} ({role}, {exp_label})")
    return formatted


def _is_prd_file(filename: str) -> bool:
    lower = filename.lower()
    return lower.endswith((".pdf", ".docx", ".doc"))


def _source_summary(db: Database, source: dict) -> SourceSummaryOut:
    source_id = str(source["_id"])
    return source_doc_to_summary(source, count_tasks_by_source(db, source_id))


@router.post("/upload", response_model=UploadResponse)
async def upload_source(
    db: Database = Depends(get_db),
    file: Optional[UploadFile] = File(None),
    text: Optional[str] = Form(None),
    eligible_member_ids: Optional[str] = Form(None),
):
    if not file and not text:
        raise HTTPException(400, "Provide either a file or pasted text")

    members = list_users_by_team(db, DEMO_TEAM_ID)
    if eligible_member_ids:
        try:
            eligible_ids = json.loads(eligible_member_ids)
        except json.JSONDecodeError as exc:
            raise HTTPException(400, "Invalid eligible_member_ids JSON") from exc
    else:
        eligible_ids = [str(m["_id"]) for m in members]

    if not eligible_ids:
        raise HTTPException(400, "Select at least one team member")

    valid_ids = {str(m["_id"]) for m in members}
    if not set(eligible_ids).issubset(valid_ids):
        raise HTTPException(400, "Invalid team member ID")

    source_id = str(uuid.uuid4())
    extracted_text = ""
    source_type = SourceType.PASTED_TEXT.value
    filename = None
    storage_path = None
    truncated = False

    if text:
        extracted_text = normalize_pasted_text(text)
        source_type = SourceType.PASTED_TEXT.value
    elif file:
        filename = file.filename or "upload.txt"
        content_bytes = await file.read()

        if _is_prd_file(filename):
            if filename.lower().endswith(".doc"):
                raise HTTPException(400, "Legacy .doc not supported. Save as .docx or PDF.")
            source_type = SourceType.PRD.value
            try:
                extracted_text = parse_prd_file(content_bytes, filename)
            except ValueError as exc:
                raise HTTPException(400, str(exc)) from exc
        else:
            source_type = (
                SourceType.SCREENSHOT.value
                if filename.lower().endswith((".png", ".jpg", ".jpeg"))
                else SourceType.TRANSCRIPT.value
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

    if source_type == SourceType.PRD.value:
        extracted_text, truncated = truncate_prd_text(extracted_text)

    if len(extracted_text.strip()) < 10:
        raise HTTPException(400, "Not enough text to extract tasks")

    if source_type == SourceType.PRD.value:
        os.makedirs(settings.upload_dir, exist_ok=True)
        storage_path = os.path.join(settings.upload_dir, f"{source_id}_{filename}")
        with open(storage_path, "wb") as f:
            f.write(content_bytes)

    create_source(db, new_source_doc(
        source_id,
        source_type,
        extracted_text,
        filename,
        storage_path,
        eligible_assignee_ids=eligible_ids,
    ))

    try:
        eligible_prompt = _format_team_for_prompt(members, eligible_ids)
        all_prompt = _format_team_for_prompt(members)
        if source_type == SourceType.PRD.value:
            extracted = extract_tasks_from_prd(extracted_text, eligible_prompt, all_prompt)
        else:
            extracted = extract_tasks_from_text(extracted_text, eligible_prompt, all_prompt)
    except Exception as exc:
        raise HTTPException(502, detail=f"Gemini task extraction failed: {exc}") from exc

    task_docs = []
    for item in extracted:
        due = None
        if item.due_date:
            try:
                due = datetime.fromisoformat(item.due_date.replace("Z", "+00:00"))
            except ValueError:
                due = None

        assignee_id, assignee_hint = resolve_task_assignee(item, members, eligible_ids)
        doc = new_task_doc(
            task_id=str(uuid.uuid4()),
            title=item.title[:200],
            source_ref_id=source_id,
            assignee_hint=assignee_hint or item.assignee_hint,
            priority=item.priority,
            due_date=due,
            source_quote=item.source_quote,
            feature_area=item.feature_area,
            task_type=item.task_type,
        )
        if assignee_id:
            doc["assignee_id"] = assignee_id
        create_task(db, doc)
        task_docs.append(doc)

    return UploadResponse(
        source_id=source_id,
        task_count=len(task_docs),
        tasks=[task_doc_to_out(t) for t in task_docs],
        truncated=truncated,
    )


@router.get("", response_model=List[SourceSummaryOut])
def list_all_sources(db: Database = Depends(get_db)):
    sources = list_sources(db)
    return [_source_summary(db, s) for s in sources]


@router.get("/{source_id}/tasks", response_model=List[TaskOut])
def get_source_tasks(source_id: str, db: Database = Depends(get_db)):
    tasks = list_tasks_by_source(db, source_id)
    if not tasks:
        raise HTTPException(404, "No tasks found for source")
    return [task_doc_to_out(t) for t in tasks]


@router.get("/{source_id}", response_model=SourceSummaryOut)
def get_source(source_id: str, db: Database = Depends(get_db)):
    source = find_source_by_id(db, source_id)
    if not source:
        raise HTTPException(404, "Source not found")
    return _source_summary(db, source)


@router.patch("/{source_id}/review-status", response_model=SourceSummaryOut)
def patch_review_status(
    source_id: str, payload: ReviewStatusUpdate, db: Database = Depends(get_db)
):
    if not find_source_by_id(db, source_id):
        raise HTTPException(404, "Source not found")
    updated = update_source_review_status(db, source_id, payload.review_status)
    return _source_summary(db, updated)


@router.post("/{source_id}/tasks", response_model=TaskOut)
def create_task_on_source(
    source_id: str, payload: TaskCreate, db: Database = Depends(get_db)
):
    if not find_source_by_id(db, source_id):
        raise HTTPException(404, "Source not found")

    status = "assigned" if payload.assignee_id else "draft"
    doc = new_task_doc(
        task_id=str(uuid.uuid4()),
        title=payload.title,
        source_ref_id=source_id,
        assignee_hint=payload.assignee_hint,
        priority=payload.priority,
        feature_area=payload.feature_area,
        task_type=payload.task_type,
    )
    doc["status"] = status
    if payload.assignee_id:
        doc["assignee_id"] = payload.assignee_id
    create_task(db, doc)
    return task_doc_to_out(doc)
