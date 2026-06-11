# Review History & Re-editing — Design Spec

**Date:** 2026-06-09  
**Status:** Approved  
**Goal:** Let users view all past review sessions (draft/completed) in a Review Board sidebar, manually complete or reopen reviews, and edit or add tasks on any session — including completed ones.

---

## Background

TaskPulse stores each upload as a `source_document` with linked `tasks`. The Review Board today only shows the latest session via `sessionStorage`. There is no review-level status, no history list, and no API to manually add a task to an existing source.

---

## Decisions

| Topic | Choice |
|-------|--------|
| Review status storage | `review_status` + `completed_at` on `source_documents` |
| Completion model | **Hybrid (Option C):** auto-complete when all tasks assigned; manual Mark complete / Reopen |
| Re-edit completed review | **Stays completed (Option B)** until user manually changes review status |
| History UI | **Sidebar on Review Board** (not a separate page) |
| Architecture | **Approach 1** — extend `source_documents`, no new collection |

---

## Data Model

### `source_documents` (extended)

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| `review_status` | `"draft"` \| `"completed"` | `"draft"` | Review workflow status |
| `completed_at` | datetime \| null | null | Set when status becomes `completed` |

Existing fields unchanged: `_id`, `type`, `original_filename`, `storage_path`, `extracted_text`, `uploaded_by`, `created_at`.

### Task documents

No schema change. New manually added tasks use existing `new_task_doc` with `status: draft`.

---

## Review Status Transitions

| Trigger | `review_status` |
|---------|-----------------|
| Upload / extraction | `draft` |
| All tasks non-`draft` (assigned+) while review is `draft` | Auto → `completed` |
| User clicks **Mark complete** | → `completed` (even if draft tasks remain) |
| User clicks **Reopen review** | → `draft` |
| User edits or adds task on `completed` review | **Unchanged** (`completed`) |

`completed_at` is set to `utcnow()` on transition to `completed`; cleared (null) on reopen to `draft`.

---

## API

### `GET /api/sources`

List all source documents, newest first.

**Response:** `List[SourceSummaryOut]`

```python
class SourceSummaryOut(BaseModel):
    id: str
    type: str
    original_filename: Optional[str]
    created_at: datetime
    review_status: Literal["draft", "completed"]
    completed_at: Optional[datetime]
    task_count: int
    draft_task_count: int
    assigned_task_count: int
```

`assigned_task_count` = tasks where `status != "draft"`.

### `GET /api/sources/{source_id}`

Return source metadata (no full extracted text in response for list/detail; optional summary fields only).

**Response:** `SourceOut` (extends summary or same shape).

404 if not found.

### `PATCH /api/sources/{source_id}/review-status`

**Body:** `{ "review_status": "draft" | "completed" }`

Updates status and `completed_at`. Returns `SourceOut`.

### `POST /api/sources/{source_id}/tasks`

Manually add a task to an existing review.

**Body (`TaskCreate`):**

```python
class TaskCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    assignee_id: Optional[str] = None
    assignee_hint: Optional[str] = None
    priority: Literal["high", "medium", "low"] = "medium"
    feature_area: Optional[str] = None
    task_type: Optional[Literal["requirement", "milestone", "deliverable"]] = None
```

If `assignee_id` provided, create task with `status: assigned`; else `status: draft`.

**Response:** `TaskOut` (201).

Does **not** change `review_status` on the source.

### Existing endpoints (behavior changes)

| Endpoint | Change |
|----------|--------|
| `POST /api/sources/upload` | Set `review_status: draft` on new source |
| `POST /api/tasks/{id}/assign` | After assign, call auto-complete helper |
| Bulk assign (frontend parallel assigns) | Each assign triggers auto-complete check |

### Auto-complete helper

```python
def maybe_auto_complete_review(db, source_id: str) -> None:
    source = find_source_by_id(db, source_id)
    if not source or source.get("review_status") != "draft":
        return
    tasks = list_tasks_by_source(db, source_id)
    if tasks and all(t["status"] != "draft" for t in tasks):
        update_source_review_status(db, source_id, "completed")
```

---

## Frontend

### Review Board layout

```
┌──────────────────┬─────────────────────────────────────────┐
│ Review History   │  [source title]  [status pill]          │
│ [All|Draft|Done] │  [Reopen] or [Mark complete]  [+ Task]  │
│                  │                                         │
│ ○ Sprint Jun 9   │  Task cards (existing TaskCard)         │
│   draft · 4 tasks│                                         │
│ ● PRD upload     │                                         │
│   completed · 6  │                                         │
└──────────────────┴─────────────────────────────────────────┘
```

### Sidebar

- Fetch `GET /api/sources` on Review Board mount
- Filter tabs: All / Draft / Completed
- Row shows: label (filename or type + date), `review_status` badge, task count
- Click row → `loadTasksForSource(id)` + set active source
- Active row highlighted

### Main panel header

- Source label from `original_filename` or `type` + formatted `created_at`
- Review status pill (amber draft / green completed)
- **Mark complete** (when draft) → `PATCH review-status`
- **Reopen review** (when completed) → `PATCH review-status` to draft
- **+ Add task** → inline form or small modal; POST new task; append to task list

### Completed review editing

- All existing TaskCard actions work (edit title, assign, delete)
- Review status does not auto-revert to draft
- New manual tasks appear as draft tasks; user can assign normally

### Navigation

- No new nav item; history lives on Review Board only
- `sessionStorage` last source id still used; sidebar syncs on load

### Mobile

- Sidebar collapses behind a “History” toggle button (stacked layout)

---

## Error Handling

| Scenario | Behavior |
|----------|--------|
| Source not found | 404, toast error |
| Add task with empty title | Client + server validation |
| Auto-complete with zero tasks | No-op |
| Load history fails | Toast; main panel still works if tasks cached |

---

## Testing

### Backend

- `GET /api/sources` returns summaries sorted by `created_at` desc
- `PATCH review-status` sets/clears `completed_at`
- `POST /api/sources/:id/tasks` creates task linked to source
- Auto-complete fires when last draft task assigned
- Auto-complete does not run when review already `completed`
- Upload creates source with `review_status: draft`

### Manual

1. Upload twice → sidebar shows 2 reviews
2. Assign all on first → auto `completed`
3. Manually mark second complete with unassigned tasks
4. Reopen completed → `draft`
5. Open completed review → add task → review stays completed
6. Edit task title on completed review → status unchanged

---

## Out of Scope

- Delete entire review session
- Pagination
- Auth / multi-user history
- Re-run Gemini on old sources
- Full-text search across history

---

## Files to Change (implementation hint)

| Area | Files |
|------|-------|
| Backend schema | `schemas.py`, `enums.py` (optional `ReviewStatus`) |
| Backend repos | `repositories/sources.py` |
| Backend routes | `routers/sources.py`, `routers/tasks.py` |
| Backend mappers | `mappers.py` |
| Backend tests | `test_api.py`, new `test_review_status.py` |
| Frontend types | `types/index.ts` |
| Frontend API | `api/client.ts` |
| Frontend store | `taskStore.ts` |
| Frontend UI | `ReviewPage.tsx`, new `ReviewHistorySidebar.tsx`, `AddTaskForm.tsx` |
