import type { User } from "../types";

interface Props {
  members: User[];
  value: string | null;
  hint: string | null;
  onChange: (id: string) => void;
}

export function AssigneeSelect({ members, value, hint, onChange }: Props) {
  const matched = hint
    ? members.find((m) => m.name.toLowerCase().includes(hint.toLowerCase()))
    : null;

  return (
    <select
      className="rounded border border-slate-300 px-2 py-1 text-sm"
      value={value ?? matched?.id ?? ""}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">Select assignee</option>
      {members.map((m) => (
        <option key={m.id} value={m.id}>
          {m.name}
        </option>
      ))}
    </select>
  );
}
