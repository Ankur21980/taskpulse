# MongoDB Atlas Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan step-by-step. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace SQLite with MongoDB Atlas (pymongo) for all persistent data and fix Review Board refresh by reloading tasks from the API.

**Architecture:** FastAPI sync routes call pymongo repository functions against Atlas collections (`teams`, `users`, `source_documents`, `tasks`). Frontend stores last `source_id` in `sessionStorage` and refetches on Review Board mount.

**Tech Stack:** Python 3.9+, FastAPI, pymongo, MongoDB Atlas, React, Zustand, sessionStorage

**Design spec:** `docs/superpowers/specs/2026-06-10-mongodb-atlas-design.md`

---

## File Structure

```
backend/
├── app/
│   ├── config.py              # + MONGODB_URI, MONGODB_DB_NAME
│   ├── database.py            # pymongo client, indexes, get_db
│   ├── enums.py               # TaskStatus, TaskPriority, SourceType
│   ├── mappers.py             # Mongo doc → Pydantic response
│   ├── repositories/
│   │   ├── __init__.py
│   │   ├── teams.py
│   │   ├── users.py
│   │   ├── sources.py
│   │   └── tasks.py
│   ├── seed.py                # pymongo seed
│   ├── routers/               # use repositories (no SQLAlchemy)
│   └── main.py                # startup + health ping
├── tests/
│   ├── conftest.py            # mongomock or test DB fixture
│   ├── test_repositories.py
│   └── test_api.py            # updated mocks
frontend/
├── src/
│   ├── api/client.ts          # + getSourceTasks
│   ├── store/taskStore.ts     # + loadTasksForSource, sessionStorage
│   └── pages/ReviewPage.tsx   # reload on mount
```

---

## Prerequisites (manual)

1. Create MongoDB Atlas cluster: https://cloud.mongodb.com
2. Create DB user with read/write on `taskpulse`
3. Network Access → allow your IP
4. Copy connection string into `backend/.env`:

```env
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/?retryWrites=true&w=majority
MONGODB_DB_NAME=taskpulse
```

---

### Task 1: Dependencies and config

**Files:**
- Modify: `backend/requirements.txt`, `backend/.env.example`, `backend/app/config.py`, `.gitignore`

- [ ] **Step 1: Update `backend/requirements.txt`**

Replace SQLAlchemy line; add pymongo and mongomock for tests:

```text
fastapi==0.115.6
uvicorn[standard]==0.34.0
pydantic==2.10.3
pydantic-settings==2.6.1
python-multipart==0.0.20
python-dotenv==1.0.1
httpx==0.28.1
pytest==8.3.4
pytest-asyncio==0.25.0
pytesseract==0.3.13
Pillow==11.0.0
pymongo==4.10.1
mongomock==4.3.0
```

- [ ] **Step 2: Update `backend/.env.example`**

```env
GEMINI_API_KEY=your_key_here
GEMINI_MODEL=gemini-2.5-flash
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/?retryWrites=true&w=majority
MONGODB_DB_NAME=taskpulse
UPLOAD_DIR=./uploads
CORS_ORIGINS=http://localhost:5173,http://localhost:3002
```

- [ ] **Step 3: Update `backend/app/config.py`**

```python
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

_BACKEND_DIR = Path(__file__).resolve().parent.parent
_ENV_FILE = _BACKEND_DIR / ".env"


class Settings(BaseSettings):
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.5-flash"
    mongodb_uri: str = ""
    mongodb_db_name: str = "taskpulse"
    upload_dir: str = "./uploads"
    cors_origins: str = "http://localhost:5173,http://localhost:3002"

    model_config = SettingsConfigDict(
        env_file=str(_ENV_FILE),
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
```

- [ ] **Step 4: Update `.gitignore`** — remove `backend/*.db` line (optional keep), ensure `.env` ignored

- [ ] **Step 5: Install deps**

```bash
cd backend && source .venv/bin/activate && pip install -r requirements.txt
```

- [ ] **Step 6: Commit**

```bash
git add backend/requirements.txt backend/.env.example backend/app/config.py .gitignore
git commit -m "chore: add MongoDB Atlas config, remove SQLAlchemy dep"
```

---

### Task 2: Enums and document mappers

**Files:**
- Create: `backend/app/enums.py`, `backend/app/mappers.py`
- Delete: `backend/app/models.py` (after Task 4 routers updated)

- [ ] **Step 1: Create `backend/app/enums.py`**

```python
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
```

- [ ] **Step 2: Write failing mapper test**

Create `backend/tests/test_mappers.py`:

```python
from datetime import datetime

from app.mappers import task_doc_to_out, user_doc_to_out


def test_user_doc_to_out():
    doc = {
        "_id": "u1",
        "name": "Priya Sharma",
        "email": "priya@demo.taskpulse.io",
        "team_id": "t1",
    }
    out = user_doc_to_out(doc)
    assert out.id == "u1"
    assert out.name == "Priya Sharma"


def test_task_doc_to_out():
    now = datetime.utcnow()
    doc = {
        "_id": "task1",
        "title": "Send update",
        "assignee_id": None,
        "assignee_hint": "Rahul",
        "status": "draft",
        "priority": "medium",
        "due_date": None,
        "source_ref_id": "src1",
        "source_quote": "Rahul will send",
        "created_at": now,
        "updated_at": now,
    }
    out = task_doc_to_out(doc)
    assert out.id == "task1"
    assert out.status == "draft"
```

- [ ] **Step 3: Run test to verify it fails**

```bash
cd backend && PYTHONPATH=. python -m pytest tests/test_mappers.py -v
```

Expected: FAIL — `ModuleNotFoundError: app.mappers`

- [ ] **Step 4: Create `backend/app/mappers.py`**

```python
from datetime import datetime
from typing import Any, Dict, Optional

from app.schemas import TaskOut, UserOut


def user_doc_to_out(doc: Dict[str, Any]) -> UserOut:
    return UserOut(
        id=str(doc["_id"]),
        name=doc["name"],
        email=doc["email"],
    )


def task_doc_to_out(doc: Dict[str, Any]) -> TaskOut:
    return TaskOut(
        id=str(doc["_id"]),
        title=doc["title"],
        assignee_id=doc.get("assignee_id"),
        assignee_hint=doc.get("assignee_hint"),
        status=doc["status"],
        priority=doc["priority"],
        due_date=doc.get("due_date"),
        source_ref_id=doc["source_ref_id"],
        source_quote=doc.get("source_quote"),
        created_at=doc["created_at"],
        updated_at=doc["updated_at"],
    )


def new_task_doc(
    task_id: str,
    title: str,
    source_ref_id: str,
    assignee_hint: Optional[str] = None,
    priority: str = "medium",
    due_date: Optional[datetime] = None,
    source_quote: Optional[str] = None,
) -> Dict[str, Any]:
    now = datetime.utcnow()
    return {
        "_id": task_id,
        "title": title,
        "assignee_id": None,
        "assignee_hint": assignee_hint,
        "status": "draft",
        "priority": priority,
        "due_date": due_date,
        "source_ref_id": source_ref_id,
        "source_quote": source_quote,
        "created_at": now,
        "updated_at": now,
    }


def new_source_doc(
    source_id: str,
    source_type: str,
    extracted_text: str,
    original_filename: Optional[str] = None,
    storage_path: Optional[str] = None,
) -> Dict[str, Any]:
    return {
        "_id": source_id,
        "type": source_type,
        "original_filename": original_filename,
        "storage_path": storage_path,
        "extracted_text": extracted_text,
        "uploaded_by": None,
        "created_at": datetime.utcnow(),
    }
```

- [ ] **Step 5: Run tests**

```bash
cd backend && PYTHONPATH=. python -m pytest tests/test_mappers.py -v
```

Expected: PASS (2 tests)

- [ ] **Step 6: Commit**

```bash
git add backend/app/enums.py backend/app/mappers.py backend/tests/test_mappers.py
git commit -m "feat: add enums and MongoDB document mappers"
```

---

### Task 3: pymongo database layer

**Files:**
- Rewrite: `backend/app/database.py`
- Create: `backend/tests/test_database.py`

- [ ] **Step 1: Write failing database test**

`backend/tests/test_database.py`:

```python
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
    create_indexes(db)  # should not raise
    assert "source_ref_id_1" in db.tasks.index_information()
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && PYTHONPATH=. python -m pytest tests/test_database.py -v
```

- [ ] **Step 3: Rewrite `backend/app/database.py`**

```python
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
```

- [ ] **Step 4: Run tests**

```bash
cd backend && PYTHONPATH=. python -m pytest tests/test_database.py -v
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/database.py backend/tests/test_database.py
git commit -m "feat: replace SQLAlchemy with pymongo database layer"
```

---

### Task 4: Repositories

**Files:**
- Create: `backend/app/repositories/__init__.py`, `teams.py`, `users.py`, `sources.py`, `tasks.py`
- Create: `backend/tests/test_repositories.py`

- [ ] **Step 1: Write failing repository tests**

`backend/tests/test_repositories.py`:

```python
import mongomock

from app.repositories.tasks import create_task, find_task_by_id, list_tasks_by_source
from app.repositories.users import list_users_by_team
from app.mappers import new_task_doc


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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && PYTHONPATH=. python -m pytest tests/test_repositories.py -v
```

- [ ] **Step 3: Create `backend/app/repositories/tasks.py`**

```python
from datetime import datetime
from typing import Any, Dict, List, Optional

from pymongo import ReturnDocument
from pymongo.database import Database


def create_task(db: Database, doc: Dict[str, Any]) -> None:
    db.tasks.insert_one(doc)


def find_task_by_id(db: Database, task_id: str) -> Optional[Dict[str, Any]]:
    return db.tasks.find_one({"_id": task_id})


def update_task(db: Database, task_id: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    updates["updated_at"] = datetime.utcnow()
    result = db.tasks.find_one_and_update(
        {"_id": task_id},
        {"$set": updates},
        return_document=ReturnDocument.AFTER,
    )
    return result


def delete_task(db: Database, task_id: str) -> bool:
    result = db.tasks.delete_one({"_id": task_id})
    return result.deleted_count == 1


def list_tasks_by_source(db: Database, source_id: str) -> List[Dict[str, Any]]:
    return list(db.tasks.find({"source_ref_id": source_id}))


def list_tasks_by_assignee(db: Database, user_id: str) -> List[Dict[str, Any]]:
    return list(
        db.tasks.find(
            {"assignee_id": user_id, "status": {"$ne": "draft"}}
        ).sort("created_at", -1)
    )
```

- [ ] **Step 4: Create `backend/app/repositories/sources.py`**

```python
from typing import Any, Dict, Optional

from pymongo.database import Database


def create_source(db: Database, doc: Dict[str, Any]) -> None:
    db.source_documents.insert_one(doc)


def find_source_by_id(db: Database, source_id: str) -> Optional[Dict[str, Any]]:
    return db.source_documents.find_one({"_id": source_id})
```

- [ ] **Step 5: Create `backend/app/repositories/users.py`**

```python
from typing import Any, Dict, List

from pymongo.database import Database


def list_users_by_team(db: Database, team_id: str) -> List[Dict[str, Any]]:
    return list(db.users.find({"team_id": team_id}))


def insert_user(db: Database, doc: Dict[str, Any]) -> None:
    db.users.insert_one(doc)
```

- [ ] **Step 6: Create `backend/app/repositories/teams.py`**

```python
from typing import Any, Dict, Optional

from pymongo.database import Database


def find_team_by_id(db: Database, team_id: str) -> Optional[Dict[str, Any]]:
    return db.teams.find_one({"_id": team_id})


def insert_team(db: Database, doc: Dict[str, Any]) -> None:
    db.teams.insert_one(doc)
```

- [ ] **Step 7: Create `backend/app/repositories/__init__.py`** (empty)

- [ ] **Step 8: Run tests**

```bash
cd backend && PYTHONPATH=. python -m pytest tests/test_repositories.py -v
```

Expected: PASS (3 tests)

- [ ] **Step 9: Commit**

```bash
git add backend/app/repositories/ backend/tests/test_repositories.py
git commit -m "feat: add pymongo repositories for tasks, users, sources, teams"
```

---

### Task 5: Seed and startup

**Files:**
- Rewrite: `backend/app/seed.py`, `backend/app/main.py`

- [ ] **Step 1: Rewrite `backend/app/seed.py`**

```python
from pymongo.database import Database

from app.repositories.teams import find_team_by_id, insert_team
from app.repositories.users import insert_user

DEMO_TEAM_ID = "00000000-0000-0000-0000-000000000001"
DEMO_USERS = [
    ("00000000-0000-0000-0000-000000000010", "Rahul Kapoor", "rahul@demo.taskpulse.io"),
    ("00000000-0000-0000-0000-000000000011", "Priya Sharma", "priya@demo.taskpulse.io"),
    ("00000000-0000-0000-0000-000000000012", "Alex Chen", "alex@demo.taskpulse.io"),
    ("00000000-0000-0000-0000-000000000013", "Sam Rivera", "sam@demo.taskpulse.io"),
]


def seed_demo_data(db: Database) -> None:
    if find_team_by_id(db, DEMO_TEAM_ID):
        return

    insert_team(db, {"_id": DEMO_TEAM_ID, "name": "Product Team"})
    for user_id, name, email in DEMO_USERS:
        insert_user(db, {
            "_id": user_id,
            "name": name,
            "email": email,
            "team_id": DEMO_TEAM_ID,
        })
```

- [ ] **Step 2: Rewrite `backend/app/main.py`**

```python
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import close, connect, create_indexes, get_database, ping
from app.routers import sources, tasks, teams
from app.seed import seed_demo_data


@asynccontextmanager
async def lifespan(app: FastAPI):
    connect()
    db = get_database()
    create_indexes(db)
    seed_demo_data(db)
    yield
    close()


app = FastAPI(title="TaskPulse API", version="0.2.0", lifespan=lifespan)

origins = [o.strip() for o in settings.cors_origins.split(",")]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(sources.router)
app.include_router(tasks.router)
app.include_router(teams.router)


@app.get("/health")
def health():
    return {"status": "ok", "db": "connected" if ping() else "disconnected"}
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/seed.py backend/app/main.py
git commit -m "feat: seed demo data and connect to MongoDB on startup"
```

---

### Task 6: Rewrite API routers

**Files:**
- Rewrite: `backend/app/routers/sources.py`, `tasks.py`, `teams.py`
- Delete: `backend/app/models.py`
- Update: `backend/tests/test_models.py` → use `test_enums.py`

- [ ] **Step 1: Rewrite `backend/app/routers/teams.py`**

```python
from typing import List

from fastapi import APIRouter, Depends
from pymongo.database import Database

from app.database import get_db
from app.mappers import user_doc_to_out
from app.repositories.users import list_users_by_team
from app.schemas import UserOut
from app.seed import DEMO_TEAM_ID

router = APIRouter(prefix="/api/teams", tags=["teams"])


@router.get("/demo/members", response_model=List[UserOut])
def list_demo_members(db: Database = Depends(get_db)):
    users = list_users_by_team(db, DEMO_TEAM_ID)
    return [user_doc_to_out(u) for u in users]
```

- [ ] **Step 2: Rewrite `backend/app/routers/tasks.py`**

```python
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from pymongo.database import Database

from app.database import get_db
from app.mappers import task_doc_to_out
from app.repositories.tasks import (
    delete_task as repo_delete_task,
    find_task_by_id,
    list_tasks_by_assignee,
    update_task as repo_update_task,
)
from app.schemas import TaskAssign, TaskOut, TaskUpdate

router = APIRouter(prefix="/api/tasks", tags=["tasks"])


@router.patch("/{task_id}", response_model=TaskOut)
def update_task(task_id: str, payload: TaskUpdate, db: Database = Depends(get_db)):
    existing = find_task_by_id(db, task_id)
    if not existing:
        raise HTTPException(404, "Task not found")

    updates = {}
    if payload.title is not None:
        updates["title"] = payload.title
    if payload.assignee_id is not None:
        updates["assignee_id"] = payload.assignee_id
    if payload.due_date is not None:
        updates["due_date"] = payload.due_date
    if payload.priority is not None:
        updates["priority"] = payload.priority

    updated = repo_update_task(db, task_id, updates)
    return task_doc_to_out(updated)


@router.post("/{task_id}/assign", response_model=TaskOut)
def assign_task(task_id: str, payload: TaskAssign, db: Database = Depends(get_db)):
    existing = find_task_by_id(db, task_id)
    if not existing:
        raise HTTPException(404, "Task not found")

    updated = repo_update_task(db, task_id, {
        "assignee_id": payload.assignee_id,
        "status": "assigned",
    })
    return task_doc_to_out(updated)


@router.patch("/{task_id}/status", response_model=TaskOut)
def update_status(task_id: str, status: str, db: Database = Depends(get_db)):
    existing = find_task_by_id(db, task_id)
    if not existing:
        raise HTTPException(404, "Task not found")

    updated = repo_update_task(db, task_id, {"status": status})
    return task_doc_to_out(updated)


@router.delete("/{task_id}")
def delete_task(task_id: str, db: Database = Depends(get_db)):
    if not repo_delete_task(db, task_id):
        raise HTTPException(404, "Task not found")
    return {"success": True}


@router.get("/by-assignee/{user_id}", response_model=List[TaskOut])
def tasks_by_assignee(user_id: str, db: Database = Depends(get_db)):
    tasks = list_tasks_by_assignee(db, user_id)
    return [task_doc_to_out(t) for t in tasks]
```

- [ ] **Step 3: Rewrite `backend/app/routers/sources.py`**

```python
import os
import uuid
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pymongo.database import Database

from app.config import settings
from app.database import get_db
from app.enums import SourceType
from app.mappers import new_source_doc, new_task_doc, task_doc_to_out
from app.repositories.sources import create_source
from app.repositories.tasks import create_task, list_tasks_by_source
from app.schemas import TaskOut, UploadResponse
from app.services.extractor import extract_tasks_from_text
from app.services.ocr import extract_text_from_image
from app.services.text_parser import normalize_pasted_text, parse_transcript_file

router = APIRouter(prefix="/api/sources", tags=["sources"])


@router.post("/upload", response_model=UploadResponse)
async def upload_source(
    db: Database = Depends(get_db),
    file: Optional[UploadFile] = File(None),
    text: Optional[str] = Form(None),
):
    if not file and not text:
        raise HTTPException(400, "Provide either a file or pasted text")

    source_id = str(uuid.uuid4())
    extracted_text = ""
    source_type = SourceType.PASTED_TEXT.value
    filename = None
    storage_path = None

    if text:
        extracted_text = normalize_pasted_text(text)
        source_type = SourceType.PASTED_TEXT.value
    elif file:
        filename = file.filename or "upload.txt"
        content_bytes = await file.read()
        source_type = (
            SourceType.SCREENSHOT.value
            if filename.lower().endswith((".png", ".jpg", ".jpeg"))
            else SourceType.TRANSCRIPT.value
        )
        os.makedirs(settings.upload_dir, exist_ok=True)
        storage_path = os.path.join(settings.upload_dir, f"{source_id}_{filename}")
        with open(storage_path, "wb") as f:
            f.write(content_bytes)

        if filename.lower().endswith((".png", ".jpg", ".jpeg")):
            extracted_text = extract_text_from_image(storage_path)
        else:
            content = content_bytes.decode("utf-8", errors="replace")
            extracted_text = parse_transcript_file(content, filename)

    if len(extracted_text.strip()) < 10:
        raise HTTPException(400, "Not enough text to extract tasks")

    create_source(db, new_source_doc(
        source_id, source_type, extracted_text, filename, storage_path
    ))

    try:
        extracted = extract_tasks_from_text(extracted_text)
    except Exception as exc:
        raise HTTPException(502, detail=f"Gemini task extraction failed: {exc}") from exc

    task_docs = []
    for item in extracted:
        due = None
        if item.due_date:
            try:
                due = datetime.fromisoformat(item.due_date.replace("Z", "+00:00"))
            except ValueError:
                due = None

        doc = new_task_doc(
            task_id=str(uuid.uuid4()),
            title=item.title[:200],
            source_ref_id=source_id,
            assignee_hint=item.assignee_hint,
            priority=item.priority,
            due_date=due,
            source_quote=item.source_quote,
        )
        create_task(db, doc)
        task_docs.append(doc)

    return UploadResponse(
        source_id=source_id,
        task_count=len(task_docs),
        tasks=[task_doc_to_out(t) for t in task_docs],
    )


@router.get("/{source_id}/tasks", response_model=List[TaskOut])
def get_source_tasks(source_id: str, db: Database = Depends(get_db)):
    tasks = list_tasks_by_source(db, source_id)
    if not tasks:
        raise HTTPException(404, "No tasks found for source")
    return [task_doc_to_out(t) for t in tasks]
```

- [ ] **Step 4: Replace `backend/tests/test_models.py` with `backend/tests/test_enums.py`**

```python
from app.enums import TaskPriority, TaskStatus


def test_task_status_values():
    assert TaskStatus.DRAFT.value == "draft"
    assert TaskStatus.ASSIGNED.value == "assigned"


def test_task_priority_values():
    assert TaskPriority.HIGH.value == "high"
```

Delete `backend/tests/test_models.py` and `backend/app/models.py`.

- [ ] **Step 5: Update `backend/tests/conftest.py`**

```python
import mongomock
import pytest
from fastapi.testclient import TestClient

from app import database
from app.main import app
from app.seed import seed_demo_data


@pytest.fixture(scope="module")
def client():
    mock_client = mongomock.MongoClient()
    original_connect = database.connect
    original_get_database = database.get_database

    database._client = mock_client

    def _mock_connect():
        return mock_client

    def _mock_get_database(client=None, db_name=None):
        return mock_client["taskpulse_test"]

    database.connect = _mock_connect
    database.get_database = _mock_get_database
    database.create_indexes(_mock_get_database())
    seed_demo_data(_mock_get_database())

    with TestClient(app) as test_client:
        yield test_client

    database.connect = original_connect
    database.get_database = original_get_database
    database._client = None
```

- [ ] **Step 6: Run all tests**

```bash
cd backend && PYTHONPATH=. python -m pytest tests/ -v
```

Expected: PASS (all tests)

- [ ] **Step 7: Commit**

```bash
git add backend/app/routers/ backend/tests/ 
git rm backend/app/models.py backend/tests/test_models.py 2>/dev/null || true
git commit -m "feat: migrate API routers from SQLAlchemy to pymongo"
```

---

### Task 7: Frontend refresh persistence

**Files:**
- Modify: `frontend/src/api/client.ts`, `frontend/src/store/taskStore.ts`, `frontend/src/pages/ReviewPage.tsx`

- [ ] **Step 1: Add `getSourceTasks` to `frontend/src/api/client.ts`**

```typescript
  getSourceTasks: (sourceId: string) =>
    request<Task[]>(`/sources/${sourceId}/tasks`),
```

- [ ] **Step 2: Add sessionStorage helpers and `loadTasksForSource` to `taskStore.ts`**

At top of file:

```typescript
const SOURCE_ID_KEY = "taskpulse:lastSourceId";

function saveSourceId(id: string) {
  sessionStorage.setItem(SOURCE_ID_KEY, id);
}

function loadSourceId(): string | null {
  return sessionStorage.getItem(SOURCE_ID_KEY);
}
```

Add to interface:

```typescript
  loadTasksForSource: (sourceId: string) => Promise<void>;
  restoreLastSession: () => Promise<void>;
```

In store implementation, update `extractFromText` and `extractFromFile` success blocks:

```typescript
set({ tasks: res.tasks, sourceId: res.source_id, loading: false });
saveSourceId(res.source_id);
```

Add:

```typescript
  loadTasksForSource: async (sourceId) => {
    set({ loading: true, error: null });
    try {
      const tasks = await api.getSourceTasks(sourceId);
      set({ tasks, sourceId, loading: false });
      saveSourceId(sourceId);
    } catch (e) {
      sessionStorage.removeItem(SOURCE_ID_KEY);
      set({ loading: false, error: (e as Error).message, sourceId: null, tasks: [] });
    }
  },

  restoreLastSession: async () => {
    const sourceId = loadSourceId();
    if (sourceId && get().tasks.length === 0) {
      await get().loadTasksForSource(sourceId);
    }
  },
```

- [ ] **Step 3: Update `frontend/src/pages/ReviewPage.tsx`**

```typescript
  const { tasks, members, loadMembers, updateTask, assignTask, deleteTask, restoreLastSession, loading } = useTaskStore();

  useEffect(() => {
    loadMembers();
    restoreLastSession();
  }, [loadMembers, restoreLastSession]);
```

Add loading state before empty check:

```typescript
  if (loading && tasks.length === 0) {
    return <p className="text-slate-600">Loading tasks...</p>;
  }
```

- [ ] **Step 4: Build frontend**

```bash
cd frontend && npm run build
```

Expected: build succeeds

- [ ] **Step 5: Commit**

```bash
git add frontend/src/
git commit -m "feat: restore Review Board tasks from API after page refresh"
```

---

### Task 8: Docs and cleanup

**Files:**
- Modify: `README.md`, `docs/superpowers/specs/2026-06-09-taskpulse-prototype-design.md` (add note)

- [ ] **Step 1: Update `README.md` backend section**

```markdown
### Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # add GEMINI_API_KEY + MONGODB_URI
uvicorn app.main:app --reload --port 8000

Data is stored in MongoDB Atlas (not SQLite).
```

Add Atlas setup link and note to restart uvicorn after `.env` changes.

- [ ] **Step 2: Delete local SQLite file**

```bash
rm -f backend/taskpulse.db
```

- [ ] **Step 3: Manual smoke test**

1. Set `MONGODB_URI` in `.env`, restart backend
2. `curl http://localhost:8000/health` → `{"status":"ok","db":"connected"}`
3. Extract sample transcript in UI
4. Refresh Review Board → tasks still visible
5. Restart backend → data still in Atlas

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: update README for MongoDB Atlas storage"
```

---

## Self-Review Checklist

- [x] Spec coverage: Atlas storage, pymongo, fresh seed, refresh fix — all have tasks
- [x] Option B (pymongo sync) used throughout
- [x] API contract unchanged
- [x] No TBD placeholders
- [x] `find_one_and_update` uses `ReturnDocument.AFTER` in tasks repository

**Note:** `pymongo` `find_one_and_update` requires `from pymongo import ReturnDocument` and `return_document=ReturnDocument.AFTER`. Add to `tasks.py` repository during implementation.

---

## Execution Handoff

**Plan saved to** `docs/superpowers/plans/2026-06-10-mongodb-atlas.md`.

**Two execution options:**

1. **Subagent-driven (recommended)** — fresh subagent per task, review between tasks
2. **Inline execution** — implement task-by-task in this session with checkpoints

Which approach?
