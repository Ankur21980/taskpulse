import type { User } from "../types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

interface Props {
  members: User[];
  selectedIds: Set<string>;
  onChange: (ids: Set<string>) => void;
}

export function TeamMemberPicker({ members, selectedIds, onChange }: Props) {
  const toggle = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    onChange(next);
  };

  return (
    <Card className="border-0">
      <CardHeader>
        <CardTitle className="text-base font-semibold text-white">Team for this sprint</CardTitle>
        <CardDescription>
          Named owners in the document are always assigned to that person. Unnamed tasks
          are assigned by role among checked members.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-3">
          {members.map((m) => (
            <li key={m.id}>
              <Label className="flex cursor-pointer items-center gap-2 text-sm font-normal">
                <Checkbox
                  checked={selectedIds.has(m.id)}
                  onCheckedChange={() => toggle(m.id)}
                />
                <span>
                  {m.name}
                  {m.role ? ` — ${m.role}` : ""}
                </span>
              </Label>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
