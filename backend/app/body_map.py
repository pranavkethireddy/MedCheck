"""
Maps each interaction to a body region so the frontend's BodyMap.jsx can
drop a pin on a body outline instead of (or alongside) the plain-text list.

Curated interactions (app/known_interactions.py) carry an explicit, manually
assigned "region" — that's clinically-informed and always correct for what
it covers. Interactions found only via openFDA label text-matching don't
have that, since we don't know in advance which drug pair or label text
we'll see, so `classify_region` does a cheap keyword search over the
matched FDA label snippet instead. It's a heuristic, same spirit as the rest
of the openFDA fallback path (see openfda_client.py) — good enough to point
at roughly the right part of the body, not a clinical classification.

Keys here MUST match REGION_META's keys in frontend/src/BodyMap.jsx exactly
— the frontend owns where each region is actually drawn/positioned; this
file only ever needs to say *which* region.
"""

REGION_KEYWORDS = {
    "brain": ["serotonin", "seizure", "confusion", "drowsy", "drowsiness", "dizz", "sedation", "central nervous"],
    "thyroid": ["thyroid", "levothyroxine", "absorption"],
    "lungs": ["breathing", "respiratory", "opioid"],
    "heart": ["heart", "cardiac", "blood pressure", "hypotension", "bradycardia", "arrhythmia", "potassium"],
    "kidneys": ["kidney", "renal", "clearance"],
    "muscle": ["muscle", "myopathy", "rhabdomyolysis"],
    "stomach": ["gastrointestinal", "stomach", "ulcer", "gi bleed"],
    "blood": ["bleeding", "bleed", "clot", "platelet", "inr", "anticoagul", "toxicity"],
}

# Used whenever nothing above matches — "bloodstream" is a reasonable
# catch-all since most drug-drug interactions ultimately act through blood
# levels of one drug or another.
FALLBACK_REGION = "blood"

VALID_REGIONS = set(REGION_KEYWORDS.keys())


def classify_region(text: str) -> str:
    t = (text or "").lower()
    for region, keywords in REGION_KEYWORDS.items():
        if any(kw in t for kw in keywords):
            return region
    return FALLBACK_REGION
