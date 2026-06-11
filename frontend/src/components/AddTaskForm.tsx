import { useState } from "react";
import type { User } from "../types";
import { AssigneeSelect } from "./AssigneeSelect";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Props {
  members: User[];
  onSubmit: (data: { title: string; assigneeId: string | null; priority: "high" | "medium" | "low" }) => void;
  onCancel: () => void;
}

export function AddTaskForm({ members, onSubmit, onCancel }: Props) {
  const [title, setTitle] = useState("");
  const [assigneeId, setAssigneeId] = useState<string | null>(null);
  const [priority, setPriority] = useState<"high" | "medium" | "low">("medium");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Add task</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="flex flex-wrap gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!title.trim()) return;
            onSubmit({ title: title.trim(), assigneeId, priority });
          }}
        >
          <Input
            className="min-w-[200px] flex-1"
            placeholder="Task title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
          />
          <Select
            value={priority}
            onValueChange={(v) => setPriority(v as "high" | "medium" | "low")}
          >
            <SelectTrigger className="w-[120px]" size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="high">high</SelectItem>
              <SelectItem value="medium">medium</SelectItem>
              <SelectItem value="low">low</SelectItem>
            </SelectContent>
          </Select>
          <AssigneeSelect
            members={members}
            value={assigneeId}
            hint={null}
            onChange={(id) => setAssigneeId(id || null)}
          />
          <Button type="submit" size="sm" disabled={!title.trim()}>
            Save task
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
