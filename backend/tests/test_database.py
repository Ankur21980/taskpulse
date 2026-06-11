import mongomock

from app.database import create_indexes, get_database


def test_get_database_returns_db():
    client = mongomock.MongoClient()
    db = get_database(client, "taskpulse_test")
    assert db.name == "taskpulse_test"


def test_create_indexes_idempotent():
    client = mongomock.MongoClient()
    db = get_database(client, "taskpulse_test")
    create_indexes(db)
    create_indexes(db)
    assert "source_ref_id_1" in db.tasks.index_information()
