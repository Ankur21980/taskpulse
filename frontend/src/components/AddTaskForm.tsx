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
    <Card className="border-0">
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
            className="min-w-[200px] flex-1 border-0"
            placeholder="Task title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
          />
          <Select
            items={[
              { value: "high", label: "high" },
              { value: "medium", label: "medium" },
              { value: "low", label: "low" },
            ]}
            value={priority}
            onValueChange={(v) => setPriority(v as "high" | "medium" | "low")}
          >
            <SelectTrigger className="w-[120px] border-0 bg-[#1a1f2e]" size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="high" label="high">
                high
              </SelectItem>
              <SelectItem value="medium" label="medium">
                medium
              </SelectItem>
              <SelectItem value="low" label="low">
                low
              </SelectItem>
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
