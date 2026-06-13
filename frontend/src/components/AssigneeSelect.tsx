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

function matchHintToMember(hint: string, members: User[]): User | null {
  const lower = hint.toLowerCase();
  return members.find((m) => m.name.toLowerCase().includes(lower)) ?? null;
}

function memberLabel(member: User): string {
  return member.role ? `${member.name} — ${member.role}` : member.name;
}

function resolveSelectedId(
  value: string | null,
  hint: string | null,
  members: User[]
): string | null {
  if (value && members.some((m) => m.id === value)) {
    return value;
  }
  if (hint) {
    return matchHintToMember(hint, members)?.id ?? null;
  }
  return null;
}

export function AssigneeSelect({ members, value, hint, disabled = false, onChange }: Props) {
  const items = members.map((m) => ({
    value: m.id,
    label: memberLabel(m),
  }));

  const selectedId = resolveSelectedId(value, hint, members);

  return (
    <Select
      items={items}
      value={selectedId}
      disabled={disabled}
      onValueChange={(id) => onChange(id ?? "")}
    >
      <SelectTrigger className="w-[240px] border-0 bg-[#1a1f2e]" size="sm">
        <SelectValue placeholder="Select assignee" />
      </SelectTrigger>
      <SelectContent>
        {members.map((m) => (
          <SelectItem key={m.id} value={m.id} label={memberLabel(m)}>
            {memberLabel(m)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
