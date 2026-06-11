# Review Board Assignment UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-card **Assign** and global **Assign all** buttons on the Review Board with staged assignee dropdowns, status pills, and red highlighting for tasks missing assignees after bulk assign.

**Architecture:** Pure `resolveAssignee` helper resolves staged → saved → hint match. ReviewPage owns `pendingAssignees` and `highlightUnassigned` state. TaskCard renders Assign button and highlight styling. Existing `POST /api/tasks/:id/assign` is reused; no backend changes.

**Tech Stack:** React 19, Zustand, TypeScript, Tailwind CSS 4, existing FastAPI assign endpoint

**Design spec:** `docs/superpowers/specs/2026-06-09-review-board-assign-design.md`

---

### Task 1: Assignee resolution utility

**Files:**
- Create: `frontend/src/utils/assignee.ts`

- [ ] **Step 1: Create `frontend/src/utils/assignee.ts`**

```typescript
import type { Task, User } from "../types";

export function matchHintToMember(hint: string | null, members: User[]): User | null {
  if (!hint) return null;
  const lower = hint.toLowerCase();
  return members.find((m) => m.name.toLowerCase().includes(lower)) ?? null;
}

export function resolveAssigneeId(
  task: Task,
  pendingAssignees: Record<string, string>,
  members: User[]
): string | null {
  if (pendingAssignees[task.id]) {
    return pendingAssignees[task.id];
  }
  if (task.assignee_id) {
    return task.assignee_id;
  }
  const matched = matchHintToMember(task.assignee_hint, members);
  return matched?.id ?? null;
}

export function planBulkAssign(
  tasks: Task[],
  pendingAssignees: Record<string, string>,
  members: User[]
): { toAssign: { taskId: string; assigneeId: string }[]; toHighlight: string[] } {
  const toAssign: { taskId: string; assigneeId: string }[] = [];
  const toHighlight: string[] = [];

  for (const task of tasks) {
    if (task.status !== "draft") continue;
    const assigneeId = resolveAssigneeId(task, pendingAssignees, members);
    if (assigneeId) {
      toAssign.push({ taskId: task.id, assigneeId });
    } else {
      toHighlight.push(task.id);
    }
  }

  return { toAssign, toHighlight };
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd frontend && npm run build
```

Expected: PASS (file is imported in Task 2; for now add a temporary import in ReviewPage or run build after Task 2)

- [ ] **Step 3: Commit**

```bash
git add frontend/src/utils/assignee.ts
git commit -m "feat: add assignee resolution helpers for Review Board"
```

---

### Task 2: Stage assignee in dropdown (no auto-commit)

**Files:**
- Modify: `frontend/src/components/AssigneeSelect.tsx`
- Modify: `frontend/src/components/TaskCard.tsx`
- Modify: `frontend/src/pages/ReviewPage.tsx`

- [ ] **Step 1: Update `AssigneeSelect` to support disabled state**

```tsx
interface Props {
  members: User[];
  value: string | null;
  hint: string | null;
  disabled?: boolean;
  onChange: (id: string) => void;
}

export function AssigneeSelect({ members, value, hint, disabled = false, onChange }: Props) {
  const matched = hint
    ? members.find((m) => m.name.toLowerCase().includes(hint.toLowerCase()))
    : null;

  return (
    <select
      className="rounded border border-slate-300 px-2 py-1 text-sm disabled:bg-slate-50 disabled:text-slate-500"
      value={value ?? matched?.id ?? ""}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">Select assignee</option>
      {members.map((m) => (
        <option key={m.id} value={m.id}>
          {m.role ? `${m.name} — ${m.role}` : m.name}
        </option>
      ))}
    </select>
  );
}
```

- [ ] **Step 2: Update `TaskCard` props and staging handler**

Replace `onAssign` immediate-commit with staged selection + explicit Assign button:

```tsx
interface Props {
  task: Task;
  members: User[];
  pendingAssigneeId: string | null;
  highlighted: boolean;
  onStageAssignee: (taskId: string, assigneeId: string) => void;
  onAssign: (taskId: string, assigneeId: string) => void;
  onUpdate: (id: string, title: string) => void;
  onDelete: (id: string) => void;
}

const statusStyles = {
  draft: "bg-amber-100 text-amber-800",
  assigned: "bg-green-100 text-green-800",
};

export function TaskCard({
  task,
  members,
  pendingAssigneeId,
  highlighted,
  onStageAssignee,
  onAssign,
  onUpdate,
  onDelete,
}: Props) {
  const isAssigned = task.status === "assigned";
  const resolvedId =
    pendingAssigneeId ??
    task.assignee_id ??
    (task.assignee_hint
      ? members.find((m) =>
          m.name.toLowerCase().includes(task.assignee_hint!.toLowerCase())
        )?.id ?? null
      : null);

  const cardClass = highlighted
    ? "rounded-lg border-2 border-red-400 bg-red-50 p-4 shadow-sm"
    : "rounded-lg border border-slate-200 bg-white p-4 shadow-sm";

  return (
    <div className={cardClass}>
      {/* ... title, priority, source_quote, feature_area badges unchanged ... */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <AssigneeSelect
          members={members}
          value={pendingAssigneeId ?? task.assignee_id}
          hint={task.assignee_hint}
          disabled={isAssigned}
          onChange={(id) => onStageAssignee(task.id, id)}
        />
        {!isAssigned && (
          <button
            disabled={!resolvedId}
            onClick={() => resolvedId && onAssign(task.id, resolvedId)}
            className="rounded-lg bg-indigo-600 px-3 py-1 text-sm font-medium text-white disabled:opacity-50"
          >
            Assign
          </button>
        )}
        <span
          className={`rounded px-2 py-0.5 text-xs capitalize ${
            statusStyles[task.status as keyof typeof statusStyles] ?? "bg-slate-100 text-slate-600"
          }`}
        >
          {task.status}
        </span>
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

- [ ] **Step 3: Update `ReviewPage` with pending state**

```tsx
import { useEffect, useState } from "react";
import { resolveAssigneeId } from "../utils/assignee";

export function ReviewPage() {
  const { tasks, members, loading, loadMembers, updateTask, assignTask, deleteTask, restoreLastSession, setToast } =
    useTaskStore();

  const [pendingAssignees, setPendingAssignees] = useState<Record<string, string>>({});
  const [highlightUnassigned, setHighlightUnassigned] = useState<Set<string>>(new Set());

  const handleStageAssignee = (taskId: string, assigneeId: string) => {
    setPendingAssignees((prev) => ({ ...prev, [taskId]: assigneeId }));
    setHighlightUnassigned((prev) => {
      const next = new Set(prev);
      next.delete(taskId);
      return next;
    });
  };

  const handleAssign = async (taskId: string, assigneeId: string) => {
    await assignTask(taskId, assigneeId);
    setPendingAssignees((prev) => {
      const next = { ...prev };
      delete next[taskId];
      return next;
    });
  };

  const draftCount = tasks.filter((t) => t.status === "draft").length;

  // ... existing loading/empty states ...

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold">Review extracted tasks</h2>
          <p className="text-slate-600">
            Pick assignees, then click Assign or Assign all to confirm.
          </p>
        </div>
        {/* Assign all button added in Task 3 */}
      </div>
      <div className="space-y-3">
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            members={members}
            pendingAssigneeId={pendingAssignees[task.id] ?? null}
            highlighted={highlightUnassigned.has(task.id)}
            onStageAssignee={handleStageAssignee}
            onAssign={handleAssign}
            onUpdate={(id, title) => updateTask(id, { title })}
            onDelete={deleteTask}
          />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Build**

```bash
cd frontend && npm run build
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/AssigneeSelect.tsx frontend/src/components/TaskCard.tsx frontend/src/pages/ReviewPage.tsx
git commit -m "feat: add per-card Assign button with staged assignee dropdown"
```

---

### Task 3: Global Assign all button

**Files:**
- Modify: `frontend/src/pages/ReviewPage.tsx`
- Modify: `frontend/src/store/taskStore.ts`

- [ ] **Step 1: Add `assignAllTasks` to store**

In `taskStore.ts`:

```typescript
  assignAllTasks: (
    items: { taskId: string; assigneeId: string }[]
  ) => Promise<{ succeeded: number; failed: number }>;

  assignAllTasks: async (items) => {
    let succeeded = 0;
    let failed = 0;
    const results = await Promise.allSettled(
      items.map((item) => api.assignTask(item.taskId, item.assigneeId))
    );
    const updatedById = new Map<string, Task>();
    results.forEach((result, i) => {
      if (result.status === "fulfilled") {
        succeeded += 1;
        updatedById.set(items[i].taskId, result.value);
      } else {
        failed += 1;
      }
    });
    if (updatedById.size > 0) {
      set({
        tasks: get().tasks.map((t) => updatedById.get(t.id) ?? t),
      });
    }
    return { succeeded, failed };
  },
```

- [ ] **Step 2: Wire Assign all in ReviewPage**

```tsx
import { planBulkAssign } from "../utils/assignee";

  const { assignAllTasks, setToast } = useTaskStore();

  const handleAssignAll = async () => {
    const { toAssign, toHighlight } = planBulkAssign(tasks, pendingAssignees, members);
    setHighlightUnassigned(new Set(toHighlight));

    if (toAssign.length === 0) {
      setToast(
        toHighlight.length > 0
          ? `0 of ${toHighlight.length} draft tasks assigned — all need an assignee`
          : "No draft tasks to assign"
      );
      return;
    }

    const { succeeded, failed } = await assignAllTasks(toAssign);
    setPendingAssignees((prev) => {
      const next = { ...prev };
      toAssign.forEach(({ taskId }) => delete next[taskId]);
      return next;
    });

    const skipped = toHighlight.length;
    const total = toAssign.length + skipped;
    if (failed > 0) {
      setToast(`Assigned ${succeeded} of ${total} tasks (${failed} failed, ${skipped} need an assignee)`);
    } else if (skipped > 0) {
      setToast(`Assigned ${succeeded} of ${total} tasks — ${skipped} need an assignee`);
    } else {
      setToast(`Assigned ${succeeded} tasks`);
    }
  };

  // In header JSX:
  <button
    disabled={draftCount === 0}
    onClick={handleAssignAll}
    className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
  >
    Assign all
  </button>
```

- [ ] **Step 3: Build**

```bash
cd frontend && npm run build
```

Expected: PASS

- [ ] **Step 4: Manual smoke test**

1. Extract sample transcript
2. Pick assignees on 2 of 4 cards (do not click per-card Assign)
3. Click **Assign all** → toast partial count, unassigned cards red
4. Pick assignee on red card → red clears
5. Click per-card **Assign** on one task → status turns green

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/ReviewPage.tsx frontend/src/store/taskStore.ts
git commit -m "feat: add global Assign all with partial assign highlighting"
```

---

## Self-Review Checklist

- [x] Spec coverage: per-card Assign, staged dropdown, global Assign all, Option C partial + red highlight, status pills, toast messages
- [x] No TBD placeholders
- [x] Type consistency: `resolveAssigneeId`, `planBulkAssign`, store `assignAllTasks` signatures align
- [x] No backend changes (spec requirement)
- [x] Dropdown no longer auto-commits on change (spec requirement)

---

## Execution Handoff

**Plan saved to** `docs/superpowers/plans/2026-06-09-review-board-assign.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks
2. **Inline Execution** — implement task-by-task in this session with checkpoints

Which approach?
