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
  return matchHintToMember(task.assignee_hint, members)?.id ?? null;
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
