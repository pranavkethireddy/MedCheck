"""
Thin RxNorm helpers used by /api/check-interactions when the caller only
sends rxcuis (no drug names) — resolves each rxcui to its display name so
we have something to match against the curated list and openFDA labels.

Note: this is plain RxNorm (still live and maintained by NLM), NOT the
RxNav Drug Interaction API, which was discontinued Jan 2, 2024 — see
app/known_interactions.py for why that matters here.
"""

import requests

RXNORM_BASE = "https://rxnav.nlm.nih.gov/REST"


def resolve_rxcui_name(rxcui: str, timeout: int = 10):
    """Returns the RxNorm display name for an rxcui, or None if unavailable."""
    if not rxcui:
        return None
    url = f"{RXNORM_BASE}/rxcui/{rxcui}.json"
    try:
        resp = requests.get(url, timeout=timeout)
    except requests.RequestException:
        return None

    if not resp.ok:
        return None

    data = resp.json()
    return (data.get("idGroup") or {}).get("name")
