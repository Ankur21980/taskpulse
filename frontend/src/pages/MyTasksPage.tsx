import { useEffect, useState } from "react";
import type { Task, User } from "../types";
import { useTaskStore } from "../store/taskStore";

export function MyTasksPage() {
  const { members, loadMembers, loadAssigneeTasks } = useTaskStore();
  const [selected, setSelected] = useState<string>("");
  const [tasks, setTasks] = useState<Task[]>([]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  useEffect(() => {
    if (selected) {
      loadAssigneeTasks(selected).then(setTasks);
    }
  }, [selected, loadAssigneeTasks]);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold">My Tasks</h2>
      <p className="text-slate-600">Select a team member to view their assigned tasks (demo).</p>

      <div className="flex flex-wrap gap-2">
        {members.map((m: User) => (
          <button
            key={m.id}
            onClick={() => setSelected(m.id)}
            className={
              selected === m.id
                ? "rounded-full bg-indigo-600 px-4 py-1 text-sm text-white"
                : "rounded-full border border-slate-300 px-4 py-1 text-sm"
            }
          >
            {m.name}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {tasks.map((t) => (
          <div key={t.id} className="rounded-lg border bg-white p-3">
            <p className="font-medium">{t.title}</p>
            <p className="text-xs text-slate-500">
              {t.status} · {t.priority}
            </p>
          </div>
        ))}
        {selected && tasks.length === 0 && (
          <p className="text-slate-500">No assigned tasks yet.</p>
        )}
      </div>
    </div>
  );
}
