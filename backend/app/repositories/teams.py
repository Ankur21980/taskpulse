from typing import Any, Dict, Optional

from pymongo.database import Database


def find_team_by_id(db: Database, team_id: str) -> Optional[Dict[str, Any]]:
    return db.teams.find_one({"_id": team_id})


def insert_team(db: Database, doc: Dict[str, Any]) -> None:
    db.teams.insert_one(doc)
