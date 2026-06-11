from typing import Generator, Optional

from pymongo import MongoClient
from pymongo.database import Database
from pymongo.errors import PyMongoError

from app.config import settings

_client: Optional[MongoClient] = None


def connect() -> MongoClient:
    global _client
    if _client is None:
        if not settings.mongodb_uri:
            raise RuntimeError(
                "MONGODB_URI is not set. Add it to backend/.env — see .env.example"
            )
        _client = MongoClient(settings.mongodb_uri, serverSelectionTimeoutMS=5000)
        _client.admin.command("ping")
    return _client


def close() -> None:
    global _client
    if _client is not None:
        _client.close()
        _client = None


def get_database(client: Optional[MongoClient] = None, db_name: Optional[str] = None) -> Database:
    mongo = client or connect()
    return mongo[db_name or settings.mongodb_db_name]


def create_indexes(db: Database) -> None:
    db.tasks.create_index("source_ref_id")
    db.tasks.create_index([("assignee_id", 1), ("status", 1)])
    db.users.create_index("team_id")


def ping() -> bool:
    try:
        connect().admin.command("ping")
        return True
    except PyMongoError:
        return False


def get_db() -> Generator[Database, None, None]:
    yield get_database()
