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
