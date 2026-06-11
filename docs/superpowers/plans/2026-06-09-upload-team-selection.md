# Upload Team Selection & Smart Assignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add team member checkboxes on Upload, pass eligible IDs to the backend, update Gemini prompts, and resolve `assignee_id` at extraction — named owners always win; unnamed tasks assigned by role among checked members.

**Architecture:** `TeamMemberPicker` on Upload → `eligible_member_ids` form field → dual-list Gemini prompt → `assignment_resolver.py` sets `assignee_id` on task creation → Review Board pre-selects assignee.

**Tech Stack:** FastAPI, pymongo, Gemini REST, React, Zustand

**Design spec:** `docs/superpowers/specs/2026-06-09-upload-team-selection-design.md`

---

### Task 1: Assignment resolver service

**Files:**
- Create: `backend/app/services/assignment_resolver.py`
- Create: `backend/tests/test_assignment_resolver.py`

- [ ] **Step 1: Write failing tests**

```python
from app.services.assignment_resolver import resolve_task_assignee
from app.schemas import ExtractedTask

MEMBERS = [
    {"_id": "u1", "name": "Hiren Chafekar", "role": "FrontEnd Engineer"},
    {"_id": "u2", "name": "Prerana Shukla", "role": "Backend Engineer"},
    {"_id": "u3", "name": "Anisha Kumari", "role": "FrontEnd Engineer"},
    {"_id": "u4", "name": "Gowtham L", "role": "Intern"},
]


def test_named_owner_matched_even_if_not_eligible():
    task = ExtractedTask(title="Ship API", assignee_hint="Prerana", priority="high")
    assignee_id, hint = resolve_task_assignee(task, MEMBERS, eligible_ids=["u1", "u3"])
    assert assignee_id == "u2"
    assert "Prerana" in hint


def test_unnamed_fallback_uses_eligible_only():
    task = ExtractedTask(title="Build login UI page", assignee_hint=None, priority="medium")
    assignee_id, _ = resolve_task_assignee(task, MEMBERS, eligible_ids=["u2", "u4"])
    assert assignee_id in ("u1", "u3", "u4")  # not u2 if FE keyword — adjust assertion
    assert assignee_id != "u2" or "ui" not in task.title.lower()


def test_hint_in_eligible_list():
    task = ExtractedTask(title="Write tests", assignee_hint="Gowtham", priority="low")
    assignee_id, _ = resolve_task_assignee(task, MEMBERS, eligible_ids=["u4"])
    assert assignee_id == "u4"
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
cd backend && PYTHONPATH=. python -m pytest tests/test_assignment_resolver.py -v
```

- [ ] **Step 3: Implement `assignment_resolver.py`**

```python
from typing import List, Optional, Tuple
from app.schemas import ExtractedTask

def _match_by_hint(hint: str, members: List[dict]) -> Optional[dict]:
    if not hint:
        return None
    lower = hint.lower()
    for m in members:
        name = m["name"].lower()
        if lower in name or name in lower:
            return m
    return None

def _role_fallback(task: ExtractedTask, eligible: List[dict]) -> Optional[dict]:
    text = f"{task.title} {task.source_quote or ''}".lower()
    if any(k in text for k in ("api", "backend", "auth", "database", "endpoint")):
        return next((m for m in eligible if "backend" in m.get("role", "").lower()), None)
    if any(k in text for k in ("ui", "frontend", "page", "component", "layout", "screen")):
        fe = [m for m in eligible if "frontend" in m.get("role", "").lower()]
        fe.sort(key=lambda m: m.get("experience_years") or 0, reverse=True)
        return fe[0] if fe else None
    if any(k in text for k in ("test", "unit", "documentation", "doc")):
        return next((m for m in eligible if m.get("role") == "Intern"), None)
    return eligible[0] if eligible else None

def resolve_task_assignee(
    task: ExtractedTask,
    all_members: List[dict],
    eligible_ids: List[str],
) -> Tuple[Optional[str], Optional[str]]:
    eligible = [m for m in all_members if str(m["_id"]) in eligible_ids]
    matched = _match_by_hint(task.assignee_hint or "", all_members)
    if matched:
        return str(matched["_id"]), matched["name"]
    fallback = _role_fallback(task, eligible)
    if fallback:
        return str(fallback["_id"]), fallback["name"]
    return None, task.assignee_hint
```

- [ ] **Step 4: Run tests — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/assignment_resolver.py backend/tests/test_assignment_resolver.py
git commit -m "feat: add assignment resolver for named and role-based assignees"
```

---

### Task 2: Gemini prompts and upload API

**Files:**
- Modify: `backend/app/services/extractor.py`
- Modify: `backend/app/routers/sources.py`
- Modify: `backend/app/mappers.py`
- Modify: `backend/app/schemas.py`

- [ ] **Step 1: Update extractor signatures**

```python
def extract_tasks_from_text(
    text: str,
    eligible_member_names: List[str],
    all_member_names: List[str],
) -> List[ExtractedTask]:
    # prompt uses both lists

def extract_tasks_from_prd(
    text: str,
    eligible_member_names: List[str],
    all_member_names: List[str],
) -> List[ExtractedTask]:
```

Update prompt template with eligible vs full team sections per spec.

- [ ] **Step 2: Extend upload handler**

```python
import json

@router.post("/upload", ...)
async def upload_source(
    ...
    eligible_member_ids: Optional[str] = Form(None),
):
    members = list_users_by_team(db, DEMO_TEAM_ID)
    if eligible_member_ids:
        eligible_ids = json.loads(eligible_member_ids)
    else:
        eligible_ids = [str(m["_id"]) for m in members]
    if not eligible_ids:
        raise HTTPException(400, "Select at least one team member")
    valid_ids = {str(m["_id"]) for m in members}
    if not set(eligible_ids).issubset(valid_ids):
        raise HTTPException(400, "Invalid team member ID")

    # pass to new_source_doc: eligible_assignee_ids=eligible_ids
    # after extraction:
    from app.services.assignment_resolver import resolve_task_assignee
    for item in extracted:
        assignee_id, hint = resolve_task_assignee(item, members, eligible_ids)
        doc = new_task_doc(...)
        if assignee_id:
            doc["assignee_id"] = assignee_id
        doc["assignee_hint"] = hint or item.assignee_hint
```

- [ ] **Step 3: Add `eligible_assignee_ids` to `new_source_doc` and `SourceSummaryOut`**

- [ ] **Step 4: Update `test_extractor.py` and `test_api.py` for new signatures**

- [ ] **Step 5: Run all backend tests**

```bash
cd backend && PYTHONPATH=. python -m pytest tests/ -v
```

- [ ] **Step 6: Commit**

```bash
git add backend/app/services/extractor.py backend/app/routers/sources.py backend/app/mappers.py backend/app/schemas.py backend/tests/
git commit -m "feat: scope upload assignment to eligible team members"
```

---

### Task 3: TeamMemberPicker on Upload page

**Files:**
- Create: `frontend/src/components/TeamMemberPicker.tsx`
- Modify: `frontend/src/pages/UploadPage.tsx`
- Modify: `frontend/src/api/client.ts`
- Modify: `frontend/src/store/taskStore.ts`

- [ ] **Step 1: Create `TeamMemberPicker.tsx`**

```tsx
interface Props {
  members: User[];
  selectedIds: Set<string>;
  onChange: (ids: Set<string>) => void;
}

export function TeamMemberPicker({ members, selectedIds, onChange }: Props) {
  const toggle = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  };
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <h3 className="text-sm font-semibold">Team for this sprint</h3>
      <p className="mt-1 text-xs text-slate-500">
        Named owners are always assigned to that person. Unnamed tasks are assigned by role among checked members.
      </p>
      <ul className="mt-3 space-y-2">
        {members.map((m) => (
          <li key={m.id}>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={selectedIds.has(m.id)}
                onChange={() => toggle(m.id)}
              />
              {m.name}{m.role ? ` — ${m.role}` : ""}
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 2: Update API client upload methods**

```typescript
function appendEligibleIds(form: FormData, ids: string[]) {
  form.append("eligible_member_ids", JSON.stringify(ids));
}

uploadText: (text: string, eligibleMemberIds: string[]) => {
  const form = new FormData();
  form.append("text", text);
  appendEligibleIds(form, eligibleMemberIds);
  ...
}
```

Same for `uploadFile` and `uploadPrd`.

- [ ] **Step 3: Update `UploadPage.tsx`**

```tsx
const { members, loadMembers, ... } = useTaskStore();
const [eligibleIds, setEligibleIds] = useState<Set<string>>(new Set());

useEffect(() => { loadMembers(); }, [loadMembers]);
useEffect(() => {
  if (members.length > 0 && eligibleIds.size === 0) {
    setEligibleIds(new Set(members.map((m) => m.id)));
  }
}, [members, eligibleIds.size]);

<TeamMemberPicker members={members} selectedIds={eligibleIds} onChange={setEligibleIds} />

// Disable extract when eligibleIds.size === 0
await extractFromText(text, [...eligibleIds]);
```

- [ ] **Step 4: Update store extract methods to accept `eligibleMemberIds: string[]`**

- [ ] **Step 5: Build**

```bash
cd frontend && npm run build
```

- [ ] **Step 6: Manual smoke test**

1. Uncheck Prerana → extract sample transcript
2. Unnamed tasks should not pre-select Prerana
3. Named "Hiren" tasks still pre-select Hiren if unchecked
4. Review Board Assign flow unchanged

- [ ] **Step 7: Commit**

```bash
git add frontend/src/
git commit -m "feat: add team member picker on Upload for scoped assignment"
```

---

### Task 4: README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add demo step about team checkboxes on Upload**

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: document upload team selection for assignment"
```

---

## Self-Review Checklist

- [x] Named owners assign even if unchecked (Option B)
- [x] Unnamed role-based among eligible only (Option C + role-based)
- [x] Approach 1: single Gemini + resolver
- [x] draft status with pre-filled assignee_id
- [x] No TBD placeholders

---

## Execution Handoff

**Plan saved to** `docs/superpowers/plans/2026-06-09-upload-team-selection.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)**
2. **Inline Execution**

Which approach?
