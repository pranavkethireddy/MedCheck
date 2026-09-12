# MedCheck Backend — Person 1 (Data & Drug Logic) — Python / FastAPI

Python port of the Backend Person 1 tasks from the project plan: Supabase
schema, drug search, medication CRUD, interaction checking + severity
sorting, interaction-flag persistence, dose-overlap detection, and a
mock-patient demo fallback. Same endpoint contracts as the original Node
version, so nothing changes for the frontend.

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/search-drugs?q=ibuprofen` | RxNorm drug name autocomplete |
| POST | `/api/save-medication` | Save a medication for a user |
| GET | `/api/get-medications?userId=...` | List a user's medications + schedule overlaps |
| DELETE | `/api/delete-medication?id=...&userId=...` | Remove a saved medication (not in the original plan doc — added because the frontend's "Remove" button needs it) |
| GET/POST | `/api/check-interactions?rxcuis=A+B` | Pairwise interaction check, severity-sorted |
| POST | `/api/save-interaction-flag` | Persist one interaction result |
| GET | `/api/mock-patients` | Canned demo data (judging-day fallback) |

All routes live in `app/main.py`. Request/response JSON shapes are
unchanged from the Node version (see the comments above each route) —
error responses are always `{"error": "..."}`. **Exception:** the shape of
each item in `/api/check-interactions`'s `interactions` array changed —
see "Why not RxNav's interaction API" below.

## Why not RxNav's interaction API

The original plan called for RxNav's Drug Interaction API
(`/REST/interaction/list.json`). **NLM discontinued that service on
January 2, 2024, with no official replacement** — confirmed against NLM's
own RxNav FAQ. This isn't a bug in this code; the endpoint the plan
describes simply no longer exists (it now 404s for everyone, not just us).

`/api/check-interactions` instead checks two sources, in this order, so it
still works for any drug name rather than only a small hardcoded list:

1. **`app/known_interactions.py`** — a curated list of ~17 well-documented
   interaction pairs/classes (warfarin+NSAIDs, SSRIs+tramadol, ACE
   inhibitors+potassium, statins+certain antibiotics, opioids+
   benzodiazepines, etc.), matched on normalized drug names. Zero network
   calls, always correct for what it covers, always available even if
   every external API is down on judging day.
2. **`app/openfda_client.py`** — for anything not in that list, fetches
   each drug's real FDA label from openFDA (free, no key) and text-searches
   its `boxed_warning` / `contraindications` / `drug_interactions` /
   `warnings` sections for the other drug's name. This is what makes it
   work for "any drug name," at the cost of being a heuristic (plain
   substring match on label text, not clinical judgment) — a match in
   `boxed_warning`/`contraindications` is reported as `"significant"`, a
   match in `drug_interactions`/`warnings`/`precautions` as `"minor"`.

A pair with no evidence from either source is simply left out of the
results — same behavior as the old RxNav-backed version. Each item in the
response now looks like:

```json
{
  "severity": "significant",
  "description": "Combining warfarin with an NSAID pain reliever can significantly increase the risk of bleeding.",
  "drugs": ["Warfarin", "Ibuprofen"],
  "source": "curated"
}
```
or, from the openFDA path:
```json
{
  "severity": "minor",
  "description": "Ibuprofen's FDA label mentions warfarin in its \"drug_interactions\" section.",
  "drugs": ["Ibuprofen", "Warfarin"],
  "source": "openfda",
  "evidence": "...the exact snippet of label text that matched..."
}
```
`severity` is now always one of `none` / `minor` / `significant` — the
same three values `/api/save-interaction-flag` and the
`interaction_flags.severity` column already use, so nothing downstream
needs a translation step.

**Request shape**: `GET /api/check-interactions?rxcuis=11289+5640` still
works (names get resolved via plain RxNorm, which is still alive — only
the Interaction API was discontinued). Prefer POST with
`{"drugs": [{"rxcui": "11289", "name": "Warfarin"}, {"rxcui": "5640", "name": "Ibuprofen"}]}`
when you already have both values (e.g. from `/api/search-drugs` or
`/api/get-medications`) — it skips an extra RxNorm round trip and, for
anything in the curated list, needs no network call at all.

This curated list is illustrative, not a clinical database — keep the
plan's own framing (section 13): MedCheck is a conversation-starter with a
pharmacist or doctor, never a diagnosis. Worth saying explicitly in your
Devpost writeup, since "why doesn't this use the interaction API in the
plan" is a fair question a judge could ask.

## Setup

1. Create a Supabase project at supabase.com (free tier).
2. In the Supabase SQL editor, run `supabase/schema.sql`.
3. Settings → API → copy the **Project URL** and the **service_role** key
   (not the anon key — see "Security notes" below).
4. `cp .env.example .env` and fill in `SUPABASE_URL` and
   `SUPABASE_SERVICE_ROLE_KEY`.
5. Create a virtualenv and install deps:
   ```bash
   python3 -m venv .venv
   source .venv/bin/activate       # Windows: .venv\Scripts\activate
   pip install -r requirements-dev.txt   # includes test deps (httpx)
   ```

## Running locally

```bash
python test/smoke.py          # 20 checks, no live DB needed
uvicorn app.main:app --reload --port 3000   # serves /api/* on http://localhost:3000
```

`test/smoke.py` is safe to run before you even have Supabase set up — it
exercises validation logic, pure functions, and the curated interaction
list via FastAPI's in-process `TestClient` with zero network calls, plus a
few live RxNorm/openFDA calls that are skipped (not failed) if the network
can't reach them.

Once you have real Supabase credentials in `.env`, try it end-to-end:

```bash
curl "http://localhost:3000/api/search-drugs?q=ibuprofen"

curl -X POST http://localhost:3000/api/save-medication \
  -H "Content-Type: application/json" \
  -d '{"userId":"00000000-0000-0000-0000-000000000000","name":"Ibuprofen","rxcui":"5640","timeOfDay":"08:00"}'

curl "http://localhost:3000/api/get-medications?userId=00000000-0000-0000-0000-000000000000"

curl "http://localhost:3000/api/check-interactions?rxcuis=11289+5640"
```

(`userId` needs to be a real row in `auth.users` for the foreign key to
succeed — easiest way is to sign up a test user through whatever Supabase
Auth flow the frontend builds, then copy their UUID from the Supabase
dashboard's Authentication tab.)

## Deploying

Vercel supports Python serverless functions natively. This repo is already
laid out for it:

- `requirements.txt` at the root tells Vercel's Python builder what to install.
- `api/index.py` re-exports the FastAPI `app` object — Vercel's Python
  runtime detects that and serves it as an ASGI app.
- `vercel.json` rewrites every `/api/*` request to that one function, so
  FastAPI's own router (in `app/main.py`) handles the individual routes —
  one Python function instead of six.

Either deploy this as its own Vercel project, or — recommended in the plan
— copy this whole repo's contents into the frontend's Vercel project root
(Vercel can build a Python `api/` folder and a JS/React frontend in the
same project) so frontend + backend ship together with no CORS to worry
about. Either way, set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` as
environment variables in the Vercel project settings (never commit `.env`).

## Security notes (read before the real world, fine for this hackathon)

These functions use the Supabase **service role key**, which bypasses Row
Level Security entirely. That's what lets a serverless function read/write
any user's rows without us having built real JWT verification — every
endpoint instead trusts whatever `userId` is passed in the request body/query
string. That's an acceptable shortcut for a 36-hour hackathon demo, but it
means anyone who can guess or intercept a `userId` could read or write that
user's medication data. If you have spare time, the fix is to have the
frontend send the user's Supabase auth JWT in an `Authorization` header, and
verify it server-side (`supabase.auth.get_user(token)`) before trusting the
`userId` — don't ship this pattern to real patients as-is.

## Coordinating with the rest of the team

- **Frontend (React)**: calls `/api/search-drugs` for the autocomplete
  input, then `/api/save-medication` / `/api/get-medications` for the
  medication list, then `/api/check-interactions` for the results screen.
  `overlaps` in the `/api/get-medications` response is exactly what the
  timeline/schedule wow-layer view needs — no extra computation required
  on the frontend.
- **Backend Person 2**: their `/api/explain-interaction` output (plain-English
  text) is what should be passed as `planExplanation` to
  `/api/save-interaction-flag` once an interaction is flagged, so it doesn't
  need to be re-generated on every visit.

## Why Python instead of the Node version

Functionally identical — same routes, same request/response shapes, same
Supabase schema. Pick whichever the team is more comfortable shipping fast
in. If you're mixing this with a React frontend on Vercel, both a Python
`api/` folder and a JS frontend can live in one Vercel project side by
side; you don't have to rewrite the frontend to match.
