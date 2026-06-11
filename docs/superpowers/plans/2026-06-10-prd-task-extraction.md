# PRD Task Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan step-by-step. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add PRD upload (PDF/DOCX) with PRD-specific Gemini extraction, enriched task schema (`feature_area`, `task_type`), and dual-mode Upload UI — while keeping transcript flow unchanged.

**Architecture:** `prd_parser.py` extracts text from PDF/DOCX; `extractor.py` gains `extract_tasks_from_prd()` with a dedicated prompt; upload router branches on file type; frontend Upload page gets two tabs; TaskCard shows PRD badges.

**Tech Stack:** pypdf, python-docx, FastAPI, pymongo, Gemini REST, React, Zustand

**Design spec:** `docs/superpowers/specs/2026-06-10-prd-task-extraction-design.md`

---

### Task 1: Dependencies and schema extensions

**Files:**
- Modify: `backend/requirements.txt`, `backend/app/enums.py`, `backend/app/schemas.py`

- [ ] **Step 1: Add dependencies to `backend/requirements.txt`**

Append:
```text
pypdf==5.1.0
python-docx==1.1.2
```

- [ ] **Step 2: Add `PRD` to `backend/app/enums.py`**

```python
class SourceType(str, enum.Enum):
    TRANSCRIPT = "transcript"
    SCREENSHOT = "screenshot"
    PASTED_TEXT = "pasted_text"
    PRD = "prd"


class TaskType(str, enum.Enum):
    REQUIREMENT = "requirement"
    MILESTONE = "milestone"
    DELIVERABLE = "deliverable"
```

- [ ] **Step 3: Extend `backend/app/schemas.py`**

```python
class TaskOut(BaseModel):
    id: str
    title: str
    assignee_id: Optional[str]
    assignee_hint: Optional[str]
    status: str
    priority: str
    due_date: Optional[datetime]
    source_ref_id: str
    source_quote: Optional[str]
    feature_area: Optional[str] = None
    task_type: Optional[Literal["requirement", "milestone", "deliverable"]] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    assignee_id: Optional[str] = None
    due_date: Optional[datetime] = None
    priority: Optional[Literal["high", "medium", "low"]] = None
    feature_area: Optional[str] = None
    task_type: Optional[Literal["requirement", "milestone", "deliverable"]] = None


class UploadResponse(BaseModel):
    source_id: str
    task_count: int
    tasks: List[TaskOut]
    truncated: bool = False


class ExtractedTask(BaseModel):
    title: str = Field(max_length=200)
    assignee_hint: Optional[str] = None
    due_date: Optional[str] = None
    priority: Literal["high", "medium", "low"] = "medium"
    source_quote: Optional[str] = None
    feature_area: Optional[str] = None
    task_type: Optional[Literal["requirement", "milestone", "deliverable"]] = None
```

- [ ] **Step 4: Install deps**

```bash
cd backend && source .venv/bin/activate && pip install -r requirements.txt
```

- [ ] **Step 5: Commit**

```bash
git add backend/requirements.txt backend/app/enums.py backend/app/schemas.py
git commit -m "feat: extend schema for PRD task extraction"
```

---

### Task 2: PRD parser service

**Files:**
- Create: `backend/app/services/prd_parser.py`, `backend/tests/test_prd_parser.py`

- [ ] **Step 1: Write failing tests**

`backend/tests/test_prd_parser.py`:

```python
import pytest
from docx import Document

from app.services.prd_parser import (
    PRD_MAX_CHARS,
    parse_prd_file,
    truncate_prd_text,
)


def test_truncate_prd_text():
    long = "a" * (PRD_MAX_CHARS + 100)
    result, truncated = truncate_prd_text(long)
    assert truncated is True
    assert len(result) == PRD_MAX_CHARS


def test_truncate_short_text_not_truncated():
    text = "short prd content"
    result, truncated = truncate_prd_text(text)
    assert truncated is False
    assert result == text


def test_parse_docx_extracts_paragraphs(tmp_path):
    path = tmp_path / "sample.docx"
    doc = Document()
    doc.add_paragraph("Feature: User Authentication")
    doc.add_paragraph("Owner: Priya Sharma")
    doc.add_paragraph("Milestone: Launch auth by Q3")
    doc.save(str(path))

    text = parse_prd_file(str(path), "sample.docx")
    assert "User Authentication" in text
    assert "Priya Sharma" in text


def test_parse_legacy_doc_rejected():
    with pytest.raises(ValueError, match="Legacy .doc"):
        parse_prd_file(b"fake", "spec.doc")
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && PYTHONPATH=. python -m pytest tests/test_prd_parser.py -v
```

Expected: FAIL — module not found

- [ ] **Step 3: Implement `backend/app/services/prd_parser.py`**

```python
import io
from typing import Tuple, Union

from docx import Document
from pypdf import PdfReader

PRD_MAX_CHARS = 30_000


def truncate_prd_text(text: str) -> Tuple[str, bool]:
    if len(text) <= PRD_MAX_CHARS:
        return text, False
    return text[:PRD_MAX_CHARS], True


def _parse_pdf(content: bytes) -> str:
    reader = PdfReader(io.BytesIO(content))
    pages = []
    for page in reader.pages:
        page_text = page.extract_text()
        if page_text:
            pages.append(page_text.strip())
    return "\n\n".join(pages)


def _parse_docx(content: bytes) -> str:
    doc = Document(io.BytesIO(content))
    parts = []
    for para in doc.paragraphs:
        if para.text.strip():
            parts.append(para.text.strip())
    for table in doc.tables:
        for row in table.rows:
            for cell in row.cells:
                if cell.text.strip():
                    parts.append(cell.text.strip())
    return "\n".join(parts)


def parse_prd_file(content: Union[bytes, str], filename: str) -> str:
    lower = filename.lower()
    if lower.endswith(".doc"):
        raise ValueError("Legacy .doc not supported. Save as .docx or PDF.")
    if lower.endswith(".pdf"):
        raw = _parse_pdf(content if isinstance(content, bytes) else content.encode())
    elif lower.endswith(".docx"):
        raw = _parse_docx(content if isinstance(content, bytes) else content.encode())
    else:
        raise ValueError(f"Unsupported PRD format: {filename}. Use .pdf or .docx.")

    if len(raw.strip()) < 50:
        raise ValueError(
            "Could not extract text from document. Use a text-based PDF or .docx."
        )
    return raw
```

- [ ] **Step 4: Run tests**

```bash
cd backend && PYTHONPATH=. python -m pytest tests/test_prd_parser.py -v
```

Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/prd_parser.py backend/tests/test_prd_parser.py
git commit -m "feat: add PRD parser for PDF and DOCX"
```

---

### Task 3: PRD Gemini extraction

**Files:**
- Modify: `backend/app/services/extractor.py`, `backend/tests/test_extractor.py`

- [ ] **Step 1: Write failing test**

Add to `backend/tests/test_extractor.py`:

```python
PRD_SAMPLE_JSON = """[
  {
    "title": "Implement user authentication",
    "assignee_hint": "Priya",
    "due_date": null,
    "priority": "high",
    "source_quote": "Owner: Priya Sharma",
    "feature_area": "Authentication",
    "task_type": "requirement"
  }
]"""


@patch("app.services.extractor._gemini_request")
def test_extract_tasks_from_prd(mock_gemini):
    mock_gemini.return_value = PRD_SAMPLE_JSON
    from app.services.extractor import extract_tasks_from_prd

    tasks = extract_tasks_from_prd("PRD content here", ["Priya Sharma", "Rahul Kapoor"])
    assert len(tasks) == 1
    assert tasks[0].feature_area == "Authentication"
    assert tasks[0].task_type == "requirement"
    call_prompt = mock_gemini.call_args[0][0]
    assert "PRD task extraction" in call_prompt
    assert "Priya Sharma" in call_prompt
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && PYTHONPATH=. python -m pytest tests/test_extractor.py::test_extract_tasks_from_prd -v
```

- [ ] **Step 3: Add PRD extraction to `backend/app/services/extractor.py`**

```python
PRD_EXTRACTION_PROMPT = """You are a PRD task extraction assistant. From this Product Requirements Document, extract every actionable task: features, requirements, milestones, and deliverables.

Team members for assignee matching: {team_members}

For each task return a JSON object with: title (max 10 words, imperative verb), assignee_hint (owner/DRI/team named in PRD, or null), due_date (ISO 8601 or null), priority (high/medium/low), source_quote (originating sentence, max 20 words), feature_area (module/epic/section e.g. "Auth", "Payments"), task_type (one of: requirement | milestone | deliverable).

Return only a JSON array. No preamble, no markdown.

PRD TEXT:
"""


def extract_tasks_from_prd(text: str, team_member_names: List[str]) -> List[ExtractedTask]:
    members = ", ".join(team_member_names) if team_member_names else "unknown"
    prompt = PRD_EXTRACTION_PROMPT.format(team_members=members) + text
    try:
        raw = _gemini_request(prompt, json_mode=True)
        return parse_extraction_response(raw)
    except (json.JSONDecodeError, ValueError) as first_error:
        if isinstance(first_error, ValueError) and "Gemini" in str(first_error):
            raise
        raw = _gemini_request(
            prompt + "\n\nReturn ONLY valid JSON array. No markdown.",
            json_mode=False,
        )
        return parse_extraction_response(raw)
```

- [ ] **Step 4: Run all extractor tests**

```bash
cd backend && PYTHONPATH=. python -m pytest tests/test_extractor.py -v
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/extractor.py backend/tests/test_extractor.py
git commit -m "feat: add Gemini PRD extraction prompt"
```

---

### Task 4: Mappers and upload router

**Files:**
- Modify: `backend/app/mappers.py`, `backend/app/routers/sources.py`, `backend/tests/test_api.py`

- [ ] **Step 1: Update `backend/app/mappers.py`**

Add to `task_doc_to_out`:
```python
        feature_area=doc.get("feature_area"),
        task_type=doc.get("task_type"),
```

Add params to `new_task_doc`:
```python
def new_task_doc(
    ...
    feature_area: Optional[str] = None,
    task_type: Optional[str] = None,
) -> Dict[str, Any]:
    ...
    return {
        ...
        "feature_area": feature_area,
        "task_type": task_type,
        ...
    }
```

- [ ] **Step 2: Rewrite upload handler in `backend/app/routers/sources.py`**

Key changes:
- Import `parse_prd_file`, `truncate_prd_text` from `prd_parser`
- Import `extract_tasks_from_prd` from `extractor`
- Import `list_users_by_team`, `DEMO_TEAM_ID` for team member names
- Detect `.pdf`/`.docx` → `SourceType.PRD`, use `parse_prd_file(content_bytes, filename)`
- Detect `.doc` → HTTP 400 with legacy message
- Branch extraction: PRD uses `extract_tasks_from_prd`, else `extract_tasks_from_text`
- Pass `feature_area` and `task_type` to `new_task_doc`
- Return `truncated` in `UploadResponse`

```python
def _is_prd_file(filename: str) -> bool:
    lower = filename.lower()
    return lower.endswith((".pdf", ".docx", ".doc"))


# Inside upload_source, after reading file:
if _is_prd_file(filename):
    if filename.lower().endswith(".doc"):
        raise HTTPException(400, "Legacy .doc not supported. Save as .docx or PDF.")
    source_type = SourceType.PRD.value
    extracted_text = parse_prd_file(content_bytes, filename)
else:
    # existing transcript/screenshot logic
    ...

extracted_text, truncated = truncate_prd_text(extracted_text) if source_type == SourceType.PRD.value else (extracted_text, False)

# After create_source:
if source_type == SourceType.PRD.value:
    members = list_users_by_team(db, DEMO_TEAM_ID)
    names = [m["name"] for m in members]
    extracted = extract_tasks_from_prd(extracted_text, names)
else:
    extracted = extract_tasks_from_text(extracted_text)

# In task loop, add feature_area and task_type:
doc = new_task_doc(
    ...
    feature_area=item.feature_area,
    task_type=item.task_type,
)

return UploadResponse(..., truncated=truncated)
```

- [ ] **Step 3: Add API test for PRD upload**

Add to `backend/tests/test_api.py`:

```python
@patch("app.routers.sources.extract_tasks_from_prd")
@patch("app.routers.sources.parse_prd_file", return_value="Feature: Auth. Owner: Priya.")
def test_upload_prd_pdf(mock_parse, mock_extract, client):
    from app.schemas import ExtractedTask

    mock_extract.return_value = [
        ExtractedTask(
            title="Implement authentication",
            assignee_hint="Priya",
            feature_area="Authentication",
            task_type="requirement",
            priority="high",
            source_quote="Owner: Priya",
        )
    ]
    response = client.post(
        "/api/sources/upload",
        files={"file": ("spec.pdf", b"%PDF-1.4 fake", "application/pdf")},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["tasks"][0]["feature_area"] == "Authentication"
    assert body["tasks"][0]["task_type"] == "requirement"
```

- [ ] **Step 4: Run all tests**

```bash
cd backend && PYTHONPATH=. python -m pytest tests/ -v
```

Expected: PASS (all tests)

- [ ] **Step 5: Commit**

```bash
git add backend/app/mappers.py backend/app/routers/sources.py backend/tests/test_api.py
git commit -m "feat: wire PRD upload and extraction into sources API"
```

---

### Task 5: Frontend dual-mode upload

**Files:**
- Modify: `frontend/src/types/index.ts`, `frontend/src/pages/UploadPage.tsx`, `frontend/src/store/taskStore.ts`

- [ ] **Step 1: Extend types in `frontend/src/types/index.ts`**

```typescript
export interface Task {
  ...
  feature_area: string | null;
  task_type: "requirement" | "milestone" | "deliverable" | null;
}

export interface UploadResponse {
  source_id: string;
  task_count: number;
  tasks: Task[];
  truncated?: boolean;
}
```

- [ ] **Step 2: Add `extractFromPrd` to store**

In `taskStore.ts`:
```typescript
  extractFromPrd: (file: File) => Promise<void>;

  extractFromPrd: async (file) => {
    set({ loading: true, error: null });
    try {
      const res = await api.uploadPrd(file);
      saveSourceId(res.source_id);
      set({ tasks: res.tasks, sourceId: res.source_id, loading: false });
      if (res.truncated) {
        set({ toast: "PRD was truncated to fit processing limits." });
      }
    } catch (e) {
      set({ loading: false, error: (e as Error).message });
    }
  },
```

- [ ] **Step 3: Add `uploadPrd` to `frontend/src/api/client.ts`**

```typescript
  uploadPrd: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return request<UploadResponse>("/sources/upload", { method: "POST", body: form });
  },
```

- [ ] **Step 4: Rewrite `frontend/src/pages/UploadPage.tsx` with tabs**

```tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTaskStore } from "../store/taskStore";

type UploadMode = "transcript" | "prd";

const SAMPLE = `Standup — June 9, 2026...`; // keep existing

export function UploadPage() {
  const [mode, setMode] = useState<UploadMode>("transcript");
  const [text, setText] = useState("");
  const { loading, error, extractFromText, extractFromFile, extractFromPrd } = useTaskStore();
  const navigate = useNavigate();

  const handleExtract = async () => {
    await extractFromText(text);
    navigate("/review");
  };

  const loadingMsg = mode === "prd"
    ? "Extracting tasks from PRD — this may take 15–30 seconds..."
    : "Gemini is extracting tasks — this may take 5–15 seconds...";

  return (
    <div className="space-y-6">
      <div className="flex gap-2 border-b border-slate-200">
        {(["transcript", "prd"] as UploadMode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={
              mode === m
                ? "border-b-2 border-indigo-600 px-4 py-2 text-sm font-medium text-indigo-600"
                : "px-4 py-2 text-sm text-slate-600 hover:text-indigo-600"
            }
          >
            {m === "transcript" ? "Meeting transcript" : "PRD document"}
          </button>
        ))}
      </div>

      {mode === "transcript" ? (
        <>
          <div>
            <h2 className="text-2xl font-semibold">Extract tasks from a meeting</h2>
            <p className="mt-1 text-slate-600">
              Paste notes or upload a transcript (.txt, .vtt, .srt).
            </p>
          </div>
          <textarea ... />
          <div className="flex flex-wrap gap-3">
            <button onClick={() => setText(SAMPLE)}>Load sample transcript</button>
            <label>
              Upload file
              <input type="file" accept=".txt,.vtt,.srt,.png,.jpg,.jpeg" hidden
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) { await extractFromFile(file); navigate("/review"); }
                }} />
            </label>
            <button disabled={loading || text.trim().length < 10} onClick={handleExtract}>
              {loading ? "Extracting..." : "Extract Tasks"}
            </button>
          </div>
        </>
      ) : (
        <>
          <div>
            <h2 className="text-2xl font-semibold">Extract tasks from a PRD</h2>
            <p className="mt-1 text-slate-600">
              Upload a Product Requirements Document (.pdf, .docx). Tasks, owners, and feature areas are extracted automatically.
            </p>
          </div>
          <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 p-12 hover:border-indigo-400">
            <span className="text-sm text-slate-600">Drop PRD file here or click to browse</span>
            <span className="mt-1 text-xs text-slate-400">.pdf, .docx supported</span>
            <input type="file" accept=".pdf,.docx" className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (file) { await extractFromPrd(file); navigate("/review"); }
              }} />
          </label>
        </>
      )}

      {loading && (
        <div className="rounded-lg bg-indigo-50 px-4 py-3 text-indigo-800">{loadingMsg}</div>
      )}
      {error && <p className="text-red-600">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 5: Build frontend**

```bash
cd frontend && npm run build
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add frontend/src/
git commit -m "feat: add dual-mode Upload page for transcript and PRD"
```

---

### Task 6: TaskCard PRD badges

**Files:**
- Modify: `frontend/src/components/TaskCard.tsx`, `backend/app/routers/tasks.py`

- [ ] **Step 1: Update TaskCard to show PRD badges**

After `source_quote` block, add:
```tsx
      {(task.feature_area || task.task_type) && (
        <div className="mt-2 flex flex-wrap gap-2">
          {task.feature_area && (
            <span className="rounded bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700">
              {task.feature_area}
            </span>
          )}
          {task.task_type && (
            <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
              {task.task_type}
            </span>
          )}
        </div>
      )}
```

- [ ] **Step 2: Allow `feature_area`/`task_type` in task PATCH**

In `backend/app/routers/tasks.py` `update_task`:
```python
    if payload.feature_area is not None:
        updates["feature_area"] = payload.feature_area
    if payload.task_type is not None:
        updates["task_type"] = payload.task_type
```

- [ ] **Step 3: Run full test suite + build**

```bash
cd backend && PYTHONPATH=. python -m pytest tests/ -v
cd ../frontend && npm run build
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/TaskCard.tsx backend/app/routers/tasks.py
git commit -m "feat: show PRD feature_area and task_type badges on Review Board"
```

---

### Task 7: Docs and sample PRD

**Files:**
- Create: `backend/samples/sample-prd.docx` (or document creation script)
- Modify: `README.md`

- [ ] **Step 1: Create sample PRD generator script**

`backend/scripts/create_sample_prd.py`:
```python
from docx import Document

doc = Document()
doc.add_heading("TaskPulse Q3 PRD", 0)
doc.add_heading("Authentication", 1)
doc.add_paragraph("Requirement: Implement OAuth2 login flow. Owner: Priya Sharma. Priority: High.")
doc.add_heading("Notifications", 1)
doc.add_paragraph("Milestone: Launch email notifications by August 1. Owner: Alex Chen.")
doc.add_paragraph("Deliverable: SendGrid integration. Owner: Rahul Kapoor.")
doc.save("backend/samples/sample-prd.docx")
```

Run: `cd backend && python scripts/create_sample_prd.py`

- [ ] **Step 2: Update README demo walkthrough**

Add step:
```
7. Switch to **PRD document** tab → upload `backend/samples/sample-prd.docx`
8. Review Board shows feature_area and task_type badges with assignee hints
```

- [ ] **Step 3: Manual smoke test**

1. Restart backend
2. Upload `sample-prd.docx` via PRD tab
3. Verify tasks have feature_area, task_type, assignee_hint
4. Refresh Review Board — tasks persist
5. Upload transcript — still works, no PRD badges

- [ ] **Step 4: Commit**

```bash
git add backend/samples/ backend/scripts/ README.md
git commit -m "docs: add sample PRD and PRD upload demo steps"
```

---

## Self-Review Checklist

- [x] Spec coverage: PRD parser, PRD prompt, schema, UI tabs, badges, errors
- [x] Transcript flow unchanged
- [x] No TBD placeholders
- [x] Type consistency: `feature_area`/`task_type` in schemas, mappers, frontend types
- [x] `.doc` rejection explicit

---

## Execution Handoff

**Plan saved to** `docs/superpowers/plans/2026-06-10-prd-task-extraction.md`.

**Two execution options:**

1. **Subagent-driven (recommended)** — fresh subagent per task, review between tasks
2. **Inline execution** — implement task-by-task in this session with checkpoints

Which approach?
