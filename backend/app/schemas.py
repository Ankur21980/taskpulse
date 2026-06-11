from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, Field


class UserOut(BaseModel):
    id: str
    name: str
    email: str

    model_config = {"from_attributes": True}


class TaskOut(BaseModel):
    id: str
    title: str
    assignee_id: Optional[str]
    assignee_hint: Optional[str]
    status: str
    priority: str
    due_date: Optional[datetime]
    source_ref_id: str
    source_quote: Optional[str]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    assignee_id: Optional[str] = None
    due_date: Optional[datetime] = None
    priority: Optional[Literal["high", "medium", "low"]] = None


class TaskAssign(BaseModel):
    assignee_id: str


class UploadResponse(BaseModel):
    source_id: str
    task_count: int
    tasks: List[TaskOut]


class ExtractedTask(BaseModel):
    title: str = Field(max_length=200)
    assignee_hint: Optional[str] = None
    due_date: Optional[str] = None
    priority: Literal["high", "medium", "low"] = "medium"
    source_quote: Optional[str] = None
