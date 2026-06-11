# Review History & Re-editing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add review history sidebar on the Review Board with draft/completed status, manual complete/reopen, task editing on any review, and manual task creation — backed by `review_status` on `source_documents`.

**Architecture:** Extend `source_documents` with `review_status` and `completed_at`. New list/review-status/create-task source endpoints. Auto-complete helper called from assign endpoint. Frontend sidebar component loads history; Review Page split layout with header actions.

**Tech Stack:** FastAPI, pymongo, React 19, Zustand, Tailwind CSS 4

**Design spec:** `docs/superpowers/specs/2026-06-09-review-history-design.md`

---

### Task 1: Source schema and repository layer

**Files:**
- Modify: `backend/app/enums.py`, `backend/app/schemas.py`, `backend/app/mappers.py`, `backend/app/repositories/sources.py`

- [ ] **Step 1: Add `ReviewStatus` enum to `backend/app/enums.py`**

```python
class ReviewStatus(str, enum.Enum):
    DRAFT = "draft"
    COMPLETED = "completed"
```

- [ ] **Step 2: Add schemas to `backend/app/schemas.py`**

```python
class SourceSummaryOut(BaseModel):
    id: str
    type: str
    original_filename: Optional[str] = None
    created_at: datetime
    review_status: Literal["draft", "completed"]
    completed_at: Optional[datetime] = None
    task_count: int
    draft_task_count: int
    assigned_task_count: int


class ReviewStatusUpdate(BaseModel):
    review_status: Literal["draft", "completed"]


class TaskCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    assignee_id: Optional[str] = None
    assignee_hint: Optional[str] = None
    priority: Literal["high", "medium", "low"] = "medium"
    feature_area: Optional[str] = None
    task_type: Optional[Literal["requirement", "milestone", "deliverable"]] = None
```

- [ ] **Step 3: Update `new_source_doc` in `backend/app/mappers.py`**

```python
def new_source_doc(...) -> Dict[str, Any]:
    return {
        ...
        "review_status": "draft",
        "completed_at": None,
        ...
    }


def source_doc_to_summary(doc: Dict[str, Any], task_stats: Dict[str, int]) -> SourceSummaryOut:
    return SourceSummaryOut(
        id=str(doc["_id"]),
        type=doc["type"],
        original_filename=doc.get("original_filename"),
        created_at=doc["created_at"],
        review_status=doc.get("review_status", "draft"),
        completed_at=doc.get("completed_at"),
        task_count=task_stats["task_count"],
        draft_task_count=task_stats["draft_task_count"],
        assigned_task_count=task_stats["assigned_task_count"],
    )
```

- [ ] **Step 4: Extend `backend/app/repositories/sources.py`**

```python
def list_sources(db: Database) -> List[Dict[str, Any]]:
    return list(db.source_documents.find().sort("created_at", -1))


def update_source_review_status(db: Database, source_id: str, status: str) -> Optional[Dict[str, Any]]:
    completed_at = datetime.utcnow() if status == "completed" else None
    db.source_documents.update_one(
        {"_id": source_id},
        {"$set": {"review_status": status, "completed_at": completed_at}},
    )
    return find_source_by_id(db, source_id)


def count_tasks_by_source(db: Database, source_id: str) -> Dict[str, int]:
    tasks = list(db.tasks.find({"source_ref_id": source_id}))
    draft = sum(1 for t in tasks if t["status"] == "draft")
    return {
        "task_count": len(tasks),
        "draft_task_count": draft,
        "assigned_task_count": len(tasks) - draft,
    }
```

Move `count_tasks_by_source` to `repositories/tasks.py` if preferred — keep one import path.

- [ ] **Step 5: Commit**

```bash
git add backend/app/enums.py backend/app/schemas.py backend/app/mappers.py backend/app/repositories/sources.py
git commit -m "feat: add review status schema and source repository helpers"
```

---

### Task 2: Source API endpoints

**Files:**
- Modify: `backend/app/routers/sources.py`
- Create: `backend/tests/test_review_history.py`

- [ ] **Step 1: Write failing tests in `backend/tests/test_review_history.py`**

```python
from unittest.mock import patch

MOCK_TASKS = [...]  # reuse pattern from test_api.py


@patch("app.routers.sources.extract_tasks_from_text", return_value=MOCK_TASKS)
def test_list_sources_after_upload(mock_extract, client):
    client.post("/api/sources/upload", data={"text": "Hiren will ship the dashboard by Friday."})
    response = client.get("/api/sources")
    assert response.status_code == 200
    sources = response.json()
    assert len(sources) >= 1
    assert sources[0]["review_status"] == "draft"
    assert sources[0]["task_count"] >= 1


def test_patch_review_status_completed(client):
    upload = client.post("/api/sources/upload", data={"text": "Hiren will ship the dashboard."})
    source_id = upload.json()["source_id"]
    response = client.patch(
        f"/api/sources/{source_id}/review-status",
        json={"review_status": "completed"},
    )
    assert response.status_code == 200
    assert response.json()["review_status"] == "completed"
    assert response.json()["completed_at"] is not None


def test_create_task_on_source(client):
    upload = client.post("/api/sources/upload", data={"text": "Hiren will ship the dashboard."})
    source_id = upload.json()["source_id"]
    response = client.post(
        f"/api/sources/{source_id}/tasks",
        json={"title": "Manual follow-up task", "priority": "medium"},
    )
    assert response.status_code == 200
    assert response.json()["title"] == "Manual follow-up task"
    assert response.json()["status"] == "draft"
```

- [ ] **Step 2: Run tests to verify fail**

```bash
cd backend && PYTHONPATH=. python -m pytest tests/test_review_history.py -v
```

Expected: FAIL (routes missing)

- [ ] **Step 3: Add routes to `backend/app/routers/sources.py`**

```python
@router.get("", response_model=List[SourceSummaryOut])
def list_all_sources(db: Database = Depends(get_db)):
    sources = list_sources(db)
    return [
        source_doc_to_summary(s, count_tasks_by_source(db, str(s["_id"])))
        for s in sources
    ]


@router.get("/{source_id}", response_model=SourceSummaryOut)
def get_source(source_id: str, db: Database = Depends(get_db)):
    source = find_source_by_id(db, source_id)
    if not source:
        raise HTTPException(404, "Source not found")
    return source_doc_to_summary(source, count_tasks_by_source(db, source_id))


@router.patch("/{source_id}/review-status", response_model=SourceSummaryOut)
def patch_review_status(source_id: str, payload: ReviewStatusUpdate, db: Database = Depends(get_db)):
    if not find_source_by_id(db, source_id):
        raise HTTPException(404, "Source not found")
    updated = update_source_review_status(db, source_id, payload.review_status)
    return source_doc_to_summary(updated, count_tasks_by_source(db, source_id))


@router.post("/{source_id}/tasks", response_model=TaskOut)
def create_task_on_source(source_id: str, payload: TaskCreate, db: Database = Depends(get_db)):
    if not find_source_by_id(db, source_id):
        raise HTTPException(404, "Source not found")
    status = "assigned" if payload.assignee_id else "draft"
    doc = new_task_doc(
        task_id=str(uuid.uuid4()),
        title=payload.title,
        source_ref_id=source_id,
        assignee_hint=payload.assignee_hint,
        priority=payload.priority,
        feature_area=payload.feature_area,
        task_type=payload.task_type,
    )
    doc["status"] = status
    if payload.assignee_id:
        doc["assignee_id"] = payload.assignee_id
    create_task(db, doc)
    return task_doc_to_out(doc)
```

**Note:** Register `GET ""` before `GET /{source_id}/tasks` — FastAPI route order matters; `list` route must not conflict with existing `/{source_id}/tasks`.

- [ ] **Step 4: Run tests**

```bash
cd backend && PYTHONPATH=. python -m pytest tests/test_review_history.py -v
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/routers/sources.py backend/tests/test_review_history.py
git commit -m "feat: add source list, review status, and manual task creation APIs"
```

---

### Task 3: Auto-complete review on assign

**Files:**
- Create: `backend/app/services/review_status.py`
- Modify: `backend/app/routers/tasks.py`

- [ ] **Step 1: Create `backend/app/services/review_status.py`**

```python
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
```

- [ ] **Step 2: Call from `assign_task` in `backend/app/routers/tasks.py`**

```python
from app.services.review_status import maybe_auto_complete_review

@router.post("/{task_id}/assign", ...)
def assign_task(...):
    ...
    task = find_task_by_id(db, task_id)
    updated = repo_update_task(db, task_id, {...})
    maybe_auto_complete_review(db, task["source_ref_id"])
    return task_doc_to_out(updated)
```

- [ ] **Step 3: Add test**

```python
def test_auto_complete_when_all_assigned(client):
    # upload, get tasks, assign each via POST /assign
    # assert GET /api/sources shows review_status completed
```

- [ ] **Step 4: Run full backend tests**

```bash
cd backend && PYTHONPATH=. python -m pytest tests/ -v
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/review_status.py backend/app/routers/tasks.py backend/tests/test_review_history.py
git commit -m "feat: auto-complete review when all tasks assigned"
```

---

### Task 4: Frontend types, API, and store

**Files:**
- Modify: `frontend/src/types/index.ts`, `frontend/src/api/client.ts`, `frontend/src/store/taskStore.ts`

- [ ] **Step 1: Add types**

```typescript
export interface SourceSummary {
  id: string;
  type: string;
  original_filename: string | null;
  created_at: string;
  review_status: "draft" | "completed";
  completed_at: string | null;
  task_count: number;
  draft_task_count: number;
  assigned_task_count: number;
}

export interface TaskCreatePayload {
  title: string;
  assignee_id?: string | null;
  assignee_hint?: string | null;
  priority?: "high" | "medium" | "low";
  feature_area?: string | null;
  task_type?: "requirement" | "milestone" | "deliverable" | null;
}
```

- [ ] **Step 2: Add API methods**

```typescript
  listSources: () => request<SourceSummary[]>("/sources"),
  getSource: (id: string) => request<SourceSummary>(`/sources/${id}`),
  updateReviewStatus: (id: string, review_status: "draft" | "completed") =>
    request<SourceSummary>(`/sources/${id}/review-status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ review_status }),
    }),
  createTaskOnSource: (sourceId: string, data: TaskCreatePayload) =>
    request<Task>(`/sources/${sourceId}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),
```

- [ ] **Step 3: Extend store**

```typescript
  sources: SourceSummary[];
  activeSource: SourceSummary | null;
  loadSources: () => Promise<void>;
  selectSource: (sourceId: string) => Promise<void>;
  updateReviewStatus: (sourceId: string, status: "draft" | "completed") => Promise<void>;
  addTaskToSource: (sourceId: string, data: TaskCreatePayload) => Promise<void>;
```

`selectSource` calls `loadTasksForSource` + `getSource` and sets `activeSource`.

After upload/extract, call `loadSources()` to refresh sidebar.

- [ ] **Step 4: Build**

```bash
cd frontend && npm run build
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/types/index.ts frontend/src/api/client.ts frontend/src/store/taskStore.ts
git commit -m "feat: add review history API client and store state"
```

---

### Task 5: Review history sidebar component

**Files:**
- Create: `frontend/src/components/ReviewHistorySidebar.tsx`

- [ ] **Step 1: Create sidebar component**

```tsx
type Filter = "all" | "draft" | "completed";

interface Props {
  sources: SourceSummary[];
  activeSourceId: string | null;
  filter: Filter;
  onFilterChange: (f: Filter) => void;
  onSelect: (sourceId: string) => void;
}

export function ReviewHistorySidebar({ sources, activeSourceId, filter, onFilterChange, onSelect }: Props) {
  const filtered = sources.filter((s) =>
    filter === "all" ? true : s.review_status === filter
  );

  return (
    <aside className="w-60 shrink-0 border-r border-slate-200 pr-4">
      <h3 className="text-sm font-semibold text-slate-700">Review History</h3>
      <div className="mt-2 flex gap-1">
        {(["all", "draft", "completed"] as Filter[]).map((f) => (
          <button key={f} ... onClick={() => onFilterChange(f)}>{f}</button>
        ))}
      </div>
      <ul className="mt-3 space-y-1">
        {filtered.map((s) => (
          <li key={s.id}>
            <button
              onClick={() => onSelect(s.id)}
              className={activeSourceId === s.id ? "active styles" : "..."}
            >
              <span>{s.original_filename ?? s.type}</span>
              <span className={s.review_status === "completed" ? "green" : "amber"}>
                {s.review_status}
              </span>
              <span className="text-xs">{s.task_count} tasks</span>
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/ReviewHistorySidebar.tsx
git commit -m "feat: add ReviewHistorySidebar component"
```

---

### Task 6: Review Page integration + Add Task form

**Files:**
- Create: `frontend/src/components/AddTaskForm.tsx`
- Modify: `frontend/src/pages/ReviewPage.tsx`

- [ ] **Step 1: Create `AddTaskForm.tsx`**

Inline collapsible form: title (required), priority select, optional assignee dropdown. Submit calls `addTaskToSource`.

- [ ] **Step 2: Update `ReviewPage.tsx` layout**

```tsx
<div className="flex gap-6">
  <ReviewHistorySidebar ... />
  <div className="min-w-0 flex-1">
    {activeSource && (
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2>{label}</h2>
          <span className={reviewStatusPill}>{activeSource.review_status}</span>
        </div>
        <div className="flex gap-2">
          {activeSource.review_status === "draft" ? (
            <button onClick={() => updateReviewStatus(id, "completed")}>Mark complete</button>
          ) : (
            <button onClick={() => updateReviewStatus(id, "draft")}>Reopen review</button>
          )}
          <button onClick={() => setShowAddForm(true)}>+ Add task</button>
        </div>
      </header>
    )}
    {showAddForm && <AddTaskForm onSubmit={...} onCancel={...} />}
    {/* existing task cards */}
  </div>
</div>
```

- [ ] **Step 3: Load sources on mount**

```tsx
useEffect(() => {
  loadMembers();
  loadSources();
  restoreLastSession();
}, []);
```

- [ ] **Step 4: Mobile — add History toggle**

```tsx
const [sidebarOpen, setSidebarOpen] = useState(false);
// button "History" visible on sm screens; sidebar absolute/overlay
```

- [ ] **Step 5: Build + manual smoke test**

```bash
cd frontend && npm run build
```

Manual:
1. Upload twice → sidebar shows 2 items
2. Filter Draft / Completed
3. Mark complete manually
4. Add task on completed review → stays completed
5. Reopen → draft

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/AddTaskForm.tsx frontend/src/pages/ReviewPage.tsx
git commit -m "feat: integrate review history sidebar and add-task on Review Board"
```

---

### Task 7: README update

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add demo steps**

```
9. Review Board sidebar shows all past uploads (draft/completed)
10. Mark a review complete or reopen it; add a manual task to a completed review
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add review history demo steps"
```

---

## Self-Review Checklist

- [x] Spec coverage: sidebar history, draft/completed filters, hybrid completion, manual reopen, edit on completed, add task, auto-complete
- [x] No TBD placeholders
- [x] Route order noted for FastAPI
- [x] Option B: edits on completed don't change review status
- [x] Backend + frontend tasks separated

---

## Execution Handoff

**Plan saved to** `docs/superpowers/plans/2026-06-09-review-history.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — fresh subagent per task
2. **Inline Execution** — implement in this session

Which approach?
