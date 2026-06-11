# TaskPulse Prototype

AI task extraction from meeting transcripts (Gemini) with review and assignment UI.

## Quick start

### Backend
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # add GEMINI_API_KEY
uvicorn app.main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173

## Demo walkthrough

1. Open http://localhost:5173
2. Click **Load sample transcript** → **Extract Tasks**
3. On the Review Board, edit titles and assign tasks to team members
4. Go to **My Tasks** → select a team member to see their assigned tasks
5. (Optional) Upload `backend/samples/standup.txt` to demo file upload
