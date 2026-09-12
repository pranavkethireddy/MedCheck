"""
MedCheck backend — FastAPI app covering the Backend Person 1 endpoints:
drug search, medication CRUD, interaction checking + severity sorting,
interaction-flag persistence, dose-overlap detection, and a mock-patient
demo fallback.

Local dev:   uvicorn app.main:app --reload --port 3000
Deployed:    served via api/index.py as a single Vercel Python function,
             with vercel.json rewriting /api/* to it.
"""

import asyncio
import os
import random
import re
from pathlib import Path
from typing import List, Optional
from urllib.error import HTTPError
from urllib.parse import quote

import requests
from dotenv import load_dotenv
from fastapi import BackgroundTasks, FastAPI, File, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel

from app.backboard_client import recall_memories, remember
from app.body_map import classify_region
from app.drug_name_utils import normalize_drug_name
from app.elevenlabs_client import synthesize_speech, transcribe_speech
from app.gemini_client import explain_interactions, get_circuit_status, summarize_risk
from app.known_interactions import lookup_known_interaction
from app.mock_data import MOCK_PATIENTS
from app.openfda_client import fetch_label_sections, find_mention
from app.overlap import find_schedule_overlaps, parse_time_to_minutes
from app.rxnorm_client import resolve_rxcui_name
from app.severity import sort_interactions_by_severity
from app.supabase_client import get_supabase_client
from app.voice_assistant import interpret_voice_command

# Plain `uvicorn app.main:app` (unlike `vercel dev`) does NOT read .env on
# its own — load it explicitly so SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY
# / CORS_ORIGIN are actually in os.environ before anything below reads them.
# Path is anchored to the project root (one level up from this file's
# `app/` folder) so this works no matter what directory you run uvicorn from.
#
# override=True: a stale value already exported in your shell (e.g. from
# an earlier `export SUPABASE_SERVICE_ROLE_KEY=...`) would otherwise win
# over .env, since load_dotenv() defaults to NOT overriding existing env
# vars — that's a confusing footgun for local dev, so .env always wins here.
load_dotenv(Path(__file__).resolve().parent.parent / ".env", override=True)

app = FastAPI(title="MedCheck Backend")

_CORS_ORIGIN = os.environ.get("CORS_ORIGIN", "*")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[_CORS_ORIGIN],
    allow_methods=["*"],
    allow_headers=["*"],
)


def _with_cors_headers(request: Request, response: JSONResponse) -> JSONResponse:
    """
    CORSMiddleware (added above) normally stamps every response with the
    right Access-Control-Allow-Origin header — except responses built by
    an `@app.exception_handler(...)`. Those run inside Starlette's
    ServerErrorMiddleware, which sits OUTSIDE CORSMiddleware in the
    middleware stack, so any response coming out of the two handlers below
    never gets a CORS header at all. In the browser this doesn't show up
    as "500 error with a message" — the fetch just fails with a generic
    "blocked by CORS policy" and the actual {"error": "..."} body (and
    whatever useful message it carried) never reaches the calling
    component. That's silently turned real backend errors — a RxNorm
    outage, a missing API key, anything — into a dead end that looks like
    the frontend itself is broken. Stamping the header here directly (same
    value CORSMiddleware would have used) closes that gap for every route.
    """
    response.headers["Access-Control-Allow-Origin"] = _CORS_ORIGIN
    if _CORS_ORIGIN != "*":
        response.headers["Vary"] = "Origin"
    return response


# Keep the JSON error shape ({"error": "..."} ) consistent across every
# failure mode — validation errors we raise ourselves, FastAPI's own 404s
# and 405s, and unexpected exceptions — so the frontend only has to handle
# one shape.
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return _with_cors_headers(
        request, JSONResponse(status_code=exc.status_code, content={"error": exc.detail})
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    return _with_cors_headers(
        request, JSONResponse(status_code=500, content={"error": str(exc)})
    )


# ---------------------------------------------------------------------------
# /api/search-drugs — RxNorm autocomplete (plan 5a)
# ---------------------------------------------------------------------------

def search_drugs(query: str) -> list:
    url = f"https://rxnav.nlm.nih.gov/REST/drugs.json?name={quote(query)}"
    resp = requests.get(url, timeout=10)
    if not resp.ok:
        raise RuntimeError(f"RxNorm request failed: {resp.status_code} {resp.reason}")

    data = resp.json()
    groups = (data.get("drugGroup") or {}).get("conceptGroup") or []

    seen = set()
    results = []
    for group in groups:
        for drug in group.get("conceptProperties") or []:
            rxcui = drug.get("rxcui")
            if rxcui in seen:  # dedupe — same rxcui can appear in multiple concept groups
                continue
            seen.add(rxcui)
            results.append({"name": drug.get("name"), "rxcui": rxcui})
    return results


@app.get("/api/search-drugs")
def api_search_drugs(q: str = ""):
    query = q.strip()
    if not query:
        raise HTTPException(400, 'Missing required query param "q" (drug name to search for).')
    return {"query": query, "results": search_drugs(query)}


# ---------------------------------------------------------------------------
# /api/save-medication and /api/get-medications (plan 4c/4d)
# ---------------------------------------------------------------------------

class SaveMedicationBody(BaseModel):
    userId: Optional[str] = None
    name: Optional[str] = None
    rxcui: Optional[str] = None
    timeOfDay: Optional[str] = None


@app.post("/api/save-medication", status_code=201)
def api_save_medication(body: SaveMedicationBody, background_tasks: BackgroundTasks):
    # Plain `def`, not `async def` — nothing in this handler actually
    # awaits anything (the Supabase call below is synchronous), so leaving
    # it `async` would run that blocking network call directly on the
    # shared event loop instead of FastAPI's own thread pool (which is what
    # every sync `def` route here already gets automatically) — freezing
    # every other in-flight request for as long as Supabase takes to
    # respond. See the same fix + explanation on /api/check-interactions
    # and /api/voice/transcribe below, which had the same bug but couldn't
    # just drop `async` since they genuinely need to `await` something.
    if not body.userId or not body.name or not body.rxcui:
        raise HTTPException(400, "Missing required fields: userId, name, rxcui.")

    if body.timeOfDay and parse_time_to_minutes(body.timeOfDay) is None:
        raise HTTPException(400, 'timeOfDay must be in "HH:MM" 24-hour format, e.g. "08:00".')

    supabase = get_supabase_client()
    try:
        result = (
            supabase.table("medications")
            .insert(
                {
                    "user_id": body.userId,
                    "name": body.name,
                    "rxcui": body.rxcui,
                    "time_of_day": body.timeOfDay,
                }
            )
            .execute()
        )
    except Exception as e:
        raise HTTPException(500, f"Failed to save medication: {e}")

    medication = result.data[0] if result.data else None

    # Best-effort: teach the user's Backboard assistant this fact so it's
    # there next session (see app/backboard_client.py — never raises, so a
    # missing/invalid BACKBOARD_API_KEY can't break saving a medication).
    background_tasks.add_task(remember, body.userId, f"Takes {body.name} (rxcui {body.rxcui}).")

    return {"medication": medication}


@app.get("/api/get-medications")
def api_get_medications(userId: str = ""):
    user_id = userId.strip()
    if not user_id:
        raise HTTPException(400, 'Missing required query param "userId".')

    supabase = get_supabase_client()
    try:
        result = (
            supabase.table("medications")
            .select("*")
            .eq("user_id", user_id)
            .order("created_at")
            .execute()
        )
    except Exception as e:
        raise HTTPException(500, f"Failed to fetch medications: {e}")

    medications = result.data or []
    # Timeline/schedule wow layer (plan Priority 2): flag meds whose
    # time_of_day values fall within the same ~60 min window so the
    # frontend can highlight overlaps on a day-view without recomputing
    # this itself.
    overlaps = find_schedule_overlaps(medications)
    return {"medications": medications, "overlaps": overlaps}


@app.delete("/api/delete-medication")
def api_delete_medication(id: str = "", userId: str = ""):
    """
    Not in the original plan doc, but the frontend's medication list
    already has a "Remove" button that expects this to actually delete the
    row (not just hide it locally) — added to support that.

    Scoped by BOTH id and userId (not just id): our service-role key
    already bypasses RLS, so this is the only thing stopping one user's
    guessed/leaked medication id from deleting a different user's row.
    """
    med_id = id.strip()
    user_id = userId.strip()
    if not med_id or not user_id:
        raise HTTPException(400, 'Missing required query params "id" and "userId".')

    supabase = get_supabase_client()
    try:
        result = (
            supabase.table("medications")
            .delete()
            .eq("id", med_id)
            .eq("user_id", user_id)
            .execute()
        )
    except Exception as e:
        raise HTTPException(500, f"Failed to delete medication: {e}")

    deleted = result.data or []
    if not deleted:
        raise HTTPException(404, "No medication found with that id for this user.")

    return {"deleted": True, "medication": deleted[0]}


class UpdateMedicationBody(BaseModel):
    id: Optional[str] = None
    userId: Optional[str] = None
    timeOfDay: Optional[str] = None


@app.patch("/api/update-medication")
def api_update_medication(body: UpdateMedicationBody):
    """
    Lets the frontend fill in (or change) a medication's time_of_day after
    the fact — needed because existing rows may have a blank time and new
    adds now require one. Scoped by BOTH id and userId (not just id), same
    reasoning as /api/delete-medication: our service-role key bypasses RLS,
    so this is what stops one user's guessed/leaked medication id from
    being used to modify a different user's row.
    """
    med_id = (body.id or "").strip()
    user_id = (body.userId or "").strip()
    if not med_id or not user_id:
        raise HTTPException(400, "Missing required fields: id, userId.")

    time_value = (body.timeOfDay or "").strip() or None
    if time_value and parse_time_to_minutes(time_value) is None:
        raise HTTPException(400, 'timeOfDay must be in "HH:MM" 24-hour format, e.g. "08:00".')

    supabase = get_supabase_client()
    try:
        result = (
            supabase.table("medications")
            .update({"time_of_day": time_value})
            .eq("id", med_id)
            .eq("user_id", user_id)
            .execute()
        )
    except Exception as e:
        raise HTTPException(500, f"Failed to update medication: {e}")

    updated = result.data or []
    if not updated:
        raise HTTPException(404, "No medication found with that id for this user.")

    return {"medication": updated[0]}


# ---------------------------------------------------------------------------
# /api/check-interactions (plan 5b/5c)
#
# NOTE: the plan originally called for RxNav's Drug Interaction API
# (/REST/interaction/list.json). NLM discontinued that service on Jan 2,
# 2024 with no official replacement (confirmed against NLM's own RxNav FAQ
# — see README "Why not RxNav's interaction API"). This checks two sources
# instead, so it still works for arbitrary drug names:
#   1. app/known_interactions.py — a small curated list of well-documented
#      pairs. Fast, free, deterministic — always correct for what it
#      covers, which is why it's checked first.
#   2. app/openfda_client.py — live text-matching against the drugs' own
#      FDA labels (openFDA, free, no key). Covers any drug with a US FDA
#      label, at the cost of being a heuristic (plain substring match on
#      label text) rather than a curated clinical judgment.
# A pair with no evidence from either source is simply omitted from the
# results, same behavior as the old RxNav-backed version.
# ---------------------------------------------------------------------------

def _parse_rxcuis(raw) -> List[str]:
    if isinstance(raw, list):
        return [str(x) for x in raw if x]
    if isinstance(raw, str):
        return [s.strip() for s in re.split(r"[+, ]", raw) if s.strip()]
    return []


def _parse_drugs_from_body(body: dict) -> List[dict]:
    """
    Preferred POST shape: {"drugs": [{"rxcui": "...", "name": "..."}, ...]}
    — lets the caller (which usually already has both, from search-drugs
    or get-medications) skip an extra RxNorm round trip for the name.
    Still accepts the legacy {"rxcuis": [...]} shape, resolving names via
    RxNorm since none were given.
    """
    if isinstance(body.get("drugs"), list):
        drugs = []
        for d in body["drugs"]:
            if not isinstance(d, dict):
                continue
            rxcui = str(d.get("rxcui") or "").strip()
            if rxcui:
                drugs.append({"rxcui": rxcui, "name": d.get("name")})
        return drugs
    return [{"rxcui": r, "name": None} for r in _parse_rxcuis(body.get("rxcuis"))]


def _resolve_names(drugs: List[dict]) -> List[dict]:
    resolved = []
    for d in drugs:
        name = d.get("name") or resolve_rxcui_name(d["rxcui"])
        # fall back to the rxcui itself so normalize_drug_name never sees
        # None — worst case this just fails to match anything, rather than
        # crashing the whole request over one unresolvable drug.
        resolved.append({"rxcui": d["rxcui"], "name": name or d["rxcui"]})
    return resolved


def check_interactions(drugs: List[dict]) -> list:
    resolved = _resolve_names(drugs)
    entries = [(d["rxcui"], d["name"], normalize_drug_name(d["name"])) for d in resolved]
 
    label_cache: dict = {}
 
    def get_label(norm_name):
        if norm_name not in label_cache:
            label_cache[norm_name] = fetch_label_sections(norm_name) if norm_name else {}
        return label_cache[norm_name]
 
    interactions = []
    for i in range(len(entries)):
        for j in range(i + 1, len(entries)):
            _, name_i, norm_i = entries[i]
            _, name_j, norm_j = entries[j]
            if not norm_i or not norm_j:
                continue
 
            curated = lookup_known_interaction(norm_i, norm_j)
            if curated:
                interactions.append(
                    {
                        "severity": curated["severity"],
                        "description": curated["description"],
                        "drugs": [name_i, name_j],
                        "source": "curated",
                        "region": curated["region"],
                        "min_hours_apart": curated.get("min_hours_apart"),
                        "spacing_note": curated.get("spacing_note"),
                    }
                )
                continue

            match = find_mention(get_label(norm_i), norm_j)
            matched_label_drug, matched_other_drug = name_i, name_j
            if not match:
                match = find_mention(get_label(norm_j), norm_i)
                matched_label_drug, matched_other_drug = name_j, name_i

            if match:
                section_name, severity, snippet = match
                interactions.append(
                    {
                        "severity": severity,
                        "description": (
                            f'{matched_label_drug}\'s FDA label mentions {matched_other_drug} '
                            f'in its "{section_name}" section.'
                        ),
                        "drugs": [name_i, name_j],
                        "source": "openfda",
                        "evidence": snippet,
                        # openFDA hits have no curated region, so classify off
                        # the actual label text (which has real clinical
                        # language) rather than the generic templated
                        # "description" above — see app/body_map.py.
                        "region": classify_region(f"{section_name} {snippet}"),
                        # openFDA label hits don't carry curated
                        # spacing/timing guidance the way KNOWN_INTERACTIONS
                        # entries do, so — rather than guessing a "wait N
                        # hours" number with no real backing — default to an
                        # honest, severity-aware nudge toward a pharmacist.
                        "min_hours_apart": None,
                        "spacing_note": (
                            "This interaction is significant enough that timing alone isn't a "
                            "reliable fix — check with a pharmacist or prescriber before combining these."
                            if severity == "significant"
                            else "Ask a pharmacist whether spacing these doses apart helps in this case."
                        ),
                    }
                )
 
    sorted_interactions = sort_interactions_by_severity(interactions)
    return explain_interactions(sorted_interactions)
    


@app.api_route("/api/check-interactions", methods=["GET", "POST"])
async def api_check_interactions(request: Request, background_tasks: BackgroundTasks):
    user_id = None
    if request.method == "POST":
        try:
            body = await request.json()
        except Exception:
            body = {}
        drugs = _parse_drugs_from_body(body or {})
        user_id = (body or {}).get("userId")
    else:
        drugs = [{"rxcui": r, "name": None} for r in _parse_rxcuis(request.query_params.get("rxcuis", ""))]
        user_id = request.query_params.get("userId")

    if len(drugs) < 2:
        raise HTTPException(
            400,
            "Need at least 2 drugs to check for interactions. "
            "Example: /api/check-interactions?rxcuis=11289+5640",
        )

    # check_interactions() is a plain blocking function — it makes several
    # synchronous RxNorm/openFDA HTTP calls (each up to a 10s timeout) in a
    # nested loop over every drug pair. This route has to stay `async def`
    # (it needs `await request.json()` above to support both GET and POST),
    # but calling a blocking function directly inside an async route runs
    # it on the single shared event loop — freezing every other request
    # this server is handling, including totally unrelated ones like the
    # /api/ai-status polling the frontend does every 5 seconds — for the
    # entire time those network calls take. `asyncio.to_thread` runs it on
    # a worker thread instead, so the event loop stays free to keep serving
    # everyone else while this one request waits on the network.
    interactions = await asyncio.to_thread(check_interactions, drugs)

    # Best-effort: remember any flagged interaction so it's there next
    # session too (see app/backboard_client.py). Only fires when the caller
    # passed a real userId — anonymous/demo checks aren't persisted anywhere.
    if user_id:
        for interaction in interactions:
            background_tasks.add_task(
                remember,
                user_id,
                f"Flagged interaction ({interaction['severity']}): "
                f"{' + '.join(interaction['drugs'])} — {interaction['description']}",
            )

    return {"rxcuis": [d["rxcui"] for d in drugs], "interactions": interactions}


class RiskSummaryBody(BaseModel):
    medications: Optional[List[dict]] = None
    interactions: Optional[List[dict]] = None


@app.post("/api/risk-summary")
def api_risk_summary(body: RiskSummaryBody):
    """
    One short, plain-language paragraph summarizing overall interaction
    risk across a whole medication list (RiskSummaryCard.jsx). Takes the
    same `medications` list and `interactions` result the frontend already
    has from /api/check-interactions, rather than recomputing interactions
    itself — this endpoint is purely "turn what's already been found into
    a readable overview," same division of responsibility as
    explain_interactions vs. check_interactions.
    """
    medications = body.medications or []
    interactions = body.interactions or []
    summary = summarize_risk(medications, interactions)
    return {"summary": summary}


@app.get("/api/ai-status")
def api_ai_status(pool: str = "default"):
    """
    Lets the frontend show ONE app-wide "AI features are running on backup
    responses right now" banner instead of every Gemini-backed feature
    (interaction explanations, the risk summary, the voice assistant)
    discovering the same rate limit independently. Cheap — no network call,
    just reads gemini_client's shared circuit-breaker state. Polled every
    few seconds by useAiStatus.js.

    `pool` distinguishes the two independent Gemini keys/quotas (see
    gemini_client.py's GEMINI_API_KEY_ENV_BY_POOL): "default" covers
    interaction explanations + the risk summary (what AiStatusBanner shows
    app-wide), "voice" covers only the caregiver voice assistant (what
    VoiceAssistant.jsx's own mic-cooldown state tracks) — a rate limit on
    one no longer greys out the other.
    """
    return get_circuit_status(pool=pool if pool == "voice" else "default")


# ---------------------------------------------------------------------------
# /api/memory/* — Backboard-backed persistent memory ("Best Use of Backboard")
#
# Backed by app/backboard_client.py, which wraps the official backboard-sdk
# (create_assistant / add_memory / get_memories). One Backboard "assistant"
# per MedCheck user, looked up/created lazily and cached in the user_memory
# Supabase table (see supabase_sql/schema.sql) so it's created at most once per
# user. Every function in backboard_client.py is best-effort — a missing or
# invalid BACKBOARD_API_KEY degrades to "no memory" rather than a 500, same
# philosophy as the Gemini explanation step above.
# ---------------------------------------------------------------------------


class SaveMemoryBody(BaseModel):
    userId: Optional[str] = None
    content: Optional[str] = None
    metadata: Optional[dict] = None


@app.post("/api/memory/save", status_code=201)
async def api_save_memory(body: SaveMemoryBody):
    if not body.userId or not body.content:
        raise HTTPException(400, "Missing required fields: userId, content.")

    await remember(body.userId, body.content, body.metadata)
    return {"saved": True}


@app.get("/api/memory/list")
async def api_list_memory(userId: str = ""):
    user_id = userId.strip()
    if not user_id:
        raise HTTPException(400, 'Missing required query param "userId".')

    memories = await recall_memories(user_id)
    return {"memories": memories}


# ---------------------------------------------------------------------------
# /api/save-interaction-flag (plan 4e)
# ---------------------------------------------------------------------------

VALID_SEVERITIES = {"none", "minor", "significant"}


class SaveInteractionFlagBody(BaseModel):
    userId: Optional[str] = None
    drugA: Optional[str] = None
    drugB: Optional[str] = None
    severity: Optional[str] = None
    rawDescription: Optional[str] = None
    planExplanation: Optional[str] = None


@app.post("/api/save-interaction-flag", status_code=201)
def api_save_interaction_flag(body: SaveInteractionFlagBody):
    if not body.userId or not body.drugA or not body.drugB or not body.severity:
        raise HTTPException(400, "Missing required fields: userId, drugA, drugB, severity.")

    if body.severity not in VALID_SEVERITIES:
        raise HTTPException(400, f"severity must be one of: {', '.join(sorted(VALID_SEVERITIES))}")

    supabase = get_supabase_client()
    try:
        result = (
            supabase.table("interaction_flags")
            .insert(
                {
                    "user_id": body.userId,
                    "drug_a": body.drugA,
                    "drug_b": body.drugB,
                    "severity": body.severity,
                    "raw_description": body.rawDescription,
                    "plain_explanation": body.planExplanation,
                }
            )
            .execute()
        )
    except Exception as e:
        raise HTTPException(500, f"Failed to save interaction flag: {e}")

    flag = result.data[0] if result.data else None
    return {"flag": flag}


# ---------------------------------------------------------------------------
# /api/mock-patients (plan 5d)
# ---------------------------------------------------------------------------

@app.get("/api/mock-patients")
def api_mock_patients():
    return {"patients": MOCK_PATIENTS}


# ---------------------------------------------------------------------------
# /api/caregiver/* — real caregiver linking, replacing the hardcoded demo
# directory that used to live in frontend/src/CaregiverMode.jsx. Two tables
# back this (see backend/supabase_sql/schema.sql):
#
#   caregiver_access_codes (user_id, code, display_name)
#     One stable, shareable code per patient — created lazily the first
#     time /api/caregiver/my-code is called for that user.
#
#   caregiver_links (caregiver_user_id, patient_user_id)
#     Created when a caregiver successfully redeems someone's code. This is
#     the actual security boundary: /api/caregiver/patient-medications
#     refuses to return a patient's medications unless a row here proves
#     that caregiver was actually granted access.
#
# The frontend still keeps its own hardcoded two-patient demo directory as
# a fallback for demo mode / an unreachable backend (same graceful-
# degradation pattern as everywhere else in this app) — these endpoints are
# what real, logged-in users actually hit.
# ---------------------------------------------------------------------------


def _generate_unique_caregiver_code(supabase) -> str:
    """
    Picks a short "MED-####" code not already in caregiver_access_codes.
    Collisions are vanishingly rare at this scale, but we still check
    rather than trust it — a duplicate code would let one patient's
    caregiver accidentally (or maliciously) end up linked to someone else.
    """
    for _ in range(20):
        candidate = f"MED-{random.randint(1000, 9999)}"
        existing = (
            supabase.table("caregiver_access_codes")
            .select("code")
            .eq("code", candidate)
            .limit(1)
            .execute()
        )
        if not existing.data:
            return candidate
    # Effectively unreachable with only a few thousand users, but widen the
    # range rather than ever fail a request outright.
    return f"MED-{random.randint(10000, 99999)}"


@app.get("/api/caregiver/my-code")
def api_caregiver_my_code(userId: str = "", displayName: str = ""):
    """
    Returns this user's own caregiver access code, generating and storing
    one on first call. Stable across calls — regenerating a new code every
    time would break any caregiver who'd already been given the old one.
    """
    user_id = userId.strip()
    if not user_id:
        raise HTTPException(400, 'Missing required query param "userId".')

    supabase = get_supabase_client()
    try:
        existing = (
            supabase.table("caregiver_access_codes")
            .select("code")
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
    except Exception as e:
        raise HTTPException(500, f"Failed to look up access code: {e}")

    if existing.data:
        return {"code": existing.data[0]["code"]}

    code = _generate_unique_caregiver_code(supabase)
    try:
        supabase.table("caregiver_access_codes").insert(
            {"user_id": user_id, "code": code, "display_name": displayName.strip() or None}
        ).execute()
    except Exception as e:
        raise HTTPException(500, f"Failed to create access code: {e}")

    return {"code": code}


class CaregiverLinkBody(BaseModel):
    callerId: Optional[str] = None
    code: Optional[str] = None


@app.post("/api/caregiver/link", status_code=201)
def api_caregiver_link(body: CaregiverLinkBody):
    """
    Redeems a patient's access code for the logged-in caregiver, creating
    the caregiver_links row that /api/caregiver/patient-medications later
    checks. Returns the patient's display name so the frontend can show a
    friendly tab immediately, without a second round-trip.
    """
    caller_id = (body.callerId or "").strip()
    code = (body.code or "").strip().upper()
    if not caller_id or not code:
        raise HTTPException(400, "Missing required fields: callerId, code.")

    supabase = get_supabase_client()
    try:
        code_row = (
            supabase.table("caregiver_access_codes")
            .select("user_id, display_name")
            .eq("code", code)
            .limit(1)
            .execute()
        )
    except Exception as e:
        raise HTTPException(500, f"Failed to look up access code: {e}")

    if not code_row.data:
        raise HTTPException(404, "That code doesn't match any patient. Double-check it and try again.")

    patient_id = code_row.data[0]["user_id"]
    display_name = code_row.data[0].get("display_name") or "Patient"

    if patient_id == caller_id:
        raise HTTPException(400, "You can't add yourself as a patient.")

    try:
        existing_link = (
            supabase.table("caregiver_links")
            .select("id")
            .eq("caregiver_user_id", caller_id)
            .eq("patient_user_id", patient_id)
            .limit(1)
            .execute()
        )
    except Exception as e:
        raise HTTPException(500, f"Failed to check existing caregiver link: {e}")

    if existing_link.data:
        raise HTTPException(409, "You already have access to this patient.")

    try:
        supabase.table("caregiver_links").insert(
            {"caregiver_user_id": caller_id, "patient_user_id": patient_id}
        ).execute()
    except Exception as e:
        raise HTTPException(500, f"Failed to link patient: {e}")

    return {"patientId": patient_id, "name": display_name}


@app.get("/api/caregiver/patients")
def api_caregiver_patients(callerId: str = ""):
    """Every patient the logged-in caregiver currently has access to."""
    caller_id = callerId.strip()
    if not caller_id:
        raise HTTPException(400, 'Missing required query param "callerId".')

    supabase = get_supabase_client()
    try:
        links = (
            supabase.table("caregiver_links")
            .select("patient_user_id")
            .eq("caregiver_user_id", caller_id)
            .execute()
        )
    except Exception as e:
        raise HTTPException(500, f"Failed to fetch linked patients: {e}")

    patient_ids = [row["patient_user_id"] for row in (links.data or [])]
    if not patient_ids:
        return {"patients": []}

    try:
        codes = (
            supabase.table("caregiver_access_codes")
            .select("user_id, display_name")
            .in_("user_id", patient_ids)
            .execute()
        )
    except Exception as e:
        raise HTTPException(500, f"Failed to fetch patient names: {e}")

    names_by_id = {row["user_id"]: row.get("display_name") or "Patient" for row in (codes.data or [])}
    patients = [{"patientId": pid, "name": names_by_id.get(pid, "Patient")} for pid in patient_ids]
    return {"patients": patients}


@app.get("/api/caregiver/patient-medications")
def api_caregiver_patient_medications(callerId: str = "", patientId: str = ""):
    """
    Same shape as /api/get-medications, but only after confirming a
    caregiver_links row actually grants callerId access to patientId. This
    check is the real security boundary of the whole caregiver feature —
    without it, any caregiver could pass any patientId and read someone
    else's medications.
    """
    caller_id = callerId.strip()
    patient_id = patientId.strip()
    if not caller_id or not patient_id:
        raise HTTPException(400, 'Missing required query params "callerId" and "patientId".')

    supabase = get_supabase_client()
    try:
        link = (
            supabase.table("caregiver_links")
            .select("id")
            .eq("caregiver_user_id", caller_id)
            .eq("patient_user_id", patient_id)
            .limit(1)
            .execute()
        )
    except Exception as e:
        raise HTTPException(500, f"Failed to verify caregiver access: {e}")

    if not link.data:
        raise HTTPException(403, "You don't have access to this patient's medications.")

    return api_get_medications(userId=patient_id)


# ---------------------------------------------------------------------------
# /api/caregiver/log-medication-taken and /api/caregiver/medication-log —
# a caregiver-side "was this actually taken" log. Deliberately caregiver-
# only (not exposed anywhere in Individual mode): the point is a caregiver
# recording what they observed for someone they're looking after, not a
# patient's own self-tracking, which is a different feature.
# ---------------------------------------------------------------------------


class LogMedicationTakenBody(BaseModel):
    callerId: Optional[str] = None
    patientId: Optional[str] = None
    medicationName: Optional[str] = None
    takenAt: Optional[str] = None  # ISO timestamp; defaults to "now" if omitted


@app.post("/api/caregiver/log-medication-taken", status_code=201)
def api_log_medication_taken(body: LogMedicationTakenBody):
    caller_id = (body.callerId or "").strip()
    patient_id = (body.patientId or "").strip()
    medication_name = (body.medicationName or "").strip()
    if not caller_id or not patient_id or not medication_name:
        raise HTTPException(400, "Missing required fields: callerId, patientId, medicationName.")

    supabase = get_supabase_client()
    try:
        link = (
            supabase.table("caregiver_links")
            .select("id")
            .eq("caregiver_user_id", caller_id)
            .eq("patient_user_id", patient_id)
            .limit(1)
            .execute()
        )
    except Exception as e:
        raise HTTPException(500, f"Failed to verify caregiver access: {e}")

    if not link.data:
        raise HTTPException(403, "You don't have access to log medications for this patient.")

    row = {
        "patient_user_id": patient_id,
        "caregiver_user_id": caller_id,
        "medication_name": medication_name,
    }
    if body.takenAt:
        row["taken_at"] = body.takenAt

    try:
        result = supabase.table("medication_dose_logs").insert(row).execute()
    except Exception as e:
        raise HTTPException(500, f"Failed to log medication: {e}")

    return {"log": result.data[0] if result.data else None}


@app.get("/api/caregiver/medication-log")
def api_get_medication_log(callerId: str = "", patientId: str = ""):
    caller_id = callerId.strip()
    patient_id = patientId.strip()
    if not caller_id or not patient_id:
        raise HTTPException(400, 'Missing required query params "callerId" and "patientId".')

    supabase = get_supabase_client()
    try:
        link = (
            supabase.table("caregiver_links")
            .select("id")
            .eq("caregiver_user_id", caller_id)
            .eq("patient_user_id", patient_id)
            .limit(1)
            .execute()
        )
    except Exception as e:
        raise HTTPException(500, f"Failed to verify caregiver access: {e}")

    if not link.data:
        raise HTTPException(403, "You don't have access to this patient's medication log.")

    try:
        logs = (
            supabase.table("medication_dose_logs")
            .select("*")
            .eq("patient_user_id", patient_id)
            .order("taken_at", desc=True)
            .execute()
        )
    except Exception as e:
        raise HTTPException(500, f"Failed to fetch medication log: {e}")

    return {"log": logs.data or []}


# ---------------------------------------------------------------------------
# /api/voice/* — ElevenLabs-backed voice assistant (Best Use of ElevenLabs
# track). Three pieces, kept as separate small endpoints rather than one
# do-everything call, so each is independently testable and the frontend
# can use just the parts it needs:
#
#   /api/voice/speak        text -> mp3 audio bytes (ElevenLabs TTS)
#   /api/voice/transcribe   recorded audio -> transcript text (ElevenLabs STT)
#   /api/voice/assistant     transcript + context -> { action, ..., responseText }
#                            (Gemini decides what the caregiver meant; see
#                            app/voice_assistant.py)
#
# The frontend chains these itself (record -> transcribe -> assistant ->
# speak the responseText) rather than this doing it server-side in one
# call, so each step's latency/failure is visible and debuggable on its own.
# ---------------------------------------------------------------------------


class VoiceSpeakBody(BaseModel):
    text: Optional[str] = None


@app.post("/api/voice/speak")
def api_voice_speak(body: VoiceSpeakBody):
    text = (body.text or "").strip()
    if not text:
        raise HTTPException(400, "Missing required field: text.")

    try:
        audio_bytes = synthesize_speech(text)
    except Exception as e:
        raise HTTPException(502, f"Text-to-speech failed: {e}")

    return Response(content=audio_bytes, media_type="audio/mpeg")


@app.post("/api/voice/transcribe")
async def api_voice_transcribe(audio: UploadFile = File(...)):
    audio_bytes = await audio.read()
    if not audio_bytes:
        raise HTTPException(400, "Missing required file: audio.")

    try:
        # Same event-loop-blocking issue as /api/check-interactions above:
        # transcribe_speech() is a synchronous call to ElevenLabs that can
        # take up to 30 seconds. Without asyncio.to_thread, that single
        # voice request would freeze the ENTIRE backend — every teammate,
        # every open tab, every other endpoint — for the whole 30 seconds,
        # which is almost certainly why voice has felt broken rather than
        # just slow: it wasn't failing, it was quietly stalling the whole
        # server while everyone else's requests piled up behind it.
        text = await asyncio.to_thread(
            transcribe_speech, audio_bytes, content_type=audio.content_type or "audio/webm"
        )
    except Exception as e:
        raise HTTPException(502, f"Speech-to-text failed: {e}")

    return {"text": text}


class VoiceAssistantBody(BaseModel):
    transcript: Optional[str] = None
    patients: Optional[List[dict]] = None
    currentPatientId: Optional[str] = None
    currentPatientName: Optional[str] = None
    currentPatientMedications: Optional[List[dict]] = None
    currentPatientInteractions: Optional[List[dict]] = None


@app.post("/api/voice/assistant")
def api_voice_assistant(body: VoiceAssistantBody):
    transcript = (body.transcript or "").strip()
    if not transcript:
        raise HTTPException(400, "Missing required field: transcript.")

    try:
        result = interpret_voice_command(
            transcript=transcript,
            patients=body.patients or [],
            current_patient_name=body.currentPatientName,
            current_patient_medications=body.currentPatientMedications or [],
            current_patient_interactions=body.currentPatientInteractions or [],
        )
    except HTTPError as e:
        # call_gemini() already retries a 429 once with backoff (see
        # gemini_client.py) — if it still failed, Gemini's free-tier rate
        # limit is genuinely exhausted for the moment, so say that plainly
        # instead of surfacing the raw urllib error string.
        if e.code == 429:
            raise HTTPException(
                429,
                "The AI assistant is getting a lot of requests right now — wait a few "
                "seconds and try again.",
            )
        raise HTTPException(502, f"Voice assistant failed: {e}")
    except Exception as e:
        # gemini_client's circuit breaker raises a plain RuntimeError (not
        # an HTTPError) once it's tripped, so it lands here rather than
        # the branch above — still worth a 429 with the same friendly
        # message rather than a generic 502.
        if "rate limit" in str(e).lower():
            raise HTTPException(
                429,
                "The AI assistant is getting a lot of requests right now — wait a few "
                "seconds and try again.",
            )
        raise HTTPException(502, f"Voice assistant failed: {e}")

    return result
