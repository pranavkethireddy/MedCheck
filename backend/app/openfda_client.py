"""
Fallback interaction check for any drug not covered by our curated list
(app/known_interactions.py): fetch the drug's official FDA label via
openFDA (free, no key required — see https://open.fda.gov) and text-search
its interaction-relevant sections for the other drug's name.

This is a heuristic, not a clinical-grade check: label text is written by
each manufacturer, section content varies, and a plain substring match can
miss synonyms or over-match unrelated mentions. It's meant to widen
coverage beyond the curated list, not replace clinical judgment — same
"conversation starter" framing as the rest of the app.

No API key needed for hackathon-scale usage: openFDA allows 240 req/min
and 1,000 req/day per IP without a key (https://open.fda.gov/apis/authentication/).
"""

from urllib.parse import quote

import requests

OPENFDA_LABEL_URL = "https://api.fda.gov/drug/label.json"

# Sections we check, ordered by how strongly they signal real clinical
# significance — used to assign a severity bucket to whatever section the
# match was found in.
SECTION_SEVERITY = [
    ("boxed_warning", "significant"),
    ("contraindications", "significant"),
    ("drug_interactions", "minor"),
    ("drug_and_or_laboratory_test_interactions", "minor"),
    ("warnings", "minor"),
    ("warnings_and_cautions", "minor"),
    ("precautions", "minor"),
    ("general_precautions", "minor"),
]

# openFDA's `openfda.*` fields are populated from FDA's own product
# catalog, so a name that doesn't exactly match won't be found — we try a
# few of the fields FDA labels are commonly indexed under.
NAME_FIELDS = ["generic_name", "substance_name", "brand_name"]


def fetch_label_sections(name: str, timeout: int = 10) -> dict:
    """
    Returns { section_name: "joined lowercase text" } for whichever of
    SECTION_SEVERITY's sections exist on this drug's label. Returns {} if
    no label is found or the request fails — callers should treat that as
    "no evidence found", not an error, so one drug lacking a label doesn't
    break checking the rest.
    """
    if not name:
        return {}

    for field in NAME_FIELDS:
        query = f'openfda.{field}:"{quote(name)}"'
        url = f"{OPENFDA_LABEL_URL}?search={query}&limit=1"
        try:
            resp = requests.get(url, timeout=timeout)
        except requests.RequestException:
            continue  # try the next field / give up quietly

        if resp.status_code == 404:
            continue  # openFDA returns 404 for "no results", not an error
        if not resp.ok:
            continue

        data = resp.json()
        results = data.get("results") or []
        if not results:
            continue

        label = results[0]
        sections = {}
        for section_name, _severity in SECTION_SEVERITY:
            values = label.get(section_name)
            if values:
                sections[section_name] = " ".join(values).lower()
        return sections

    return {}


def find_mention(sections: dict, other_name_normalized: str):
    """
    Looks through `sections` (as returned by fetch_label_sections) in
    priority order for a mention of `other_name_normalized`. Returns
    (section_name, severity, snippet) for the first match, or None.
    """
    if not other_name_normalized:
        return None

    for section_name, severity in SECTION_SEVERITY:
        text = sections.get(section_name)
        if not text or other_name_normalized not in text:
            continue

        idx = text.find(other_name_normalized)
        start = max(0, idx - 60)
        end = min(len(text), idx + len(other_name_normalized) + 60)
        snippet = text[start:end].strip()
        return section_name, severity, snippet

    return None
