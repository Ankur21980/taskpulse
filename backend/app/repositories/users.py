from typing import Any, Dict, List

from pymongo.database import Database


def list_users_by_team(db: Database, team_id: str) -> List[Dict[str, Any]]:
    return list(db.users.find({"team_id": team_id}))


def insert_user(db: Database, doc: Dict[str, Any]) -> None:
    db.users.insert_one(doc)
