import enum


class TaskStatus(str, enum.Enum):
    DRAFT = "draft"
    ASSIGNED = "assigned"
    IN_PROGRESS = "in_progress"
    DONE = "done"
    OVERDUE = "overdue"


class TaskPriority(str, enum.Enum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class SourceType(str, enum.Enum):
    TRANSCRIPT = "transcript"
    SCREENSHOT = "screenshot"
    PASTED_TEXT = "pasted_text"
    PRD = "prd"


class TaskType(str, enum.Enum):
    REQUIREMENT = "requirement"
    MILESTONE = "milestone"
    DELIVERABLE = "deliverable"


class ReviewStatus(str, enum.Enum):
    DRAFT = "draft"
    COMPLETED = "completed"
