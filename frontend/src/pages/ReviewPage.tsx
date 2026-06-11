import { useEffect } from "react";
import { Link } from "react-router-dom";
import { TaskCard } from "../components/TaskCard";
import { useTaskStore } from "../store/taskStore";

export function ReviewPage() {
  const { tasks, members, loadMembers, updateTask, assignTask, deleteTask } = useTaskStore();

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  if (tasks.length === 0) {
    return (
      <div className="text-center">
        <p className="text-slate-600">No tasks yet.</p>
        <Link to="/" className="mt-4 inline-block text-indigo-600 underline">
          Upload a transcript
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold">Review extracted tasks</h2>
      <p className="text-slate-600">
        Edit titles, remove false positives, and assign team members before confirming.
      </p>

      <div className="space-y-3">
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            members={members}
            onUpdate={(id, title) => updateTask(id, { title })}
            onAssign={assignTask}
            onDelete={deleteTask}
          />
        ))}
      </div>
    </div>
  );
}
