from datetime import datetime
from typing import Any, Dict, List, Optional

from pymongo import ReturnDocument
from pymongo.database import Database


def create_task(db: Database, doc: Dict[str, Any]) -> None:
    db.tasks.insert_one(doc)


def find_task_by_id(db: Database, task_id: str) -> Optional[Dict[str, Any]]:
    return db.tasks.find_one({"_id": task_id})


def update_task(db: Database, task_id: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    updates["updated_at"] = datetime.utcnow()
    return db.tasks.find_one_and_update(
        {"_id": task_id},
        {"$set": updates},
        return_document=ReturnDocument.AFTER,
    )


def delete_task(db: Database, task_id: str) -> bool:
    result = db.tasks.delete_one({"_id": task_id})
    return result.deleted_count == 1


def list_tasks_by_source(db: Database, source_id: str) -> List[Dict[str, Any]]:
    return list(db.tasks.find({"source_ref_id": source_id}))


def count_tasks_by_source(db: Database, source_id: str) -> Dict[str, int]:
    tasks = list(db.tasks.find({"source_ref_id": source_id}))
    draft = sum(1 for t in tasks if t["status"] == "draft")
    return {
        "task_count": len(tasks),
        "draft_task_count": draft,
        "assigned_task_count": len(tasks) - draft,
    }


def list_tasks_by_assignee(db: Database, user_id: str) -> List[Dict[str, Any]]:
    return list(
        db.tasks.find(
            {"assignee_id": user_id, "status": {"$ne": "draft"}}
        ).sort("created_at", -1)
    )
