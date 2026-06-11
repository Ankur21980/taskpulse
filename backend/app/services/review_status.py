from pymongo.database import Database

from app.repositories.sources import find_source_by_id, update_source_review_status
from app.repositories.tasks import list_tasks_by_source


def maybe_auto_complete_review(db: Database, source_id: str) -> None:
    source = find_source_by_id(db, source_id)
    if not source or source.get("review_status", "draft") != "draft":
        return
    tasks = list_tasks_by_source(db, source_id)
    if not tasks:
        return
    if all(t["status"] != "draft" for t in tasks):
        update_source_review_status(db, source_id, "completed")
