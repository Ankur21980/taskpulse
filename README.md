# TaskPulse Prototype

AI task extraction from meeting transcripts and PRDs (Gemini) with review and assignment UI. Demo team: Hiren, Prerana, Anisha, and Gowtham on a 3-week sprint.

## Quick start

### Backend
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # add GEMINI_API_KEY + MONGODB_URI
uvicorn app.main:app --reload --port 8000
```

**After changing `backend/.env` you MUST restart uvicorn** (`--reload` does not watch `.env`).

Data is stored in **MongoDB Atlas** (not SQLite).

### MongoDB Atlas setup

1. Create a free cluster at https://cloud.mongodb.com
2. Database Access → create a user with read/write on `taskpulse`
3. Network Access → allow your IP address
4. Connect → copy the connection string into `backend/.env`:

```env
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/?retryWrites=true&w=majority
MONGODB_DB_NAME=taskpulse
```

### Frontend
```bash
cd frontend
npm install
npm run dev          # http://localhost:5173
# or: npm run dev:3002   # http://localhost:3002
```

**Important:** Do not run `npm run dev -port 3002` — that breaks Vite. Use `npm run dev:3002` instead.

Open http://localhost:5173

### Gemini API key

Create a key at https://aistudio.google.com/apikey and set `GEMINI_API_KEY` in `backend/.env`.

## Demo walkthrough

1. Open http://localhost:5173
2. Click **Load sample transcript** → **Extract Tasks**
3. On the Review Board, edit titles and assign tasks to team members
4. Refresh the page — tasks should reload from MongoDB
5. Go to **My Tasks** → select a team member to see their assigned tasks
6. (Optional) Upload `backend/samples/standup.txt` to demo file upload
7. Switch to **PRD document** tab → upload `backend/samples/sample-prd.docx`
8. Review Board shows `feature_area` and `task_type` badges with assignee hints
9. Review Board **History** sidebar lists all past uploads (draft/completed filters)
10. **Mark complete** / **Reopen review**; **+ Add task** on any review including completed ones
11. On Upload, check/uncheck **Team for this sprint** — unnamed tasks assign by role among checked members; named owners always assign to that person
