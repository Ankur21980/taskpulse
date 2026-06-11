# Review Board Assignment UX — Design Spec

**Date:** 2026-06-09  
**Status:** Approved  
**Goal:** Add explicit per-card and global **Assign** actions on the Review Board so users can stage assignee picks and commit tasks from `draft` → `assigned` with clear visual feedback.

---

## Background

Today, selecting an assignee in the dropdown immediately calls `POST /api/tasks/:id/assign`, which sets `assignee_id` and `status: assigned`. Status is shown as small gray text with no prominent assign action. Users want:

1. A visible **Assign** button per task card
2. A global **Assign all** button to commit multiple tasks after picking assignees
3. Partial bulk assign with red highlighting on tasks still missing an assignee

---

## Decisions

| Topic | Choice |
|-------|--------|
| Dropdown behavior | **Stage locally** — no API call on change |
| Per-card commit | **Assign** button calls existing assign API |
| Bulk commit | **Assign all** in Review Board header |
| Tasks without assignee on bulk | **Assign ready tasks; highlight unassigned cards in red** (Option C) |
| Backend changes | **None** — reuse `POST /api/tasks/:id/assign` |
| Re-assign assigned tasks via bulk | Out of scope |

---

## User Flow

### Per-card assign

1. User opens Review Board after extraction (all tasks start as `draft`).
2. User picks an assignee from the dropdown on a card (staged in local state; includes hint auto-match as default display).
3. User clicks **Assign** on that card.
4. API assigns the task; card shows green `assigned` status; **Assign** button hides or disables.

### Bulk assign

1. User picks assignees on multiple cards via dropdowns (staging only).
2. User clicks **Assign all** in the page header.
3. For each **draft** task, resolve assignee in order: staged selection → existing `assignee_id` → hint match against team members.
4. Tasks with a resolved assignee: call assign API in parallel (`Promise.allSettled`).
5. Tasks without assignee: skipped; card gets red border + light red background.
6. Toast: `Assigned 4 of 6 tasks — 2 need an assignee` (counts reflect actual results).
7. Red highlight persists until user selects an assignee or deletes the task.

---

## UI Specification

### Review Board header

- Title and existing subtitle remain.
- Add **Assign all** button (primary/indigo) aligned right of the header row.
- **Disabled** when zero draft tasks exist.
- **Enabled** when at least one draft task exists.

### TaskCard

| Element | Draft state | Assigned state |
|---------|-------------|----------------|
| Assignee dropdown | Staged selection; hint auto-match as default | Shows assigned member (read-only or disabled dropdown) |
| **Assign** button | Enabled when assignee resolved | Hidden or disabled |
| Status pill | Amber `draft` | Green `assigned` |
| Red highlight | After bulk assign skip | N/A (assigned cards not highlighted) |

**Assignee resolution order** (for enabling Assign / bulk):

1. `pendingAssignees[taskId]` from dropdown staging
2. `task.assignee_id` (if already set)
3. Hint match: first team member whose name contains `assignee_hint` (case-insensitive)

### Toast messages

- Per-card assign: existing — `Task assigned to {name}`
- Bulk partial: `Assigned {n} of {total} tasks — {skipped} need an assignee`
- Bulk full success: `Assigned {n} tasks`
- Per-card failure: `Could not assign "{title}"`

---

## Frontend State

Add to Review Page scope (or Zustand store if cleaner):

```typescript
pendingAssignees: Record<string, string>   // taskId → staged assigneeId
highlightUnassigned: Set<string>         // taskIds missing assignee after bulk attempt
```

**Clearing highlight:** When user stages a new assignee on a highlighted card, remove that taskId from `highlightUnassigned`.

No new API client methods required.

---

## API

Reuse existing endpoint:

```
POST /api/tasks/{task_id}/assign
Body: { "assignee_id": "<uuid>" }
Response: TaskOut with status "assigned"
```

Bulk assign fires N parallel requests from the frontend. No batch endpoint for prototype scope.

---

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Assign with no resolved assignee | Per-card: button stays disabled. Bulk: skip + highlight. |
| API failure on single assign | Toast error; card stays draft |
| API failure on some bulk assigns | Toast reports success/fail counts; failed cards stay draft |
| All tasks already assigned | **Assign all** disabled |

---

## Testing

### Manual

1. Extract sample transcript → Review Board shows draft tasks.
2. Pick assignee on one card → click **Assign** → status green, appears in My Tasks.
3. Pick assignees on 3 of 5 cards → **Assign all** → toast `3 of 5`, 2 cards red-highlighted.
4. Pick assignee on highlighted card → red clears on selection.
5. Refresh page → assigned tasks persist from MongoDB.

### Automated (optional, frontend logic)

- `resolveAssignee(task, pending, members)` returns assigneeId or null
- Bulk planner: given task list, returns `{ toAssign, toHighlight }`

---

## Out of Scope

- Batch assign API endpoint
- Re-assigning already-assigned tasks via bulk
- Undo / revert assign
- Auth or permission checks on who can assign

---

## Files to Change (implementation hint)

| File | Change |
|------|--------|
| `frontend/src/pages/ReviewPage.tsx` | Header **Assign all**, state for pending/highlight, bulk handler |
| `frontend/src/components/TaskCard.tsx` | Assign button, status pills, highlight styling, staged dropdown |
| `frontend/src/components/AssigneeSelect.tsx` | Support controlled staging without auto-commit |
| `frontend/src/store/taskStore.ts` | Optional: `assignAllTasks` helper |
| `frontend/src/utils/assignee.ts` | `resolveAssignee` helper (new, small) |

No backend changes.
