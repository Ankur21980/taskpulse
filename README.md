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

## Deploy for free

### Backend (Render)

**Option A — Docker (recommended, avoids Python 3.14 build issues)**

1. Push this repo to GitHub.
2. Render → **New Web Service** → connect repo.
3. Settings:
   - **Root directory:** `backend`
   - **Runtime:** `Docker`
   - **Dockerfile path:** `Dockerfile`
4. Set env vars from `backend/.env.example` (`GEMINI_API_KEY`, `MONGODB_URI`, `CORS_ORIGINS`, etc.).
5. In MongoDB Atlas → **Network Access**, allow `0.0.0.0/0`.
6. Verify: `https://<your-api>.onrender.com/health`

**Option B — Native Python**

1. Same as above, but **Runtime:** `Python`.
2. **Build command:** `bash render-build.sh`
3. **Start command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
4. **Required env var:** `PYTHON_VERSION=3.12.11` (Render defaults to 3.14 without this).

Or use **Blueprint** with `render.yaml` at the repo root (Docker-based).

### Frontend (Render Static Site)

1. Render → **New → Static Site** → connect the same GitHub repo.
2. Settings:
   - **Root directory:** `frontend`
   - **Build command:** `npm install && npm run build`
   - **Publish directory:** `dist`
3. **Environment** → add:
   ```
   VITE_API_URL=https://<your-api>.onrender.com/api
   ```
   (Use your real backend URL from the Web Service.)
4. Deploy. SPA routing is in `render.yaml` routes; `public/_redirects` is a fallback.
5. Copy your Static Site URL (e.g. `https://taskpulse-web.onrender.com`).
6. On the **backend** service → **Environment** → set:
   ```
   CORS_ORIGINS=https://<your-frontend>.onrender.com
   ```
7. Redeploy the backend so CORS picks up the frontend URL.

**Node version:** Vite 8 needs Node 20+. Render reads `frontend/.node-version` (`22.16.0`).

Also works on **Vercel** or **Netlify** — see `vercel.json` / `netlify.toml`.

Local dev is unchanged — leave `VITE_API_URL` unset and run backend + `npm run dev`.

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
