import json
import os
import threading
import time
import urllib.request
import urllib.error
import concurrent.futures

GEMINI_MODEL = "gemini-2.5-flash"

# --- Cache + single-flight dedup, shared by every Gemini-backed feature ----
# Every component that self-fetches interaction data (StatusBanner,
# InteractionResults, BodyMap, CaregiverMode's second useInteractionCheck
# call feeding the voice assistant, RiskSummaryCard, etc.) hits the backend
# independently — often within milliseconds of each other for the exact
# same medication list. A plain "check cache, else call Gemini" cache does
# NOT stop this: when several requests for the same thing arrive before the
# first one has finished, all of them see an empty cache and all of them
# call Gemini, which made the rate-limit problem worse, not better (each of
# those calls was also being retried on a 429, multiplying it further).
#
# _pending tracks, per cache key, an in-progress call as a threading.Event:
# the first caller in becomes the "owner" and actually calls Gemini; every
# other caller for that same key just waits on the event and reuses the
# owner's result once it's ready. So no matter how many components ask for
# the same thing at once, Gemini is only ever called once for it. Used by
# both explanation caching (per interaction pair) and risk-summary caching
# (per whole medication list) below, via _cached_gemini_call — each with
# its own cache dict but sharing the same lock/pending machinery, since
# their key shapes ("explain:..." vs "risk:...") never collide.
_cache: dict = {}
_pending: dict = {}
_state_lock = threading.Lock()

# --- Retry/backoff for transient 429s --------------------------------------
# Kept short — this delays the ONE owner call per key (see above), not
# every caller, so it no longer multiplies load. Still enough to smooth
# over a single-second burst without making requests feel slow.
MAX_RETRIES = 1
RETRY_BASE_DELAY_SECONDS = 1.0

# --- Circuit breaker --------------------------------------------------------
# If Gemini is actively rate-limiting us, hammering it again on the very
# next request (or retrying) just extends the outage and adds latency for
# no benefit. Once a 429 gets through the retry above, stop calling Gemini
# entirely for a cooldown window — every request during that window falls
# back to its plain, non-AI text immediately (no network call, no wait),
# and normal calls resume automatically once the cooldown passes.
CIRCUIT_COOLDOWN_SECONDS = 45
_circuit_open_until = 0.0


def build_prompt(description: str, drugs: list) -> str:
    drug_text = " + ".join(drugs) if drugs else "unspecified"
    return (
        "Rewrite this drug interaction warning in plain, calm, non-alarming\n"
        "English for a regular person with no medical background. Keep it to 2-3 sentences.\n"
        "Do not add a diagnosis or tell them what to do medically — just explain what the\n"
        "interaction is in plain terms and suggest they mention it to their pharmacist or doctor.\n\n"
        f"Drugs involved: {drug_text}\n"
        f'Warning: "{description}"'
    )


def build_risk_summary_prompt(medications: list, interactions: list) -> str:
    med_names = ", ".join(m.get("name", "") for m in medications if m.get("name")) or "no medications listed"
    if not interactions:
        interactions_text = "No known interactions were found among these medications."
    else:
        interactions_text = "; ".join(
            f"{' + '.join(i.get('drugs', []))} ({i.get('severity')}): {i.get('description', '')}"
            for i in interactions
        )

    return (
        "You are writing a short, calm, plain-language overview for someone looking at their own "
        "medication list in a consumer health app — not a doctor, and not a diagnosis. Write 2-4 "
        "sentences total summarizing their OVERALL interaction risk picture across everything below, "
        "in plain words a non-medical person would understand. If nothing significant was found, say "
        "so plainly and reassuringly rather than inventing concern. Never tell them what to do "
        "medically or add a diagnosis. End with a short, calm suggestion to bring anything significant "
        "up with their pharmacist or doctor.\n\n"
        f"Medications: {med_names}\n"
        f"Flagged interactions: {interactions_text}"
    )


def _circuit_is_open() -> bool:
    return time.time() < _circuit_open_until


def _trip_circuit():
    global _circuit_open_until
    with _state_lock:
        _circuit_open_until = time.time() + CIRCUIT_COOLDOWN_SECONDS


def get_circuit_status() -> dict:
    """
    Powers GET /api/ai-status — lets the frontend show ONE app-wide banner
    ("AI features are running on backup responses right now") instead of
    every Gemini-backed feature (explanations, risk summaries, the voice
    assistant) discovering the same rate limit independently and showing
    its own scattered error. Cheap to poll: no network call, just reads the
    same _circuit_open_until the rest of this module already maintains.
    """
    remaining = _circuit_open_until - time.time()
    if remaining <= 0:
        return {"limited": False, "retryAfterSeconds": 0}
    return {"limited": True, "retryAfterSeconds": int(remaining) + 1}


def call_gemini(prompt: str) -> str:
    """
    Calls Gemini once, retrying with a short backoff specifically on HTTP
    429 (rate limit). Any other error (bad key, network issue, 4xx/5xx
    besides 429) raises immediately, same as before. Raises immediately
    without ever hitting the network if the circuit breaker is currently
    open (see module docstring above) — callers should treat that exactly
    like any other failure (they already do, via their own fallback text).
    """
    if _circuit_is_open():
        raise RuntimeError("Gemini rate limit cooldown is active — skipping the call for now.")

    url = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent"
    api_key = os.environ.get("GEMINI_API_KEY")

    if not api_key:
        raise RuntimeError(
            "GEMINI_API_KEY is missing. Check .env exists and contains "
            "GEMINI_API_KEY=your-key-here"
        )

    payload = json.dumps({
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "thinkingConfig": {"thinkingBudget": 0},  # not needed for a short rewrite — faster this way
            "maxOutputTokens": 200,
        },
    }).encode("utf-8")

    req = urllib.request.Request(
        url,
        data=payload,
        headers={"Content-Type": "application/json", "x-goog-api-key": api_key},
        method="POST",
    )

    last_error = None
    for attempt in range(MAX_RETRIES + 1):
        try:
            with urllib.request.urlopen(req, timeout=10) as response:
                data = json.loads(response.read().decode("utf-8"))
            try:
                return data["candidates"][0]["content"]["parts"][0]["text"]
            except (KeyError, IndexError):
                return ""
        except urllib.error.HTTPError as e:
            last_error = e
            if e.code == 429:
                if attempt < MAX_RETRIES:
                    time.sleep(RETRY_BASE_DELAY_SECONDS * (2 ** attempt))
                    continue
                # Retries exhausted on a real 429 — Gemini is genuinely
                # rate-limited right now. Stop trying for a while instead
                # of letting every subsequent request pay this same cost.
                _trip_circuit()
            raise

    raise last_error


def _cached_gemini_call(key, build_prompt_fn, fallback):
    """
    Shared cache + single-flight + graceful-fallback wrapper for every
    Gemini-backed feature in this file. `key` must already be namespaced
    (e.g. ("explain", ...) vs ("risk", ...)) so different features never
    collide. `build_prompt_fn` is called with no arguments ONLY if this
    call becomes the single-flight "owner" — avoids building a prompt for
    calls that are just going to wait on someone else's result anyway.
    """
    with _state_lock:
        if key in _cache:
            return _cache[key]
        event = _pending.get(key)
        if event is None:
            event = threading.Event()
            _pending[key] = event
            is_owner = True
        else:
            is_owner = False

    if not is_owner:
        event.wait(timeout=15)  # generous cap so a stuck owner can't hang others forever
        with _state_lock:
            if key in _cache:
                return _cache[key]
        # Owner's call didn't finish in time or failed before caching —
        # fall back rather than block indefinitely.
        return fallback

    try:
        result = call_gemini(build_prompt_fn())
    except Exception as e:
        print(f"Gemini call failed for {key}: {e}")
        result = fallback

    with _state_lock:
        _cache[key] = result
        _pending.pop(key, None)
    event.set()
    return result


def _safe_explain(interaction: dict) -> str:
    """
    One plain-language rewrite of a single flagged interaction, cached and
    single-flighted by (sorted drug pair, description) — see
    _cached_gemini_call and the module docstring for why that matters.
    Falls back to the raw curated description (worse than a rewrite, but
    still usable) on any failure rather than crashing the request.
    """
    drugs = tuple(sorted(interaction.get("drugs") or []))
    key = ("explain", drugs, interaction.get("description"))
    return _cached_gemini_call(
        key,
        lambda: build_prompt(interaction["description"], interaction["drugs"]),
        fallback=interaction["description"],
    )


def explain_interactions(interactions: list) -> list:
    """
    Takes the list check_interactions() in main.py already produces —
    each item already has "description" and "drugs" — and adds an
    "explanation" key to each one, in parallel since these are independent
    network calls. A failure on one interaction never blocks the others.
    """
    if not interactions:
        return interactions

    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        explanations = list(pool.map(_safe_explain, interactions))

    for interaction, explanation in zip(interactions, explanations):
        interaction["explanation"] = explanation

    return interactions


_NO_INTERACTIONS_SUMMARY = (
    "No known interactions were found among your current medications. Keep this list up "
    "to date, and mention everything you take at your next pharmacy or doctor visit."
)


def summarize_risk(medications: list, interactions: list) -> str:
    """
    One short, plain-language paragraph summarizing overall interaction
    risk across a whole medication list (RiskSummaryCard.jsx /
    POST /api/risk-summary) — cached and single-flighted by (sorted
    medication names, sorted interaction signatures), same machinery as
    _safe_explain. Falls back to a plain, non-AI summary built from the
    interaction counts (not a fabricated AI-sounding sentence) if Gemini
    is unavailable, rate-limited, or misconfigured.
    """
    med_names = tuple(sorted(m.get("name", "") for m in medications if m.get("name")))
    sev_signature = tuple(
        sorted(f"{'+'.join(sorted(i.get('drugs', [])))}:{i.get('severity')}" for i in interactions)
    )
    key = ("risk", med_names, sev_signature)

    if not interactions:
        fallback = _NO_INTERACTIONS_SUMMARY
    else:
        significant = sum(1 for i in interactions if i.get("severity") == "significant")
        minor = len(interactions) - significant
        parts = []
        if significant:
            parts.append(f"{significant} significant")
        if minor:
            parts.append(f"{minor} minor")
        fallback = (
            f"Found {' and '.join(parts)} interaction{'s' if len(interactions) != 1 else ''} "
            "among your current medications. Review the list below, and bring anything "
            "significant up with your pharmacist or doctor."
        )

    return _cached_gemini_call(
        key,
        lambda: build_risk_summary_prompt(medications, interactions),
        fallback=fallback,
    )
