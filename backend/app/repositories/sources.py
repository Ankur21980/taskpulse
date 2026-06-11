from datetime import datetime
from typing import Any, Dict, List, Optional

from pymongo.database import Database


def create_source(db: Database, doc: Dict[str, Any]) -> None:
    db.source_documents.insert_one(doc)


def find_source_by_id(db: Database, source_id: str) -> Optional[Dict[str, Any]]:
    return db.source_documents.find_one({"_id": source_id})


def list_sources(db: Database) -> List[Dict[str, Any]]:
    return list(db.source_documents.find().sort("created_at", -1))


def update_source_review_status(
    db: Database, source_id: str, status: str
) -> Optional[Dict[str, Any]]:
    completed_at = datetime.utcnow() if status == "completed" else None
    db.source_documents.update_one(
        {"_id": source_id},
        {"$set": {"review_status": status, "completed_at": completed_at}},
    )
    return find_source_by_id(db, source_id)
