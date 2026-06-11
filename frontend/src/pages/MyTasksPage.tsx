import { useEffect, useState } from "react";
import type { Task, User } from "../types";
import { useTaskStore } from "../store/taskStore";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
    }
  }, [selected, loadAssigneeTasks]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">My Tasks</h2>
        <p className="mt-1 text-muted-foreground">
          Select a team member to view their assigned tasks (demo).
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {members.map((m: User) => (
          <Button
            key={m.id}
            size="sm"
            variant={selected === m.id ? "default" : "outline"}
            className={cn(
              "rounded-full",
              selected !== m.id && "border-border bg-card text-foreground hover:bg-muted"
            )}
            onClick={() => setSelected(m.id)}
          >
            {m.role ? `${m.name} (${m.role})` : m.name}
          </Button>
        ))}
      </div>

      <div className="space-y-2">
        {tasks.map((t) => (
          <Card key={t.id} size="sm">
            <CardContent className="pt-3">
              <p className="font-medium">{t.title}</p>
              <div className="mt-1 flex gap-2">
                <Badge variant="outline" className="capitalize">
                  {t.status}
                </Badge>
                <Badge variant="secondary" className="capitalize">
                  {t.priority}
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
        {selected && tasks.length === 0 && (
          <p className="text-muted-foreground">No assigned tasks yet.</p>
        )}
      </div>
    </div>
  );
}
