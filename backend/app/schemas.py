from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, Field


class UserOut(BaseModel):
    id: str
    name: str
    email: str
    role: Optional[str] = None
    experience_years: Optional[float] = None

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
    feature_area: Optional[str] = None
    task_type: Optional[Literal["requirement", "milestone", "deliverable"]] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    assignee_id: Optional[str] = None
    due_date: Optional[datetime] = None
    priority: Optional[Literal["high", "medium", "low"]] = None
    feature_area: Optional[str] = None
    task_type: Optional[Literal["requirement", "milestone", "deliverable"]] = None


class TaskAssign(BaseModel):
    assignee_id: str


class UploadResponse(BaseModel):
    source_id: str
    task_count: int
    tasks: List[TaskOut]
    truncated: bool = False


class SourceSummaryOut(BaseModel):
    id: str
    type: str
    original_filename: Optional[str] = None
    created_at: datetime
    review_status: Literal["draft", "completed"]
    completed_at: Optional[datetime] = None
    eligible_assignee_ids: List[str] = []
    task_count: int
    draft_task_count: int
    assigned_task_count: int


class ReviewStatusUpdate(BaseModel):
    review_status: Literal["draft", "completed"]


class TaskCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    assignee_id: Optional[str] = None
    assignee_hint: Optional[str] = None
    priority: Literal["high", "medium", "low"] = "medium"
    feature_area: Optional[str] = None
    task_type: Optional[Literal["requirement", "milestone", "deliverable"]] = None


class ExtractedTask(BaseModel):
    title: str = Field(max_length=200)
    assignee_hint: Optional[str] = None
    due_date: Optional[str] = None
    priority: Literal["high", "medium", "low"] = "medium"
    source_quote: Optional[str] = None
    feature_area: Optional[str] = None
    task_type: Optional[Literal["requirement", "milestone", "deliverable"]] = None
