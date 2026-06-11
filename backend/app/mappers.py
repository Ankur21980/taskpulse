from datetime import datetime
from typing import Any, Dict, List, Optional

from app.schemas import SourceSummaryOut, TaskOut, UserOut


def user_doc_to_out(doc: Dict[str, Any]) -> UserOut:
    return UserOut(
        id=str(doc["_id"]),
        name=doc["name"],
        email=doc["email"],
        role=doc.get("role"),
        experience_years=doc.get("experience_years"),
    )


def task_doc_to_out(doc: Dict[str, Any]) -> TaskOut:
    return TaskOut(
        id=str(doc["_id"]),
        title=doc["title"],
        assignee_id=doc.get("assignee_id"),
        assignee_hint=doc.get("assignee_hint"),
        status=doc["status"],
        priority=doc["priority"],
        due_date=doc.get("due_date"),
        source_ref_id=doc["source_ref_id"],
        source_quote=doc.get("source_quote"),
        feature_area=doc.get("feature_area"),
        task_type=doc.get("task_type"),
        created_at=doc["created_at"],
        updated_at=doc["updated_at"],
    )


def new_task_doc(
    task_id: str,
    title: str,
    source_ref_id: str,
    assignee_hint: Optional[str] = None,
    priority: str = "medium",
    due_date: Optional[datetime] = None,
    source_quote: Optional[str] = None,
    feature_area: Optional[str] = None,
    task_type: Optional[str] = None,
) -> Dict[str, Any]:
    now = datetime.utcnow()
    return {
        "_id": task_id,
        "title": title,
        "assignee_id": None,
        "assignee_hint": assignee_hint,
        "status": "draft",
        "priority": priority,
        "due_date": due_date,
        "source_ref_id": source_ref_id,
        "source_quote": source_quote,
        "feature_area": feature_area,
        "task_type": task_type,
        "created_at": now,
        "updated_at": now,
    }


def new_source_doc(
    source_id: str,
    source_type: str,
    extracted_text: str,
    original_filename: Optional[str] = None,
    storage_path: Optional[str] = None,
    eligible_assignee_ids: Optional[List[str]] = None,
) -> Dict[str, Any]:
    return {
        "_id": source_id,
        "type": source_type,
        "original_filename": original_filename,
        "storage_path": storage_path,
        "extracted_text": extracted_text,
        "uploaded_by": None,
        "created_at": datetime.utcnow(),
        "review_status": "draft",
        "completed_at": None,
        "eligible_assignee_ids": eligible_assignee_ids or [],
    }


def source_doc_to_summary(doc: Dict[str, Any], task_stats: Dict[str, int]) -> SourceSummaryOut:
    return SourceSummaryOut(
        id=str(doc["_id"]),
        type=doc["type"],
        original_filename=doc.get("original_filename"),
        created_at=doc["created_at"],
        review_status=doc.get("review_status", "draft"),
        completed_at=doc.get("completed_at"),
        eligible_assignee_ids=doc.get("eligible_assignee_ids") or [],
        task_count=task_stats["task_count"],
        draft_task_count=task_stats["draft_task_count"],
        assigned_task_count=task_stats["assigned_task_count"],
    )
