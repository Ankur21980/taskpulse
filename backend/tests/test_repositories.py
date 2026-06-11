import mongomock

from app.mappers import new_task_doc
from app.repositories.tasks import create_task, find_task_by_id, list_tasks_by_source
from app.repositories.users import list_users_by_team


def _db():
    client = mongomock.MongoClient()
    return client["taskpulse_test"]


def test_create_and_find_task():
    db = _db()
    doc = new_task_doc("t1", "Send update", "src1", assignee_hint="Rahul")
    create_task(db, doc)
    found = find_task_by_id(db, "t1")
    assert found is not None
    assert found["title"] == "Send update"


def test_list_tasks_by_source():
    db = _db()
    create_task(db, new_task_doc("t1", "A", "src1"))
    create_task(db, new_task_doc("t2", "B", "src1"))
    tasks = list_tasks_by_source(db, "src1")
    assert len(tasks) == 2


def test_list_users_by_team():
    db = _db()
    db.users.insert_one({
        "_id": "u1", "name": "Priya", "email": "p@x.io", "team_id": "team1"
    })
    users = list_users_by_team(db, "team1")
    assert len(users) == 1
    assert users[0]["name"] == "Priya"
