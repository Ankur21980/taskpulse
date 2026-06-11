from app.models import TaskPriority, TaskStatus


def test_task_status_values():
    assert TaskStatus.DRAFT.value == "draft"
    assert TaskStatus.ASSIGNED.value == "assigned"


def test_task_priority_values():
    assert TaskPriority.HIGH.value == "high"
