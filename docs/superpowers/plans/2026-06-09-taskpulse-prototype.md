# TaskPulse Prototype Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan step-by-step. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a demo-ready TaskPulse prototype that extracts tasks from transcripts via Google Gemini, lets a user review and assign them, and shows assignee task lists — with no production infra.

**Architecture:** Monorepo with a FastAPI backend (SQLite, local file storage, synchronous Gemini extraction) and a React + Vite frontend (Tailwind, Zustand). Three screens: Upload → Review Board → My Tasks.

**Tech Stack:** Python 3.11+, FastAPI, SQLAlchemy, SQLite, google-generativeai, pytesseract (stretch), React 18, Vite, Tailwind CSS, Zustand, Vitest, pytest

**Design spec:** `docs/superpowers/specs/2026-06-09-taskpulse-prototype-design.md`

---

## File Structure

```
taskpulse/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                 # FastAPI app, CORS, router mount
│   │   ├── config.py               # Settings (GEMINI_API_KEY, DB path)
│   │   ├── database.py             # SQLAlchemy engine + session
│   │   ├── models.py               # Team, User, SourceDocument, Task ORM
│   │   ├── schemas.py              # Pydantic request/response models
│   │   ├── seed.py                 # Demo team + users
│   │   ├── services/
│   │   │   ├── __init__.py
│   │   │   ├── extractor.py        # Gemini task extraction
│   │   │   ├── ocr.py              # Tesseract wrapper (stretch)
│   │   │   └── text_parser.py      # .txt/.vtt/.srt normalization
│   │   └── routers/
│   │       ├── __init__.py
│   │       ├── sources.py          # POST upload, GET tasks by source
│   │       ├── tasks.py            # PATCH, assign, delete
│   │       └── teams.py            # GET members
│   ├── tests/
│   │   ├── test_extractor.py
│   │   ├── test_text_parser.py
│   │   └── test_api.py
│   ├── uploads/                    # gitignored local file storage
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── api/client.ts
│   │   ├── store/taskStore.ts
│   │   ├── types/index.ts
│   │   ├── components/
│   │   │   ├── Layout.tsx
│   │   │   ├── UploadPanel.tsx
│   │   │   ├── TaskCard.tsx
│   │   │   └── AssigneeSelect.tsx
│   │   └── pages/
│   │       ├── UploadPage.tsx
│   │       ├── ReviewPage.tsx
│   │       └── MyTasksPage.tsx
│   ├── index.html
│   ├── package.json
│   ├── tailwind.config.js
│   ├── vite.config.ts
│   └── vitest.config.ts
├── docs/superpowers/
├── .gitignore
└── README.md
```

---

## Prerequisites

- Python 3.11+
- Node.js 20+
- Google AI Studio API key → https://aistudio.google.com/apikey
- (Stretch) `tesseract` binary: `brew install tesseract`

---

### Task 1: Repository scaffolding

**Files:**
- Create: `.gitignore`, `README.md`, `backend/requirements.txt`, `backend/.env.example`

- [ ] **Step 1: Create `.gitignore`**

```gitignore
# Python
backend/.env
backend/__pycache__/
backend/.pytest_cache/
backend/uploads/*
!backend/uploads/.gitkeep
backend/*.db

# Node
frontend/node_modules/
frontend/dist/

# OS
.DS_Store
```

- [ ] **Step 2: Create `backend/requirements.txt`**

```text
fastapi==0.115.6
uvicorn[standard]==0.34.0
sqlalchemy==2.0.36
pydantic==2.10.3
pydantic-settings==2.6.1
python-multipart==0.0.20
google-generativeai==0.8.3
python-dotenv==1.0.1
httpx==0.28.1
pytest==8.3.4
pytest-asyncio==0.25.0
pytesseract==0.3.13
Pillow==11.0.0
```

- [ ] **Step 3: Create `backend/.env.example`**

```env
GEMINI_API_KEY=your_key_here
GEMINI_MODEL=gemini-2.0-flash
DATABASE_URL=sqlite:///./taskpulse.db
UPLOAD_DIR=./uploads
CORS_ORIGINS=http://localhost:5173
```

- [ ] **Step 4: Create `README.md`**

```markdown
# TaskPulse Prototype

AI task extraction from meeting transcripts (Gemini) with review and assignment UI.

## Quick start

### Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # add GEMINI_API_KEY
uvicorn app.main:app --reload --port 8000

### Frontend
cd frontend
npm install
npm run dev

Open http://localhost:5173
```

- [ ] **Step 5: Create upload dir placeholder**

```bash
mkdir -p backend/uploads && touch backend/uploads/.gitkeep
```

- [ ] **Step 6: Commit**

```bash
git add .gitignore README.md backend/
git commit -m "chore: scaffold TaskPulse monorepo"
```

---

### Task 2: Backend config and database

**Files:**
- Create: `backend/app/__init__.py`, `backend/app/config.py`, `backend/app/database.py`, `backend/app/models.py`

- [ ] **Step 1: Write failing model test**

Create `backend/tests/test_models.py`:

```python
from app.models import TaskStatus, TaskPriority


def test_task_status_values():
    assert TaskStatus.DRAFT.value == "draft"
    assert TaskStatus.ASSIGNED.value == "assigned"


def test_task_priority_values():
    assert TaskPriority.HIGH.value == "high"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_models.py -v`  
Expected: FAIL — `ModuleNotFoundError: No module named 'app'`

- [ ] **Step 3: Implement config**

`backend/app/config.py`:

```python
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.0-flash"
    database_url: str = "sqlite:///./taskpulse.db"
    upload_dir: str = "./uploads"
    cors_origins: str = "http://localhost:5173"

    class Config:
        env_file = ".env"


settings = Settings()
```

- [ ] **Step 4: Implement database**

`backend/app/database.py`:

```python
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.config import settings

engine = create_engine(
    settings.database_url,
    connect_args={"check_same_thread": False},
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

- [ ] **Step 5: Implement models**

`backend/app/models.py`:

```python
import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


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


class Team(Base):
    __tablename__ = "teams"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(100))


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(100))
    email: Mapped[str] = mapped_column(String(255))
    team_id: Mapped[str] = mapped_column(String(36), ForeignKey("teams.id"))


class SourceDocument(Base):
    __tablename__ = "source_documents"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    type: Mapped[SourceType] = mapped_column(Enum(SourceType))
    original_filename: Mapped[str | None] = mapped_column(String(255), nullable=True)
    storage_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    extracted_text: Mapped[str] = mapped_column(Text)
    uploaded_by: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    tasks: Mapped[list["Task"]] = relationship(back_populates="source")


class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    title: Mapped[str] = mapped_column(String(200))
    assignee_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"), nullable=True)
    assignee_hint: Mapped[str | None] = mapped_column(String(100), nullable=True)
    status: Mapped[TaskStatus] = mapped_column(Enum(TaskStatus), default=TaskStatus.DRAFT)
    priority: Mapped[TaskPriority] = mapped_column(Enum(TaskPriority), default=TaskPriority.MEDIUM)
    due_date: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    source_ref_id: Mapped[str] = mapped_column(String(36), ForeignKey("source_documents.id"))
    source_quote: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    source: Mapped["SourceDocument"] = relationship(back_populates="tasks")
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd backend && PYTHONPATH=. python -m pytest tests/test_models.py -v`  
Expected: PASS (2 tests)

- [ ] **Step 7: Commit**

```bash
git add backend/app/ backend/tests/test_models.py
git commit -m "feat: add SQLAlchemy models and database config"
```

---

### Task 3: Seed data and Pydantic schemas

**Files:**
- Create: `backend/app/seed.py`, `backend/app/schemas.py`

- [ ] **Step 1: Implement schemas**

`backend/app/schemas.py`:

```python
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class UserOut(BaseModel):
    id: str
    name: str
    email: str

    model_config = {"from_attributes": True}


class TaskOut(BaseModel):
    id: str
    title: str
    assignee_id: str | None
    assignee_hint: str | None
    status: str
    priority: str
    due_date: datetime | None
    source_ref_id: str
    source_quote: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TaskUpdate(BaseModel):
    title: str | None = None
    assignee_id: str | None = None
    due_date: datetime | None = None
    priority: Literal["high", "medium", "low"] | None = None


class TaskAssign(BaseModel):
    assignee_id: str


class UploadResponse(BaseModel):
    source_id: str
    task_count: int
    tasks: list[TaskOut]


class ExtractedTask(BaseModel):
    title: str = Field(max_length=200)
    assignee_hint: str | None = None
    due_date: str | None = None
    priority: Literal["high", "medium", "low"] = "medium"
    source_quote: str | None = None
```

- [ ] **Step 2: Implement seed**

`backend/app/seed.py`:

```python
from sqlalchemy.orm import Session

from app.models import Team, User

DEMO_TEAM_ID = "00000000-0000-0000-0000-000000000001"
DEMO_USERS = [
    ("00000000-0000-0000-0000-000000000010", "Rahul Kapoor", "rahul@demo.taskpulse.io"),
    ("00000000-0000-0000-0000-000000000011", "Priya Sharma", "priya@demo.taskpulse.io"),
    ("00000000-0000-0000-0000-000000000012", "Alex Chen", "alex@demo.taskpulse.io"),
    ("00000000-0000-0000-0000-000000000013", "Sam Rivera", "sam@demo.taskpulse.io"),
]


def seed_demo_data(db: Session) -> None:
    if db.query(Team).filter(Team.id == DEMO_TEAM_ID).first():
        return

    team = Team(id=DEMO_TEAM_ID, name="Product Team")
    db.add(team)
    for user_id, name, email in DEMO_USERS:
        db.add(User(id=user_id, name=name, email=email, team_id=DEMO_TEAM_ID))
    db.commit()
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/schemas.py backend/app/seed.py
git commit -m "feat: add Pydantic schemas and demo seed data"
```

---

### Task 4: Text parser service

**Files:**
- Create: `backend/app/services/text_parser.py`, `backend/tests/test_text_parser.py`

- [ ] **Step 1: Write failing tests**

`backend/tests/test_text_parser.py`:

```python
from app.services.text_parser import parse_transcript_file, normalize_pasted_text


def test_normalize_pasted_text_collapses_whitespace():
    assert normalize_pasted_text("hello   world\n\nfoo") == "hello world foo"


def test_parse_vtt_strips_cues():
  content = """WEBVTT

00:00:01.000 --> 00:00:04.000
Rahul: We need to ship the dashboard by Friday.
"""
    result = parse_transcript_file(content, "meeting.vtt")
    assert "Rahul" in result
    assert "-->" not in result
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && PYTHONPATH=. python -m pytest tests/test_text_parser.py -v`  
Expected: FAIL — module not found

- [ ] **Step 3: Implement text parser**

`backend/app/services/text_parser.py`:

```python
import re


def normalize_pasted_text(text: str) -> str:
    return " ".join(text.split())


def _strip_vtt(content: str) -> str:
    lines = []
    for line in content.splitlines():
        line = line.strip()
        if not line or line == "WEBVTT":
            continue
        if re.match(r"\d{2}:\d{2}:\d{2}", line):
            continue
        if "-->" in line:
            continue
        if line.isdigit():
            continue
        lines.append(line)
    return "\n".join(lines)


def _strip_srt(content: str) -> str:
    lines = []
    for line in content.splitlines():
        line = line.strip()
        if not line:
            continue
        if line.isdigit():
            continue
        if re.match(r"\d{2}:\d{2}:\d{2}", line) and "-->" in line:
            continue
        lines.append(line)
    return "\n".join(lines)


def parse_transcript_file(content: str, filename: str) -> str:
    lower = filename.lower()
    if lower.endswith(".vtt"):
        return _strip_vtt(content)
    if lower.endswith(".srt"):
        return _strip_srt(content)
    return content
```

- [ ] **Step 4: Run tests**

Run: `cd backend && PYTHONPATH=. python -m pytest tests/test_text_parser.py -v`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/text_parser.py backend/tests/test_text_parser.py
git commit -m "feat: add transcript text normalization"
```

---

### Task 5: Gemini extraction service

**Files:**
- Create: `backend/app/services/extractor.py`, `backend/tests/test_extractor.py`

- [ ] **Step 1: Write failing test (mocked Gemini)**

`backend/tests/test_extractor.py`:

```python
from unittest.mock import MagicMock, patch

from app.services.extractor import EXTRACTION_PROMPT, parse_extraction_response


SAMPLE_JSON = """[
  {
    "title": "Review Q3 budget proposal",
    "assignee_hint": "Priya",
    "due_date": null,
    "priority": "high",
    "source_quote": "Priya will review the Q3 budget"
  }
]"""


def test_parse_extraction_response():
    tasks = parse_extraction_response(SAMPLE_JSON)
    assert len(tasks) == 1
    assert tasks[0].title == "Review Q3 budget proposal"
    assert tasks[0].priority == "high"


@patch("app.services.extractor.genai.GenerativeModel")
def test_extract_tasks_from_text(mock_model_cls):
    mock_model = MagicMock()
    mock_model_cls.return_value = mock_model
    mock_model.generate_content.return_value = MagicMock(text=SAMPLE_JSON)

    from app.services.extractor import extract_tasks_from_text

    tasks = extract_tasks_from_text("Meeting notes here")
    assert len(tasks) == 1
    mock_model.generate_content.assert_called_once()
    call_args = mock_model.generate_content.call_args[0][0]
    assert "Meeting notes here" in call_args
    assert EXTRACTION_PROMPT in call_args
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && PYTHONPATH=. python -m pytest tests/test_extractor.py -v`  
Expected: FAIL

- [ ] **Step 3: Implement extractor**

`backend/app/services/extractor.py`:

```python
import json
import re

import google.generativeai as genai

from app.config import settings
from app.schemas import ExtractedTask

EXTRACTION_PROMPT = """You are a task extraction assistant. From the following meeting transcript or chat, extract every action item. For each task return a JSON object with: title (max 10 words, imperative verb), assignee_hint (name mentioned as responsible, or null), due_date (any date mentioned, ISO 8601 or null), priority (high/medium/low inferred from urgency language), source_quote (the exact sentence that generated this task, max 20 words). Return only a JSON array. No preamble, no markdown.

TEXT:
"""


def _configure_gemini() -> None:
    genai.configure(api_key=settings.gemini_api_key)


def parse_extraction_response(raw: str) -> list[ExtractedTask]:
    cleaned = raw.strip()
    # Strip markdown code fences if model adds them
    cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
    cleaned = re.sub(r"\s*```$", "", cleaned)
    data = json.loads(cleaned)
    return [ExtractedTask.model_validate(item) for item in data]


def extract_tasks_from_text(text: str) -> list[ExtractedTask]:
    _configure_gemini()
    model = genai.GenerativeModel(
        settings.gemini_model,
        generation_config={"response_mime_type": "application/json"},
    )
    prompt = f"{EXTRACTION_PROMPT}{text}"
    response = model.generate_content(prompt)
    try:
        return parse_extraction_response(response.text)
    except (json.JSONDecodeError, ValueError):
        # Retry once without JSON mode constraint
        response = model.generate_content(
            prompt + "\n\nReturn ONLY valid JSON array. No markdown."
        )
        return parse_extraction_response(response.text)
```

- [ ] **Step 4: Run tests**

Run: `cd backend && PYTHONPATH=. python -m pytest tests/test_extractor.py -v`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/extractor.py backend/tests/test_extractor.py
git commit -m "feat: add Gemini task extraction service"
```

---

### Task 6: API routers and FastAPI app

**Files:**
- Create: `backend/app/routers/sources.py`, `backend/app/routers/tasks.py`, `backend/app/routers/teams.py`, `backend/app/main.py`, `backend/tests/test_api.py`

- [ ] **Step 1: Write failing API test**

`backend/tests/test_api.py`:

```python
import io
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import app
from app.schemas import ExtractedTask

client = TestClient(app)

MOCK_TASKS = [
    ExtractedTask(
        title="Send client update",
        assignee_hint="Rahul",
        due_date=None,
        priority="medium",
        source_quote="Rahul will send the client update",
    )
]


@patch("app.routers.sources.extract_tasks_from_text", return_value=MOCK_TASKS)
def test_upload_pasted_text(mock_extract):
    response = client.post(
        "/api/sources/upload",
        data={"text": "Rahul will send the client update by EOD."},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["task_count"] == 1
    assert body["tasks"][0]["title"] == "Send client update"


def test_list_team_members():
    response = client.get("/api/teams/demo/members")
    assert response.status_code == 200
    members = response.json()
    assert len(members) >= 4
    assert any(m["name"] == "Priya Sharma" for m in members)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && PYTHONPATH=. python -m pytest tests/test_api.py -v`  
Expected: FAIL

- [ ] **Step 3: Implement sources router**

`backend/app/routers/sources.py`:

```python
import os
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import SourceDocument, SourceType, Task, TaskPriority, TaskStatus
from app.schemas import TaskOut, UploadResponse
from app.services.extractor import extract_tasks_from_text
from app.services.text_parser import normalize_pasted_text, parse_transcript_file

router = APIRouter(prefix="/api/sources", tags=["sources"])


def _priority_enum(value: str) -> TaskPriority:
    return TaskPriority(value)


@router.post("/upload", response_model=UploadResponse)
async def upload_source(
    db: Session = Depends(get_db),
    file: UploadFile | None = File(None),
    text: str | None = Form(None),
):
    if not file and not text:
        raise HTTPException(400, "Provide either a file or pasted text")

    source_id = str(uuid.uuid4())
    extracted_text = ""
    source_type = SourceType.PASTED_TEXT
    filename = None
    storage_path = None

    if text:
        extracted_text = normalize_pasted_text(text)
        source_type = SourceType.PASTED_TEXT
    elif file:
        filename = file.filename or "upload.txt"
        content_bytes = await file.read()
        content = content_bytes.decode("utf-8", errors="replace")
        extracted_text = parse_transcript_file(content, filename)
        source_type = (
            SourceType.SCREENSHOT
            if filename.lower().endswith((".png", ".jpg", ".jpeg"))
            else SourceType.TRANSCRIPT
        )
        os.makedirs(settings.upload_dir, exist_ok=True)
        storage_path = os.path.join(settings.upload_dir, f"{source_id}_{filename}")
        with open(storage_path, "wb") as f:
            f.write(content_bytes)

    if len(extracted_text.strip()) < 10:
        raise HTTPException(400, "Not enough text to extract tasks")

    source = SourceDocument(
        id=source_id,
        type=source_type,
        original_filename=filename,
        storage_path=storage_path,
        extracted_text=extracted_text,
    )
    db.add(source)
    db.flush()

    extracted = extract_tasks_from_text(extracted_text)
    tasks_out: list[Task] = []

    for item in extracted:
        due = None
        if item.due_date:
            try:
                due = datetime.fromisoformat(item.due_date.replace("Z", "+00:00"))
            except ValueError:
                due = None

        task = Task(
            title=item.title[:200],
            assignee_hint=item.assignee_hint,
            priority=_priority_enum(item.priority),
            due_date=due,
            source_ref_id=source_id,
            source_quote=item.source_quote,
            status=TaskStatus.DRAFT,
        )
        db.add(task)
        tasks_out.append(task)

    db.commit()
    for t in tasks_out:
        db.refresh(t)

    return UploadResponse(
        source_id=source_id,
        task_count=len(tasks_out),
        tasks=[TaskOut.model_validate(t) for t in tasks_out],
    )


@router.get("/{source_id}/tasks", response_model=list[TaskOut])
def get_source_tasks(source_id: str, db: Session = Depends(get_db)):
    tasks = db.query(Task).filter(Task.source_ref_id == source_id).all()
    if not tasks:
        raise HTTPException(404, "No tasks found for source")
    return [TaskOut.model_validate(t) for t in tasks]
```

- [ ] **Step 4: Implement tasks router**

`backend/app/routers/tasks.py`:

```python
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Task, TaskPriority, TaskStatus
from app.schemas import TaskAssign, TaskOut, TaskUpdate

router = APIRouter(prefix="/api/tasks", tags=["tasks"])


@router.patch("/{task_id}", response_model=TaskOut)
def update_task(task_id: str, payload: TaskUpdate, db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(404, "Task not found")

    if payload.title is not None:
        task.title = payload.title
    if payload.assignee_id is not None:
        task.assignee_id = payload.assignee_id
    if payload.due_date is not None:
        task.due_date = payload.due_date
    if payload.priority is not None:
        task.priority = TaskPriority(payload.priority)

    task.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(task)
    return TaskOut.model_validate(task)


@router.post("/{task_id}/assign", response_model=TaskOut)
def assign_task(task_id: str, payload: TaskAssign, db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(404, "Task not found")

    task.assignee_id = payload.assignee_id
    task.status = TaskStatus.ASSIGNED
    task.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(task)
    return TaskOut.model_validate(task)


@router.patch("/{task_id}/status", response_model=TaskOut)
def update_status(task_id: str, status: str, db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(404, "Task not found")

    task.status = TaskStatus(status)
    task.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(task)
    return TaskOut.model_validate(task)


@router.delete("/{task_id}")
def delete_task(task_id: str, db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(404, "Task not found")
    db.delete(task)
    db.commit()
    return {"success": True}


@router.get("/by-assignee/{user_id}", response_model=list[TaskOut])
def tasks_by_assignee(user_id: str, db: Session = Depends(get_db)):
    tasks = (
        db.query(Task)
        .filter(Task.assignee_id == user_id, Task.status != TaskStatus.DRAFT)
        .order_by(Task.created_at.desc())
        .all()
    )
    return [TaskOut.model_validate(t) for t in tasks]
```

- [ ] **Step 5: Implement teams router**

`backend/app/routers/teams.py`:

```python
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.schemas import UserOut
from app.seed import DEMO_TEAM_ID

router = APIRouter(prefix="/api/teams", tags=["teams"])


@router.get("/demo/members", response_model=list[UserOut])
def list_demo_members(db: Session = Depends(get_db)):
    users = db.query(User).filter(User.team_id == DEMO_TEAM_ID).all()
    return [UserOut.model_validate(u) for u in users]
```

- [ ] **Step 6: Implement main app**

`backend/app/main.py`:

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import Base, engine, SessionLocal
from app.routers import sources, tasks, teams
from app.seed import seed_demo_data

Base.metadata.create_all(bind=engine)

app = FastAPI(title="TaskPulse API", version="0.1.0")

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


@app.on_event("startup")
def on_startup():
    db = SessionLocal()
    try:
        seed_demo_data(db)
    finally:
        db.close()


@app.get("/health")
def health():
    return {"status": "ok"}
```

- [ ] **Step 7: Run API tests**

Run: `cd backend && PYTHONPATH=. python -m pytest tests/ -v`  
Expected: PASS (all tests)

- [ ] **Step 8: Commit**

```bash
git add backend/app/main.py backend/app/routers/ backend/tests/test_api.py
git commit -m "feat: add FastAPI routes for upload, tasks, and teams"
```

---

### Task 7: Frontend scaffold

**Files:**
- Create: entire `frontend/` via Vite template + Tailwind

- [ ] **Step 1: Scaffold Vite React TypeScript app**

```bash
cd /Users/ankur/taskpulse
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install
npm install -D tailwindcss @tailwindcss/vite
npm install zustand react-router-dom
```

- [ ] **Step 2: Configure Tailwind in `frontend/vite.config.ts`**

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:8000",
    },
  },
});
```

- [ ] **Step 3: Replace `frontend/src/index.css`**

```css
@import "tailwindcss";

body {
  @apply bg-slate-50 text-slate-900 antialiased;
}
```

- [ ] **Step 4: Create types `frontend/src/types/index.ts`**

```typescript
export interface User {
  id: string;
  name: string;
  email: string;
}

export interface Task {
  id: string;
  title: string;
  assignee_id: string | null;
  assignee_hint: string | null;
  status: string;
  priority: "high" | "medium" | "low";
  due_date: string | null;
  source_ref_id: string;
  source_quote: string | null;
  created_at: string;
  updated_at: string;
}

export interface UploadResponse {
  source_id: string;
  task_count: number;
  tasks: Task[];
}
```

- [ ] **Step 5: Create API client `frontend/src/api/client.ts`**

```typescript
import type { Task, UploadResponse, User } from "../types";

const BASE = "/api";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, options);
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || res.statusText);
  }
  return res.json();
}

export const api = {
  uploadText: (text: string) => {
    const form = new FormData();
    form.append("text", text);
    return request<UploadResponse>("/sources/upload", { method: "POST", body: form });
  },

  uploadFile: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return request<UploadResponse>("/sources/upload", { method: "POST", body: form });
  },

  getTeamMembers: () => request<User[]>("/teams/demo/members"),

  updateTask: (id: string, data: Partial<Task>) =>
    request<Task>(`/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),

  assignTask: (id: string, assigneeId: string) =>
    request<Task>(`/tasks/${id}/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignee_id: assigneeId }),
    }),

  deleteTask: (id: string) =>
    request<{ success: boolean }>(`/tasks/${id}`, { method: "DELETE" }),

  getTasksByAssignee: (userId: string) =>
    request<Task[]>(`/tasks/by-assignee/${userId}`),
};
```

- [ ] **Step 6: Create Zustand store `frontend/src/store/taskStore.ts`**

```typescript
import { create } from "zustand";
import type { Task, User } from "../types";
import { api } from "../api/client";

interface TaskStore {
  tasks: Task[];
  members: User[];
  sourceId: string | null;
  loading: boolean;
  error: string | null;
  toast: string | null;
  setToast: (msg: string | null) => void;
  loadMembers: () => Promise<void>;
  extractFromText: (text: string) => Promise<void>;
  extractFromFile: (file: File) => Promise<void>;
  updateTask: (id: string, data: Partial<Task>) => Promise<void>;
  assignTask: (id: string, assigneeId: string) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  loadAssigneeTasks: (userId: string) => Promise<Task[]>;
}

export const useTaskStore = create<TaskStore>((set, get) => ({
  tasks: [],
  members: [],
  sourceId: null,
  loading: false,
  error: null,
  toast: null,

  setToast: (msg) => set({ toast: msg }),

  loadMembers: async () => {
    const members = await api.getTeamMembers();
    set({ members });
  },

  extractFromText: async (text) => {
    set({ loading: true, error: null });
    try {
      const res = await api.uploadText(text);
      set({ tasks: res.tasks, sourceId: res.source_id, loading: false });
    } catch (e) {
      set({ loading: false, error: (e as Error).message });
    }
  },

  extractFromFile: async (file) => {
    set({ loading: true, error: null });
    try {
      const res = await api.uploadFile(file);
      set({ tasks: res.tasks, sourceId: res.source_id, loading: false });
    } catch (e) {
      set({ loading: false, error: (e as Error).message });
    }
  },

  updateTask: async (id, data) => {
    const updated = await api.updateTask(id, data);
    set({
      tasks: get().tasks.map((t) => (t.id === id ? updated : t)),
    });
  },

  assignTask: async (id, assigneeId) => {
    const updated = await api.assignTask(id, assigneeId);
    const member = get().members.find((m) => m.id === assigneeId);
    set({
      tasks: get().tasks.map((t) => (t.id === id ? updated : t)),
      toast: `Task assigned to ${member?.name ?? "team member"}`,
    });
  },

  deleteTask: async (id) => {
    await api.deleteTask(id);
    set({ tasks: get().tasks.filter((t) => t.id !== id) });
  },

  loadAssigneeTasks: async (userId) => {
    return api.getTasksByAssignee(userId);
  },
}));
```

- [ ] **Step 7: Commit**

```bash
git add frontend/
git commit -m "feat: scaffold React frontend with API client and store"
```

---

### Task 8: Frontend UI components and pages

**Files:**
- Create: `frontend/src/components/*.tsx`, `frontend/src/pages/*.tsx`, update `frontend/src/App.tsx`

- [ ] **Step 1: Layout component**

`frontend/src/components/Layout.tsx`:

```tsx
import { Link, Outlet, useLocation } from "react-router-dom";
import { useTaskStore } from "../store/taskStore";

const nav = [
  { to: "/", label: "Upload" },
  { to: "/review", label: "Review Board" },
  { to: "/my-tasks", label: "My Tasks" },
];

export function Layout() {
  const location = useLocation();
  const toast = useTaskStore((s) => s.toast);
  const setToast = useTaskStore((s) => s.setToast);

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <h1 className="text-xl font-semibold text-indigo-600">TaskPulse</h1>
          <nav className="flex gap-4">
            {nav.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={
                  location.pathname === item.to
                    ? "font-medium text-indigo-600"
                    : "text-slate-600 hover:text-indigo-600"
                }
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      {toast && (
        <div className="mx-auto mt-4 max-w-5xl px-4">
          <div className="flex items-center justify-between rounded-lg bg-emerald-50 px-4 py-3 text-emerald-800">
            <span>{toast}</span>
            <button onClick={() => setToast(null)} className="text-sm underline">
              Dismiss
            </button>
          </div>
        </div>
      )}

      <main className="mx-auto max-w-5xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Upload page**

`frontend/src/pages/UploadPage.tsx`:

```tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTaskStore } from "../store/taskStore";

const SAMPLE = `Standup — June 9, 2026

Rahul: The API migration is blocked. Priya, can you review the Q3 budget proposal by Friday?
Priya: Sure. Alex, please send the client update email today.
Alex: Will do. Sam needs to schedule user interviews for next week.
Sam: I'll book five sessions by Wednesday.`;

export function UploadPage() {
  const [text, setText] = useState("");
  const { loading, error, extractFromText, extractFromFile } = useTaskStore();
  const navigate = useNavigate();

  const handleExtract = async () => {
    await extractFromText(text);
    navigate("/review");
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Extract tasks from a meeting</h2>
        <p className="mt-1 text-slate-600">
          Paste notes or upload a transcript (.txt, .vtt, .srt). Gemini will extract action items.
        </p>
      </div>

      <textarea
        className="h-48 w-full rounded-lg border border-slate-300 p-4 font-mono text-sm"
        placeholder="Paste meeting transcript..."
        value={text}
        onChange={(e) => setText(e.target.value)}
      />

      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => setText(SAMPLE)}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm"
        >
          Load sample transcript
        </button>
        <label className="cursor-pointer rounded-lg border border-slate-300 px-4 py-2 text-sm">
          Upload file
          <input
            type="file"
            accept=".txt,.vtt,.srt"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (file) {
                await extractFromFile(file);
                navigate("/review");
              }
            }}
          />
        </label>
        <button
          disabled={loading || text.trim().length < 10}
          onClick={handleExtract}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {loading ? "Extracting..." : "Extract Tasks"}
        </button>
      </div>

      {error && <p className="text-red-600">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 3: Task card + review page**

`frontend/src/components/AssigneeSelect.tsx`:

```tsx
import type { User } from "../types";

interface Props {
  members: User[];
  value: string | null;
  hint: string | null;
  onChange: (id: string) => void;
}

export function AssigneeSelect({ members, value, hint, onChange }: Props) {
  const matched = hint
    ? members.find((m) => m.name.toLowerCase().includes(hint.toLowerCase()))
    : null;

  return (
    <select
      className="rounded border border-slate-300 px-2 py-1 text-sm"
      value={value ?? matched?.id ?? ""}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">Select assignee</option>
      {members.map((m) => (
        <option key={m.id} value={m.id}>
          {m.name}
        </option>
      ))}
    </select>
  );
}
```

`frontend/src/components/TaskCard.tsx`:

```tsx
import type { Task, User } from "../types";
import { AssigneeSelect } from "./AssigneeSelect";

interface Props {
  task: Task;
  members: User[];
  onUpdate: (id: string, title: string) => void;
  onAssign: (id: string, assigneeId: string) => void;
  onDelete: (id: string) => void;
}

const priorityColor = {
  high: "bg-red-100 text-red-700",
  medium: "bg-amber-100 text-amber-700",
  low: "bg-slate-100 text-slate-600",
};

export function TaskCard({ task, members, onUpdate, onAssign, onDelete }: Props) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <input
          className="flex-1 rounded border border-transparent px-1 font-medium hover:border-slate-300 focus:border-indigo-500"
          value={task.title}
          onChange={(e) => onUpdate(task.id, e.target.value)}
        />
        <span className={`rounded px-2 py-0.5 text-xs ${priorityColor[task.priority]}`}>
          {task.priority}
        </span>
      </div>

      {task.source_quote && (
        <p className="mt-2 text-sm italic text-slate-500">"{task.source_quote}"</p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <AssigneeSelect
          members={members}
          value={task.assignee_id}
          hint={task.assignee_hint}
          onChange={(id) => onAssign(task.id, id)}
        />
        <span className="text-xs text-slate-400">{task.status}</span>
        <button
          onClick={() => onDelete(task.id)}
          className="ml-auto text-sm text-red-500 hover:underline"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
```

`frontend/src/pages/ReviewPage.tsx`:

```tsx
import { useEffect } from "react";
import { Link } from "react-router-dom";
import { TaskCard } from "../components/TaskCard";
import { useTaskStore } from "../store/taskStore";

export function ReviewPage() {
  const { tasks, members, loadMembers, updateTask, assignTask, deleteTask } = useTaskStore();

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  if (tasks.length === 0) {
    return (
      <div className="text-center">
        <p className="text-slate-600">No tasks yet.</p>
        <Link to="/" className="mt-4 inline-block text-indigo-600 underline">
          Upload a transcript
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold">Review extracted tasks</h2>
      <p className="text-slate-600">
        Edit titles, remove false positives, and assign team members before confirming.
      </p>

      <div className="space-y-3">
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            members={members}
            onUpdate={(id, title) => updateTask(id, { title })}
            onAssign={assignTask}
            onDelete={deleteTask}
          />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: My Tasks page**

`frontend/src/pages/MyTasksPage.tsx`:

```tsx
import { useEffect, useState } from "react";
import type { Task, User } from "../types";
import { useTaskStore } from "../store/taskStore";

export function MyTasksPage() {
  const { members, loadMembers, loadAssigneeTasks } = useTaskStore();
  const [selected, setSelected] = useState<string>("");
  const [tasks, setTasks] = useState<Task[]>([]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  useEffect(() => {
    if (selected) {
      loadAssigneeTasks(selected).then(setTasks);
    }
  }, [selected, loadAssigneeTasks]);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold">My Tasks</h2>
      <p className="text-slate-600">Select a team member to view their assigned tasks (demo).</p>

      <div className="flex flex-wrap gap-2">
        {members.map((m: User) => (
          <button
            key={m.id}
            onClick={() => setSelected(m.id)}
            className={
              selected === m.id
                ? "rounded-full bg-indigo-600 px-4 py-1 text-sm text-white"
                : "rounded-full border border-slate-300 px-4 py-1 text-sm"
            }
          >
            {m.name}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {tasks.map((t) => (
          <div key={t.id} className="rounded-lg border bg-white p-3">
            <p className="font-medium">{t.title}</p>
            <p className="text-xs text-slate-500">{t.status} · {t.priority}</p>
          </div>
        ))}
        {selected && tasks.length === 0 && (
          <p className="text-slate-500">No assigned tasks yet.</p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Wire up App**

`frontend/src/App.tsx`:

```tsx
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { UploadPage } from "./pages/UploadPage";
import { ReviewPage } from "./pages/ReviewPage";
import { MyTasksPage } from "./pages/MyTasksPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<UploadPage />} />
          <Route path="/review" element={<ReviewPage />} />
          <Route path="/my-tasks" element={<MyTasksPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
```

- [ ] **Step 6: Manual smoke test**

Terminal 1:
```bash
cd backend && source .venv/bin/activate && uvicorn app.main:app --reload --port 8000
```

Terminal 2:
```bash
cd frontend && npm run dev
```

1. Open http://localhost:5173
2. Click "Load sample transcript" → "Extract Tasks"
3. Verify review board shows 4+ tasks with assignee hints
4. Assign a task to Priya → see toast
5. Go to My Tasks → select Priya → see assigned task

- [ ] **Step 7: Commit**

```bash
git add frontend/src/
git commit -m "feat: add Upload, Review, and My Tasks UI"
```

---

### Task 9: Demo polish

**Files:**
- Modify: `frontend/src/pages/UploadPage.tsx`, `README.md`

- [ ] **Step 1: Add loading overlay during extraction**

In `UploadPage.tsx`, when `loading` is true, show a full-width banner:

```tsx
{loading && (
  <div className="rounded-lg bg-indigo-50 px-4 py-3 text-indigo-800">
    Gemini is extracting tasks — this may take 5–15 seconds...
  </div>
)}
```

- [ ] **Step 2: Add sample `.txt` file for file-upload demo**

Create `backend/samples/standup.txt` with the SAMPLE transcript text from UploadPage.

- [ ] **Step 3: Update README with demo script**

Add a "Demo walkthrough" section listing the 5-step smoke test above.

- [ ] **Step 4: Commit**

```bash
git add backend/samples/ README.md frontend/src/pages/UploadPage.tsx
git commit -m "docs: add demo script and loading polish"
```

---

### Task 10 (Stretch): Screenshot OCR pipeline

**Files:**
- Create: `backend/app/services/ocr.py`
- Modify: `backend/app/routers/sources.py`

- [ ] **Step 1: Implement OCR service**

`backend/app/services/ocr.py`:

```python
from PIL import Image
import pytesseract


def extract_text_from_image(image_path: str) -> str:
    image = Image.open(image_path)
    return pytesseract.image_to_string(image)
```

- [ ] **Step 2: Wire into upload route for image files**

In `sources.py`, after saving image to `storage_path`:

```python
from app.services.ocr import extract_text_from_image

# inside file branch, after saving:
if filename.lower().endswith((".png", ".jpg", ".jpeg")):
    extracted_text = extract_text_from_image(storage_path)
else:
    extracted_text = parse_transcript_file(content, filename)
```

- [ ] **Step 3: Accept images in frontend file input**

Update `accept` attribute: `.txt,.vtt,.srt,.png,.jpg,.jpeg`

- [ ] **Step 4: Commit**

```bash
git add backend/app/services/ocr.py backend/app/routers/sources.py frontend/src/pages/UploadPage.tsx
git commit -m "feat: add Tesseract OCR for screenshot uploads"
```

---

## Environment Setup Checklist

| Step | Command |
|---|---|
| Get Gemini API key | https://aistudio.google.com/apikey |
| Backend venv | `cd backend && python -m venv .venv && source .venv/bin/activate` |
| Install deps | `pip install -r requirements.txt` |
| Configure env | `cp .env.example .env` and set `GEMINI_API_KEY` |
| Run API | `uvicorn app.main:app --reload --port 8000` |
| Run UI | `cd frontend && npm run dev` |

---

## Prototype vs Full Architecture Mapping

| Architecture layer | Prototype implementation |
|---|---|
| Input layer | Upload page — paste + file drop |
| API gateway | FastAPI with CORS (no auth, no rate limit) |
| AI processing | Sync Gemini call + optional Tesseract OCR |
| Task store | SQLite via SQLAlchemy |
| Review & assignment UI | Review Board page |
| Notification engine | Toast on assign (in-app only) |
| Delivery channels | Deferred |

---

## Risk Mitigations

| Risk | Mitigation |
|---|---|
| Gemini returns invalid JSON | Retry + `response_mime_type: application/json` |
| Long transcript timeouts | Truncate to 12,000 chars for prototype; show warning in UI |
| OCR poor quality | Demo with clean screenshots only; transcript path is primary |
| No API key at demo time | Pre-record a JSON response fixture for offline fallback (optional) |

---

## Estimated Timeline (Prototype)

| Phase | Tasks | Time |
|---|---|---|
| Backend core | Tasks 1–6 | 1–2 days |
| Frontend | Tasks 7–8 | 1–2 days |
| Polish + demo prep | Task 9 | 0.5 day |
| OCR stretch | Task 10 | 0.5 day |
| **Total** | | **3–5 days** |

---

## Self-Review Checklist

- [x] Spec coverage: upload, Gemini extraction, review, assign, my-tasks — all have tasks
- [x] Gemini replaces Claude throughout
- [x] Scaling items deferred (queue, Redis, S3, email, WebSocket)
- [x] No TBD placeholders — all code blocks are complete
- [x] Type consistency: `TaskOut`, `ExtractedTask`, frontend `Task` align on field names
