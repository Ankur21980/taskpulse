# TaskPulse — MongoDB Atlas Migration Design

**Date:** 2026-06-10  
**Status:** Approved  
**Replaces:** SQLite storage in prototype design (`2026-06-09-taskpulse-prototype-design.md` § storage)  
**Approach:** Option B — **pymongo (sync driver)**

## Goal

Move all persistent data (teams, users, source documents, tasks) from local SQLite to **MongoDB Atlas**, and fix the frontend so the Review Board survives page refresh.

## Decisions (from brainstorming)

| Question | Choice |
|---|---|
| MongoDB hosting | **MongoDB Atlas** (cloud) |
| Existing SQLite data | **Fresh start** — seed demo data in Atlas |
| Page refresh fix | **Yes** — reload tasks from API via `sessionStorage` |
| Driver / ODM | **pymongo sync** — minimal refactor from current SQLAlchemy code |

## Architecture

```
React (Zustand + sessionStorage)
        │  REST JSON (unchanged API contract)
        ▼
FastAPI (sync route handlers)
        │
        ▼
pymongo MongoClient ──► MongoDB Atlas (taskpulse DB)
        │
Local FS (backend/uploads/)  ← uploaded file binaries only
```

SQLite (`taskpulse.db`) is **removed**. Uploaded files remain on disk; metadata and extracted text live in MongoDB.

## MongoDB Collections

### `teams`

```json
{
  "_id": "00000000-0000-0000-0000-000000000001",
  "name": "Product Team"
}
```

### `users`

```json
{
  "_id": "00000000-0000-0000-0000-000000000010",
  "name": "Rahul Kapoor",
  "email": "rahul@demo.taskpulse.io",
  "team_id": "00000000-0000-0000-0000-000000000001"
}
```

### `source_documents`

```json
{
  "_id": "<uuid>",
  "type": "pasted_text | transcript | screenshot",
  "original_filename": null,
  "storage_path": null,
  "extracted_text": "...",
  "uploaded_by": null,
  "created_at": "2026-06-10T12:00:00"
}
```

### `tasks`

```json
{
  "_id": "<uuid>",
  "title": "Review Q3 budget",
  "assignee_id": null,
  "assignee_hint": "Priya",
  "status": "draft",
  "priority": "medium",
  "due_date": null,
  "source_ref_id": "<source uuid>",
  "source_quote": "...",
  "created_at": "2026-06-10T12:00:00",
  "updated_at": "2026-06-10T12:00:00"
}
```

### Indexes (created on startup)

| Collection | Index |
|---|---|
| `tasks` | `{ source_ref_id: 1 }` |
| `tasks` | `{ assignee_id: 1, status: 1 }` |
| `users` | `{ team_id: 1 }` |

`_id` is the API `id` (UUID string) for all collections.

## Backend Design

### New env vars

```env
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/?retryWrites=true&w=majority
MONGODB_DB_NAME=taskpulse
```

Remove `DATABASE_URL` (SQLite).

### File responsibilities

| File | Responsibility |
|---|---|
| `app/config.py` | `mongodb_uri`, `mongodb_db_name` settings |
| `app/database.py` | `MongoClient` singleton, `get_db()` dependency, `get_database()`, index creation |
| `app/enums.py` | `TaskStatus`, `TaskPriority`, `SourceType` (moved from SQLAlchemy models) |
| `app/mappers.py` | Convert MongoDB documents ↔ Pydantic `TaskOut` / `UserOut` |
| `app/repositories/teams.py` | Team queries |
| `app/repositories/users.py` | User queries |
| `app/repositories/sources.py` | Source document CRUD |
| `app/repositories/tasks.py` | Task CRUD |
| `app/seed.py` | Insert demo team + 4 users if `teams` is empty |
| `app/routers/*.py` | Call repositories instead of SQLAlchemy |
| `app/main.py` | Connect on startup, seed, health check with DB ping |

### Removed

- `sqlalchemy` from `requirements.txt`
- `backend/taskpulse.db` (gitignored, deleted locally)
- SQLAlchemy `models.py` ORM classes

### API contract

**Unchanged** — same endpoints and JSON response shapes:

- `POST /api/sources/upload`
- `GET /api/sources/:id/tasks`
- `PATCH /api/tasks/:id`
- `POST /api/tasks/:id/assign`
- `PATCH /api/tasks/:id/status`
- `DELETE /api/tasks/:id`
- `GET /api/tasks/by-assignee/:user_id`
- `GET /api/teams/demo/members`
- `GET /health` → `{ "status": "ok", "db": "connected" }`

## Frontend Design (refresh fix)

### Problem

Zustand state resets on refresh. MongoDB has the data but Review Board never refetches it.

### Solution

1. **On extract success** — save `source_id` to `sessionStorage` key `taskpulse:lastSourceId`
2. **On Review Board mount** — if `tasks` is empty and `lastSourceId` exists, call `GET /api/sources/:id/tasks`
3. **New API client method** — `getSourceTasks(sourceId)`
4. **New store action** — `loadTasksForSource(sourceId)`

My Tasks already fetches from API — no change.

### Error handling

| Case | Behavior |
|---|---|
| Atlas unreachable at startup | Log error; `/health` returns `db: disconnected` |
| Invalid `MONGODB_URI` | Startup fails with clear message |
| Source not found on reload | Clear `sessionStorage`; show upload prompt |
| Atlas IP not whitelisted | 503 with hint to add IP in Atlas Network Access |

## Out of Scope

- SQLite → Atlas data migration script
- GridFS for file storage
- Authentication / multi-tenant teams
- Notification history in MongoDB
- Beanie / Motor async ODM

## Success Criteria

- [ ] All task/user/source CRUD works against Atlas (not SQLite)
- [ ] Demo seed creates team + 4 users on first Atlas connection
- [ ] Extract → Review → Assign → My Tasks works end-to-end
- [ ] Refresh on Review Board restores tasks from Atlas
- [ ] Backend restart does not lose data
- [ ] `taskpulse.db` no longer created or used

## Atlas Setup (manual, one-time)

1. Create free cluster at https://cloud.mongodb.com
2. Database Access → create user with read/write on `taskpulse`
3. Network Access → add current IP (or `0.0.0.0/0` for dev only)
4. Connect → copy connection string → paste into `backend/.env`
