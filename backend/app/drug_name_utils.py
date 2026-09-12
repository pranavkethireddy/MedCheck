"""
Small helper for turning a full drug/product name (as it comes back from
RxNorm search — e.g. "ibuprofen 200 MG Oral Tablet") into a normalized
generic-ingredient-ish string suitable for matching against the curated
interaction list and openFDA label text.

This is intentionally simple (no NLP): lowercase, then cut off at the
first digit or parenthesis, since RxNorm clinical-drug names put the
dose/strength/form right after the ingredient name.
"""

import re

_CUTOFF_RE = re.compile(r"[\d(]")


def normalize_drug_name(name: str) -> str:
    if not name:
        return ""
    cut = _CUTOFF_RE.search(name)
    core = name[: cut.start()] if cut else name
    return core.strip().lower()
