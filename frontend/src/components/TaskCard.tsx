import type { Task, User } from "../types";
import { AssigneeSelect } from "./AssigneeSelect";
import { matchHintToMember } from "../utils/assignee";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

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

const priorityVariant = {
  high: "destructive",
  medium: "secondary",
  low: "outline",
} as const;

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
    matchHintToMember(task.assignee_hint, members)?.id ??
    null;

  return (
    <Card
      className={cn(
        "border-0",
        highlighted && "ring-2 ring-destructive/40"
      )}
    >
      <CardContent className="space-y-4 pt-4">
        <div className="flex items-start justify-between gap-4">
          <Input
            className="flex-1 border-0 bg-[#111318] font-medium text-white shadow-none focus-visible:ring-[#2563eb]/30"
            value={task.title}
            onChange={(e) => onUpdate(task.id, e.target.value)}
          />
          <Badge
            variant={priorityVariant[task.priority]}
            className={cn(
              task.priority === "medium" && "border-warning/50 bg-warning/25 text-warning",
              task.priority === "low" && "border-border bg-muted text-muted-foreground"
            )}
          >
            {task.priority}
          </Badge>
        </div>

        {task.source_quote && (
          <p className="text-sm italic text-muted-foreground">"{task.source_quote}"</p>
        )}

        {(task.feature_area || task.task_type) && (
          <div className="flex flex-wrap gap-2">
            {task.feature_area && (
              <Badge variant="secondary" className="font-medium">
                {task.feature_area}
              </Badge>
            )}
            {task.task_type && (
              <Badge variant="outline">{task.task_type}</Badge>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <AssigneeSelect
            members={members}
            value={pendingAssigneeId ?? task.assignee_id}
            hint={task.assignee_hint}
            disabled={isAssigned}
            onChange={(id) => onStageAssignee(task.id, id)}
          />
          {!isAssigned && (
            <Button
              size="sm"
              disabled={!resolvedId}
              onClick={() => resolvedId && onAssign(task.id, resolvedId)}
            >
              Assign
            </Button>
          )}
          <Badge
            variant="outline"
            className={cn(
              "capitalize",
              task.status === "draft" && "border-warning/50 bg-warning/25 text-warning",
              task.status === "assigned" && "border-success/50 bg-success/25 text-success"
            )}
          >
            {task.status}
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => onDelete(task.id)}
          >
            Delete
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
