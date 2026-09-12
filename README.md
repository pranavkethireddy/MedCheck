# MedCheck

HackRice 16 project — see `plan.md` for the full pitch, architecture, and task breakdown.

## Layout

```
MedCheck-main/
├── plan.md          — the project plan
├── frontend/        — React + Vite app (teammate's code, wired to the backend below)
└── backend/         — Backend Person 1's FastAPI service (this is what you've been building)
```

## Running both together

**Backend** (from `backend/`):
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env   # fill in SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
uvicorn app.main:app --reload --port 3000
```
Full details, endpoint list, and the RxNav-is-dead / curated+openFDA interaction story are in `backend/README.md`.

**Frontend** (from `frontend/`, in a separate terminal):
```bash
npm install
cp .env.example .env   # fill in VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
                        # VITE_BACKEND_URL defaults to http://localhost:3000, matching the backend above
npm run dev
```

With both running, the app is live end-to-end: sign up / log in (Supabase Auth, direct from the frontend), add a medication (hits `/api/search-drugs` then `/api/save-medication`), see it persist (`/api/get-medications`), and remove it (`/api/delete-medication`).

## Testing the backend without the frontend

`backend/test/smoke.py` (`python test/smoke.py`) and the Postman collection (ask your backend teammate for the latest `.postman_collection.json` + `.postman_environment.json`) both work standalone — see `backend/README.md`.
