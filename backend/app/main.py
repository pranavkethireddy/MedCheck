"""
MedCheck backend — FastAPI app covering the Backend Person 1 endpoints:
drug search, medication CRUD, interaction checking + severity sorting,
interaction-flag persistence, dose-overlap detection, and a mock-patient
demo fallback.

Local dev:   uvicorn app.main:app --reload --port 3000
Deployed:    served via api/index.py as a single Vercel Python function,
             with vercel.json rewriting /api/* to it.
"""

import os
import re
from pathlib import Path
from typing import List, Optional
from urllib.parse import quote

import requests
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.drug_name_utils import normalize_drug_name
from app.gemini_client import explain_interactions
from app.known_interactions import lookup_known_interaction
from app.mock_data import MOCK_PATIENTS
from app.openfda_client import fetch_label_sections, find_mention
from app.overlap import find_schedule_overlaps, parse_time_to_minutes
from app.rxnorm_client import resolve_rxcui_name
from app.severity import sort_interactions_by_severity
from app.supabase_client import get_supabase_client

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

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.environ.get("CORS_ORIGIN", "*")],
    allow_methods=["*"],
    allow_headers=["*"],
)


# Keep the JSON error shape ({"error": "..."} ) consistent across every
# failure mode — validation errors we raise ourselves, FastAPI's own 404s
# and 405s, and unexpected exceptions — so the frontend only has to handle
# one shape.
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(status_code=exc.status_code, content={"error": exc.detail})


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    return JSONResponse(status_code=500, content={"error": str(exc)})


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
def api_save_medication(body: SaveMedicationBody):
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
                    }
                )
 
    sorted_interactions = sort_interactions_by_severity(interactions)
    return explain_interactions(sorted_interactions)
    


@app.api_route("/api/check-interactions", methods=["GET", "POST"])
async def api_check_interactions(request: Request):
    if request.method == "POST":
        try:
            body = await request.json()
        except Exception:
            body = {}
        drugs = _parse_drugs_from_body(body or {})
    else:
        drugs = [{"rxcui": r, "name": None} for r in _parse_rxcuis(request.query_params.get("rxcuis", ""))]

    if len(drugs) < 2:
        raise HTTPException(
            400,
            "Need at least 2 drugs to check for interactions. "
            "Example: /api/check-interactions?rxcuis=11289+5640",
        )

    interactions = check_interactions(drugs)
    return {"rxcuis": [d["rxcui"] for d in drugs], "interactions": interactions}


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
