# TaskPulse — PRD Task Extraction Design

**Date:** 2026-06-10  
**Status:** Approved  
**Builds on:** `2026-06-10-mongodb-atlas-design.md`, `2026-06-09-taskpulse-prototype-design.md`

## Goal

Add PRD document upload (PDF/DOCX) as a **task source**. Gemini extracts actionable items (requirements, milestones, deliverables) with PRD-specific metadata and assignee hints from document owners/DRIs. Meeting transcript extraction remains unchanged.

## Decisions

| Topic | Choice |
|---|---|
| PRD role | Task source — extract tasks directly from PRD |
| UI | Same Upload page, two tabs; shared Review Board |
| Assignees | Extract `assignee_hint` when PRD names owners/DRIs/teams |
| Schema | Add `feature_area` + `task_type` for PRD tasks |
| PDF/DOC parsing | `pypdf` + `python-docx` (sync, pure Python) |
| Legacy `.doc` | Reject with clear error — user converts to `.docx` or PDF |

## Architecture

```
Upload Page
  ├── Tab: Meeting Transcript → text_parser + transcript Gemini prompt
  └── Tab: PRD Document      → prd_parser + PRD Gemini prompt
              │
              ▼
         MongoDB Atlas (source_documents + tasks)
              │
              ▼
         Review Board (shared, shows PRD badges when present)
```

## Data Model

### `source_documents.type`

Add enum value: `prd`

### `tasks` — new optional fields

| Field | Type | PRD example | Transcript |
|---|---|---|---|
| `feature_area` | string \| null | `"Authentication"` | null |
| `task_type` | string \| null | `requirement`, `milestone`, `deliverable` | null |

Existing fields unchanged: `title`, `assignee_hint`, `assignee_id`, `priority`, `due_date`, `source_quote`, `status`.

## PRD Text Extraction

**File:** `backend/app/services/prd_parser.py`

| Format | Library | Behavior |
|---|---|---|
| `.pdf` | `pypdf` | Extract text per page, join with `\n\n` |
| `.docx` | `python-docx` | Paragraphs + table cell text |
| `.doc` | — | HTTP 400: "Legacy .doc not supported. Save as .docx or PDF." |

**Truncation:** Max 30,000 characters sent to Gemini. If truncated, include `truncated: true` in API response metadata (optional field on `UploadResponse`).

**Scanned PDFs:** If extracted text < 50 chars, return HTTP 400 with message to use text-based PDF or DOCX.

## Gemini Prompts

### Transcript prompt (unchanged)

Existing `EXTRACTION_PROMPT` in `extractor.py` — no changes to output schema for transcript tasks.

### PRD prompt (new)

```
You are a PRD task extraction assistant. From this Product Requirements Document,
extract every actionable task: features, requirements, milestones, and deliverables.

Team members for assignee matching: {team_member_names}

For each task return a JSON object with:
- title (max 10 words, imperative verb)
- assignee_hint (owner/DRI/team named in PRD, or null)
- due_date (ISO 8601 or null)
- priority (high/medium/low inferred from PRD urgency)
- source_quote (originating sentence, max 20 words)
- feature_area (module/epic/section e.g. "Auth", "Payments")
- task_type (one of: requirement | milestone | deliverable)

Return only a JSON array. No preamble, no markdown.
```

`extract_tasks_from_prd(text, team_member_names)` — separate function, reuses `_gemini_request` and `parse_extraction_response` with extended `ExtractedTask` schema.

## API

### `POST /api/sources/upload` (extended)

| Input | `source_type` | Handler |
|---|---|---|
| Form `text` | `pasted_text` | transcript prompt |
| File `.txt/.vtt/.srt` | `transcript` | transcript prompt |
| File `.png/.jpg` | `screenshot` | OCR + transcript prompt |
| File `.pdf/.docx` | `prd` | prd_parser + PRD prompt |
| File `.doc` | — | 400 error |

Form field `source_mode` optional: `transcript` | `prd`. When uploading `.pdf` in PRD tab, backend uses PRD flow regardless.

### `UploadResponse` (extended)

```json
{
  "source_id": "uuid",
  "task_count": 12,
  "tasks": [...],
  "truncated": false
}
```

## Frontend

### Upload page

- Tabs: **Meeting transcript** | **PRD document**
- PRD tab: file input accepts `.pdf`, `.docx` only
- Loading message: "Extracting tasks from PRD — this may take 15–30 seconds..."
- Truncation warning banner when `truncated: true`

### Review Board / TaskCard

- Badge for `feature_area` (indigo)
- Badge for `task_type` (slate)
- Existing assignee dropdown pre-filled from `assignee_hint`

### Types

Extend `Task` and `UploadResponse` with optional `feature_area`, `task_type`, `truncated`.

## Error Handling

| Case | HTTP | Message |
|---|---|---|
| Empty/scanned PDF | 400 | Could not extract text. Use text-based PDF or DOCX. |
| Legacy `.doc` | 400 | Legacy .doc not supported. Save as .docx or PDF. |
| No tasks extracted | 400 | No actionable items found in document. |
| Gemini failure | 502 | Gemini task extraction failed: {detail} |

## Out of Scope

- OCR for scanned PDFs
- Linking PRD tasks to transcript tasks
- Multiple PRDs per project / PRD versioning
- Auto-assign without human review
- Legacy `.doc` binary parsing

## Success Criteria

- [ ] Upload `.pdf` PRD → tasks with `feature_area`, `task_type`, `assignee_hint`
- [ ] Upload `.docx` PRD → same behavior
- [ ] Transcript upload behavior unchanged
- [ ] Review Board shows PRD badges; assignee pre-filled when PRD names owner
- [ ] Page refresh restores PRD tasks from MongoDB
- [ ] All existing backend tests pass; new PRD parser tests pass

## Dependencies

```
pypdf==5.1.0
python-docx==1.1.2
```
