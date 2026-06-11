# Upload Team Selection & Smart Assignment — Design Spec

**Date:** 2026-06-09  
**Status:** Approved  
**Goal:** Let users pick which team members are eligible for assignment when uploading a transcript or PRD; named owners in the document are always assigned to that person; unnamed tasks are assigned by role among the checked members only.

---

## Background

Today, upload always passes all demo team members to Gemini. Tasks are created with `assignee_hint` only (`assignee_id` null). Users manually pick assignees on the Review Board. There is no upload-time scoping of who can receive tasks.

---

## Decisions

| Topic | Choice |
|-------|--------|
| Architecture | **Approach 1** — single Gemini call + backend resolver |
| Unnamed task distribution | **Role-based** among checked members only |
| Named owner not in checkbox list | **Still assign to named person** (checkbox = pool for unnamed only) |
| Task status at extraction | **`draft`** with `assignee_id` pre-filled |
| Review Board confirm flow | Unchanged — user clicks **Assign** to commit |
| Default checkbox state | All team members checked |
| Minimum selection | At least 1 member required to extract |

---

## User Flow

1. User opens Upload page (transcript or PRD tab).
2. **Team for this sprint** section shows all demo members with checkboxes (name + role); all checked by default.
3. User unchecks members who should not receive unnamed tasks (e.g. intern on leave).
4. User uploads/pastes content and clicks **Extract Tasks**.
5. Backend extracts tasks via Gemini, resolves `assignee_id` per rules below.
6. Review Board opens with assignee dropdowns pre-selected; user edits if needed and clicks **Assign**.

---

## Assignment Rules

### Named in document

- If transcript/PRD names an owner (e.g. "Owner: Prerana", "Hiren will ship…"), task is assigned to that team member.
- Applies even if that person is **unchecked** in the upload checklist.
- Resolver matches `assignee_hint` from Gemini against full team list (case-insensitive substring).

### Unnamed tasks

- Gemini must pick `assignee_hint` from **eligible (checked) members only**, using role fit:
  - Frontend/UI work → FrontEnd Engineers
  - API/backend work → Backend Engineer
  - Tests, docs, starter tasks → Intern
- Backend validates hint is in eligible list; if invalid or null, applies role fallback heuristics on eligible members only.

### Role fallback (backend)

When Gemini leaves a task unassigned or assigns someone outside the eligible list for an unnamed task:

| Signal in title/quote | Prefer |
|-----------------------|--------|
| api, backend, auth, database, endpoint | Backend Engineer |
| ui, frontend, page, component, layout | FrontEnd Engineer (senior first: 4yr → 1yr) |
| test, unit, documentation | Intern |
| default | First eligible member by role priority |

---

## Upload UI

### Component: `TeamMemberPicker`

Placed above Extract button on **both** transcript and PRD tabs.

```
Team for this sprint
☑ Hiren Chafekar — FrontEnd Engineer
☑ Prerana Shukla — Backend Engineer
☑ Anisha Kumari — FrontEnd Engineer
☑ Gowtham L — Intern

Named owners in the document are always assigned to that person.
Unnamed tasks are assigned by role among checked members.
```

- Load members from existing `GET /api/teams/demo/members`.
- `eligibleMemberIds` state: `Set<string>`, initialized to all IDs.
- Extract disabled if text/file invalid **or** zero members checked.

---

## API Changes

### `POST /api/sources/upload`

Add optional form field:

```
eligible_member_ids: string  # JSON array of user IDs, e.g. '["uuid1","uuid2"]'
```

- If omitted, default to all demo team members (backward compatible).
- If empty array → HTTP 400: "Select at least one team member".
- Validate each ID exists in demo team.

### Gemini prompts (`extractor.py`)

Add to both transcript and PRD prompts:

```
Eligible team for UNNAMED tasks only (assign by role fit): {eligible_members}
Full team for NAMED owner matching: {all_members}

Rules:
- If document names an owner, set assignee_hint to their full name (match full team list).
- If no owner named, set assignee_hint to the best-fit person from the ELIGIBLE list only.
- Never assign unnamed tasks to people outside the eligible list.
```

Pass two member lists: `eligible_members` (checked) and `all_members` (full team).

---

## Data Model

### `source_documents` (extend)

```python
eligible_assignee_ids: List[str]  # user IDs checked at upload
```

Stored in `new_source_doc` from upload payload.

### `tasks` (behavior change)

On creation after extraction:

```python
assignee_id: Optional[str]  # pre-filled by resolver when matched
assignee_hint: Optional[str]  # display name from Gemini or resolver
status: "draft"  # unchanged until Review Board Assign
```

---

## Backend Resolver

**New file:** `backend/app/services/assignment_resolver.py`

```python
def resolve_task_assignments(
    tasks: List[ExtractedTask],
    all_members: List[dict],
    eligible_ids: List[str],
) -> List[ResolvedAssignment]:
    """
    Returns assignee_id + assignee_hint per task.
    Named match uses all_members.
    Unnamed fallback uses only eligible_ids members.
    """
```

Called from `upload_source` after Gemini extraction, before `new_task_doc` + `create_task`.

**Name matching:** `member.name.lower()` contains `hint.lower()` or vice versa.

---

## Review Board

- `AssigneeSelect` already prefers `task.assignee_id` over hint match — pre-filled IDs show correctly.
- No new UI required beyond Upload picker.
- Optional: show eligible team count in review header from `activeSource.eligible_assignee_ids` (future polish).

---

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Zero members checked | 400 on upload |
| Invalid member ID in payload | 400 |
| Gemini returns hint for non-team member on unnamed task | Resolver reassigns via role fallback among eligible |
| Named person not in database | `assignee_hint` kept, `assignee_id` null — Review Board manual fix |

---

## Testing

### Backend

- Upload with subset of eligible IDs → unnamed tasks only get hints from that subset
- Upload with named "Prerana" but Prerana unchecked → still gets Prerana
- Resolver role fallback for null hints
- Default (no field) → all members eligible

### Manual

1. Uncheck Gowtham → extract PRD → no unnamed task assigned to Gowtham
2. Transcript names Hiren → Hiren pre-selected even if unchecked
3. Review Board → Assign confirms pre-selection

---

## Out of Scope

- Auto `assigned` status at extraction
- Per-task eligibility override on Upload
- Workload balancing / task count caps per person
- Re-run assignment when reopening old reviews

---

## Files to Change

| File | Change |
|------|--------|
| `backend/app/services/assignment_resolver.py` | New resolver |
| `backend/app/services/extractor.py` | Dual member lists in prompts |
| `backend/app/routers/sources.py` | Accept `eligible_member_ids`, call resolver |
| `backend/app/mappers.py` | `eligible_assignee_ids` on source doc |
| `backend/app/schemas.py` | Optional `eligible_assignee_ids` on `SourceSummaryOut` |
| `backend/tests/test_assignment_resolver.py` | New tests |
| `backend/tests/test_api.py` | Upload with eligible IDs |
| `frontend/src/components/TeamMemberPicker.tsx` | New checkbox list |
| `frontend/src/pages/UploadPage.tsx` | Integrate picker, pass IDs on extract |
| `frontend/src/api/client.ts` | Append `eligible_member_ids` to upload FormData |
| `frontend/src/store/taskStore.ts` | Pass eligible IDs through extract methods |
