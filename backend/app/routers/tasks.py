from typing import List

from fastapi import APIRouter, Depends, HTTPException
from pymongo.database import Database

from app.database import get_db
from app.mappers import task_doc_to_out
from app.repositories.tasks import (
    delete_task as repo_delete_task,
    find_task_by_id,
    list_tasks_by_assignee,
    update_task as repo_update_task,
)
from app.schemas import TaskAssign, TaskOut, TaskUpdate
from app.services.review_status import maybe_auto_complete_review

router = APIRouter(prefix="/api/tasks", tags=["tasks"])


@router.patch("/{task_id}", response_model=TaskOut)
def update_task(task_id: str, payload: TaskUpdate, db: Database = Depends(get_db)):
    if not find_task_by_id(db, task_id):
        raise HTTPException(404, "Task not found")

    updates = {}
    if payload.title is not None:
        updates["title"] = payload.title
    if payload.assignee_id is not None:
        updates["assignee_id"] = payload.assignee_id
    if payload.due_date is not None:
        updates["due_date"] = payload.due_date
    if payload.priority is not None:
        updates["priority"] = payload.priority
    if payload.feature_area is not None:
        updates["feature_area"] = payload.feature_area
    if payload.task_type is not None:
        updates["task_type"] = payload.task_type

    updated = repo_update_task(db, task_id, updates)
    return task_doc_to_out(updated)


@router.post("/{task_id}/assign", response_model=TaskOut)
def assign_task(task_id: str, payload: TaskAssign, db: Database = Depends(get_db)):
    task = find_task_by_id(db, task_id)
    if not task:
        raise HTTPException(404, "Task not found")

    updated = repo_update_task(db, task_id, {
        "assignee_id": payload.assignee_id,
        "status": "assigned",
    })
    maybe_auto_complete_review(db, task["source_ref_id"])
    return task_doc_to_out(updated)


@router.patch("/{task_id}/status", response_model=TaskOut)
def update_status(task_id: str, status: str, db: Database = Depends(get_db)):
    if not find_task_by_id(db, task_id):
        raise HTTPException(404, "Task not found")

    updated = repo_update_task(db, task_id, {"status": status})
    return task_doc_to_out(updated)


@router.delete("/{task_id}")
def delete_task(task_id: str, db: Database = Depends(get_db)):
    if not repo_delete_task(db, task_id):
        raise HTTPException(404, "Task not found")
    return {"success": True}


@router.get("/by-assignee/{user_id}", response_model=List[TaskOut])
def tasks_by_assignee(user_id: str, db: Database = Depends(get_db)):
    tasks = list_tasks_by_assignee(db, user_id)
    return [task_doc_to_out(t) for t in tasks]
