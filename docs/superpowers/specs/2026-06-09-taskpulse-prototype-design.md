# TaskPulse Prototype — Design Spec

**Date:** 2026-06-09  
**Status:** Approved for planning (prototype scope)  
**Source:** TaskPulse_Architecture.docx v1.0

## Goal

Build a **demo-ready prototype** that shows the core TaskPulse value loop: upload or paste meeting content → Gemini extracts tasks → human reviews and assigns → assignee sees their tasks.

## Explicitly Out of Scope (Prototype)

| Full architecture item | Prototype decision |
|---|---|
| Claude API | **Google Gemini** (`gemini-2.0-flash`) |
| BullMQ / Celery / Redis | **Synchronous extraction** in HTTP request with frontend loading state |
| AWS S3 | **Local filesystem** (`backend/uploads/`) |
| PostgreSQL | **SQLite** (single file, zero infra) |
| JWT + refresh tokens | **No auth** — single demo team, hardcoded session user |
| SendGrid / SES email | **Skipped** — in-app toast only |
| Socket.io WebSocket | **Skipped** — polling or immediate UI update |
| Slack / Teams webhooks | **Skipped** |
| Google Vision OCR fallback | **Tesseract only** (screenshots optional stretch) |
| Rate limiting, encryption at rest, RBAC | **Skipped** |
| Cron overdue jobs | **Skipped** (status can be set manually for demo) |

## Recommended Approach

**Monorepo with Python FastAPI backend + React (Vite) frontend.**

Why FastAPI over Node:
- Official `google-generativeai` SDK is mature in Python
- `pytesseract` for screenshot OCR is straightforward
- SQLite + SQLAlchemy needs no Docker for local demo

Why not a single Next.js app:
- File upload + OCR + LLM is cleaner as a separate API service
- Matches the architecture doc's layered separation for future scaling

## Architecture (Prototype)

```
┌─────────────────┐     REST JSON      ┌──────────────────┐
│  React + Vite   │ ◄────────────────► │  FastAPI backend │
│  Tailwind       │                    │  Gemini extractor│
│  Zustand        │                    │  SQLite + local FS│
└─────────────────┘                    └──────────────────┘
```

### Data flow

1. User pastes text or uploads `.txt` / `.vtt` / `.srt` (screenshot optional)
2. `POST /api/sources/upload` saves file, runs extraction inline, returns `source_id` + `tasks[]`
3. Tasks persisted with `status: draft`
4. User edits tasks on review board, picks assignee from seeded team list
5. `POST /api/tasks/:id/assign` sets assignee + `status: assigned`, returns task
6. "My Tasks" view filters by assignee for demo walkthrough

### Core entities (SQLite)

- **teams** — one seeded team
- **users** — 4 seeded members (id, name, email)
- **source_documents** — upload metadata + extracted_text
- **tasks** — full schema from architecture doc (simplified FKs)

### Gemini extraction

System prompt from architecture doc §3.2, adapted for Gemini JSON mode:

- Input: normalized transcript/chat text
- Output: JSON array of `{ title, assignee_hint, due_date, priority, source_quote }`
- Parse with `json.loads`; on failure, retry once with stricter prompt

### UI screens (3)

1. **Upload** — paste area + file drop zone + "Extract Tasks" button
2. **Review Board** — editable task cards, assignee dropdown, delete, "Assign All"
3. **My Tasks** — filter by team member (tabs) to demo notifications concept

## Success Criteria (Demo)

- [ ] Paste a sample meeting transcript → 5+ tasks extracted in < 15s
- [ ] Edit task title, change assignee, assign
- [ ] Switch to "My Tasks" tab for assignee → see assigned task
- [ ] Upload works for `.txt` transcript file
- [ ] (Stretch) Screenshot upload → OCR → extraction

## Sample demo script

Use a 2-minute standup transcript with named action items for Priya, Rahul, and Alex. After extraction, assign one task each, then show each person's "My Tasks" view.
