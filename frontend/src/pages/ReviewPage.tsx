import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AddTaskForm } from "../components/AddTaskForm";
import { ReviewHistorySidebar, type HistoryFilter } from "../components/ReviewHistorySidebar";
import { TaskCard } from "../components/TaskCard";
import { useTaskStore } from "../store/taskStore";
import { planBulkAssign } from "../utils/assignee";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function sourceTitle(filename: string | null | undefined, type: string, createdAt: string): string {
  if (filename) return filename;
  const date = new Date(createdAt).toLocaleDateString();
  return `${type} · ${date}`;
}

export function ReviewPage() {
  const {
    tasks,
    members,
    sources,
    activeSource,
    sourceId,
    loading,
    loadMembers,
    loadSources,
    selectSource,
    updateReviewStatus,
    addTaskToSource,
    updateTask,
    assignTask,
    assignAllTasks,
    deleteTask,
    restoreLastSession,
    setToast,
  } = useTaskStore();

  const [pendingAssignees, setPendingAssignees] = useState<Record<string, string>>({});
  const [highlightUnassigned, setHighlightUnassigned] = useState<Set<string>>(new Set());
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>("all");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  useEffect(() => {
    loadMembers();
    loadSources();
    restoreLastSession();
  }, [loadMembers, loadSources, restoreLastSession]);

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
      setToast(
        `Assigned ${succeeded} of ${total} tasks (${failed} failed, ${skipped} need an assignee)`
      );
    } else if (skipped > 0) {
      setToast(`Assigned ${succeeded} of ${total} tasks — ${skipped} need an assignee`);
    } else {
      setToast(`Assigned ${succeeded} tasks`);
    }
  };

  const handleSelectSource = async (id: string) => {
    setPendingAssignees({});
    setHighlightUnassigned(new Set());
    setShowAddForm(false);
    await selectSource(id);
    setSidebarOpen(false);
  };

  const draftCount = tasks.filter((t) => t.status === "draft").length;

  if (loading && tasks.length === 0 && sources.length === 0) {
    return <p className="text-muted-foreground">Loading tasks...</p>;
  }

  if (sources.length === 0 && tasks.length === 0) {
    return (
      <div className="text-center">
        <p className="text-muted-foreground">No reviews yet.</p>
        <Link
          to="/"
          className="mt-4 inline-block text-sm text-highlight underline-offset-4 hover:underline"
        >
          Upload a transcript or PRD
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="md:hidden"
          onClick={() => setSidebarOpen((o) => !o)}
        >
          History
        </Button>
        {activeSource && (
          <div className="flex flex-wrap items-center gap-2 md:ml-auto">
            {activeSource.review_status === "draft" ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => updateReviewStatus(activeSource.id, "completed")}
              >
                Mark complete
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => updateReviewStatus(activeSource.id, "draft")}
              >
                Reopen review
              </Button>
            )}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setShowAddForm((v) => !v)}
            >
              + Add task
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={draftCount === 0}
              onClick={handleAssignAll}
            >
              Assign all
            </Button>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-6 md:flex-row">
        <div className={sidebarOpen ? "block" : "hidden md:block"}>
          <ReviewHistorySidebar
            sources={sources}
            activeSourceId={sourceId}
            filter={historyFilter}
            onFilterChange={setHistoryFilter}
            onSelect={handleSelectSource}
          />
        </div>

        <div className="min-w-0 flex-1 space-y-4">
          {activeSource ? (
            <div>
              <h2 className="page-heading">
                {sourceTitle(
                  activeSource.original_filename,
                  activeSource.type,
                  activeSource.created_at
                )}
              </h2>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <Badge
                  variant="outline"
                  className={cn(
                    "capitalize",
                    activeSource.review_status === "completed" &&
                      "border-success/50 bg-success/25 text-success",
                    activeSource.review_status === "draft" &&
                      "border-warning/50 bg-warning/25 text-warning"
                  )}
                >
                  {activeSource.review_status}
                </Badge>
                <p className="text-sm text-muted-foreground">
                  Pick assignees, then click Assign or Assign all to confirm.
                </p>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground">Select a review from the history sidebar.</p>
          )}

          {showAddForm && sourceId && (
            <AddTaskForm
              members={members}
              onCancel={() => setShowAddForm(false)}
              onSubmit={async ({ title, assigneeId, priority }) => {
                await addTaskToSource(sourceId, {
                  title,
                  assignee_id: assigneeId,
                  priority,
                });
                setShowAddForm(false);
              }}
            />
          )}

          {tasks.length === 0 && activeSource && !loading && (
            <p className="text-muted-foreground">No tasks in this review. Add one with + Add task.</p>
          )}

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
      </div>
    </div>
  );
}
