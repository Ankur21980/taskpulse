import { useEffect, useState } from "react";
import { Circle, ListChecks, User } from "lucide-react";
import type { Task, User as TeamUser } from "../types";
import { useTaskStore } from "../store/taskStore";
import { cn } from "@/lib/utils";

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
    } else {
      setTasks([]);
    }
  }, [selected, loadAssigneeTasks]);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-start gap-4">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[#2563eb]">
          <ListChecks className="size-5 text-white" />
        </div>
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-bold leading-8 text-white">My Tasks</h2>
          <p className="text-sm leading-5 text-[#9ca3af]">
            Select a team member to view their assigned tasks (demo).
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium tracking-wider text-[#6b7280] uppercase">
            Team Members
          </span>
          <span className="text-xs text-[#6b7280]">{members.length} members</span>
        </div>

        <div className="flex flex-row flex-wrap gap-3">
          {members.map((m: TeamUser) => {
            const active = selected === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setSelected(m.id)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm transition-colors",
                  active
                    ? "bg-[#2563eb] text-white"
                    : "border border-[#2a2a2a] bg-[#1a1a1a] text-[#d1d5db] hover:bg-[#222222]"
                )}
              >
                <User className="size-4 shrink-0 opacity-80" />
                <span>
                  {m.name}
                  {m.role ? ` · ${m.role}` : ""}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">Assigned Tasks</h3>
          <span className="rounded-full bg-[#1a1a1a] px-3 py-1 text-xs text-[#9ca3af]">
            # {tasks.length} tasks
          </span>
        </div>

        <div className="flex max-h-[540px] flex-col gap-3 overflow-y-auto pr-2">
          {tasks.map((t) => (
            <div
              key={t.id}
              className="flex items-center gap-4 rounded-lg border-0 bg-[#1a1a1a] p-4"
            >
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#252525]">
                <Circle className="size-4 text-[#6b7280]" />
              </div>
              <p className="text-sm leading-6 text-white">{t.title}</p>
            </div>
          ))}
          {selected && tasks.length === 0 && (
            <p className="text-sm text-[#9ca3af]">No assigned tasks yet.</p>
          )}
          {!selected && (
            <p className="text-sm text-[#9ca3af]">Select a team member to see their tasks.</p>
          )}
        </div>
      </div>
    </div>
  );
}
