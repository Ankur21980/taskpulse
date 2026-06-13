import type { User } from "../types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Props {
  members: User[];
  value: string | null;
  hint: string | null;
  disabled?: boolean;
  onChange: (id: string) => void;
}

export function AssigneeSelect({ members, value, hint, disabled = false, onChange }: Props) {
  const matched = hint
    ? members.find((m) => m.name.toLowerCase().includes(hint.toLowerCase()))
    : null;

  const resolved = value ?? matched?.id ?? "";

  return (
    <Select
      value={resolved || null}
      disabled={disabled}
      onValueChange={(id) => onChange(id ?? "")}
    >
      <SelectTrigger className="w-[200px] border-0 bg-[#1a1f2e]" size="sm">
        <SelectValue placeholder="Select assignee" />
      </SelectTrigger>
      <SelectContent>
        {members.map((m) => (
          <SelectItem key={m.id} value={m.id}>
            {m.role ? `${m.name} — ${m.role}` : m.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
