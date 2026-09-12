"""
Curated drug-interaction pairs, used as the fast/reliable first check in
/api/check-interactions (see openfda_client.py for the broader, live
fallback that covers arbitrary drug names).

RxNav's Drug Interaction API — what the original plan was built against —
was discontinued by NLM on Jan 2, 2024, with no official replacement. This
file exists so the demo always has correct, deterministic answers for the
most common/textbook-known interactions, independent of any third-party
API's uptime on judging day.

Each entry defines two DRUG CLASSES (lists of generic-name aliases) and
says what happens when a drug from class_a and a drug from class_b are
taken together. Matching is done on NORMALIZED names (lowercased, dose/
form stripped — see normalize_drug_name in app/drug_name_utils.py).

This list is illustrative/educational, not a clinical database — exactly
in keeping with the plan's own framing (section 13): MedCheck is a
conversation-starter with a pharmacist or doctor, never a diagnosis.

Each entry also carries dosing-spacing guidance, surfaced in the UI as
"how long to wait between these two":
  - min_hours_apart: a specific number of hours ONLY when the interaction
    is genuinely a timing/absorption issue (e.g. levothyroxine + calcium),
    where spacing doses apart is the real, standard mitigation.
  - spacing_note: for every other interaction (the systemic ones — shared
    bleeding risk, additive sedation, drug-level interactions, and so on),
    spacing doses out during the day does NOT make the combination safe,
    so this is a short, honest explanation of that instead of a fabricated
    "wait N hours" number. Getting this distinction right matters: telling
    someone "wait 6 hours" for a combination that isn't actually
    timing-dependent would be worse than saying nothing.
"""

KNOWN_INTERACTIONS = [
    {
        "class_a": ["warfarin"],
        "class_b": ["ibuprofen", "naproxen", "aspirin", "diclofenac", "celecoxib", "indomethacin", "ketorolac", "meloxicam"],
        "severity": "significant",
        "description": "Combining warfarin with an NSAID pain reliever can significantly increase the risk of bleeding.",
        "region": "blood",
        "min_hours_apart": None,
        "spacing_note": "This isn't a timing issue — the bleeding risk stays elevated no matter how far apart the doses are. Talk to a prescriber before combining these at all.",
    },
    {
        "class_a": ["warfarin"],
        "class_b": ["ciprofloxacin", "metronidazole", "sulfamethoxazole", "trimethoprim", "clarithromycin", "erythromycin", "fluconazole"],
        "severity": "significant",
        "description": "Certain antibiotics can raise warfarin's blood-thinning effect, increasing bleeding risk.",
        "region": "blood",
        "min_hours_apart": None,
        "spacing_note": "Spacing doses apart doesn't prevent this — the antibiotic affects warfarin levels for as long as both are in the body. Extra blood-clotting checks are usually needed instead.",
    },
    {
        "class_a": ["lisinopril", "enalapril", "ramipril", "captopril", "benazepril"],
        "class_b": ["spironolactone", "triamterene", "amiloride", "potassium chloride", "potassium"],
        "severity": "significant",
        "description": "ACE inhibitors combined with potassium-sparing diuretics or potassium supplements can cause dangerously high potassium levels.",
        "region": "heart",
        "min_hours_apart": None,
        "spacing_note": "Timing doesn't fix this one — both drugs raise potassium through the kidneys over the whole day. This combination usually needs blood-potassium monitoring, not just spacing.",
    },
    {
        "class_a": ["lisinopril", "enalapril", "ramipril", "captopril", "benazepril"],
        "class_b": ["ibuprofen", "naproxen", "aspirin", "diclofenac", "celecoxib", "indomethacin"],
        "severity": "minor",
        "description": "NSAIDs can reduce how well ACE inhibitors work and put extra strain on the kidneys.",
        "region": "kidneys",
        "min_hours_apart": None,
        "spacing_note": "This is a minor, dose-related effect rather than a timing one — occasional use is usually fine, but ask before taking NSAIDs regularly alongside this.",
    },
    {
        "class_a": ["sertraline", "fluoxetine", "citalopram", "escitalopram", "paroxetine", "fluvoxamine"],
        "class_b": ["tramadol"],
        "severity": "significant",
        "description": "Combining an SSRI with tramadol raises the risk of serotonin syndrome, a potentially serious reaction.",
        "region": "brain",
        "min_hours_apart": None,
        "spacing_note": "Serotonin builds up from both drugs regardless of when each dose is taken, so spacing them out during the day doesn't reduce the risk. This combination should be reviewed with a prescriber.",
    },
    {
        "class_a": ["sertraline", "fluoxetine", "citalopram", "escitalopram", "paroxetine", "fluvoxamine"],
        "class_b": ["phenelzine", "tranylcypromine", "isocarboxazid", "selegiline"],
        "severity": "significant",
        "description": "SSRIs and MAOIs together carry a serious risk of serotonin syndrome and should not be combined without close medical supervision.",
        "region": "brain",
        "min_hours_apart": None,
        "spacing_note": "This pair generally isn't taken together at all — switching between them normally requires a multi-week washout period supervised by a prescriber, not just spacing doses within a day.",
    },
    {
        "class_a": ["sertraline", "fluoxetine", "citalopram", "escitalopram", "paroxetine", "fluvoxamine"],
        "class_b": ["ibuprofen", "naproxen", "aspirin", "diclofenac"],
        "severity": "minor",
        "description": "SSRIs combined with NSAIDs may increase the risk of gastrointestinal bleeding.",
        "region": "stomach",
        "min_hours_apart": None,
        "spacing_note": "This is a minor, cumulative effect rather than a timing one — occasional NSAID use is usually fine, but check before regular use.",
    },
    {
        "class_a": ["simvastatin", "atorvastatin", "lovastatin"],
        "class_b": ["clarithromycin", "erythromycin"],
        "severity": "significant",
        "description": "These antibiotics can raise statin levels in the body, increasing the risk of muscle damage.",
        "region": "muscle",
        "min_hours_apart": None,
        "spacing_note": "The antibiotic raises statin levels for its entire course, not just around dosing time, so spacing doses apart doesn't help — a prescriber may pause the statin instead.",
    },
    {
        "class_a": ["digoxin"],
        "class_b": ["furosemide", "hydrochlorothiazide", "chlorthalidone", "bumetanide"],
        "severity": "significant",
        "description": "Diuretics can lower potassium levels, which increases the risk of digoxin toxicity.",
        "region": "heart",
        "min_hours_apart": None,
        "spacing_note": "The risk comes from potassium levels dropping over time, not from taking both at the same moment — regular blood tests are the usual safeguard here.",
    },
    {
        "class_a": ["metoprolol", "atenolol", "propranolol", "carvedilol", "bisoprolol"],
        "class_b": ["verapamil", "diltiazem"],
        "severity": "significant",
        "description": "Beta-blockers combined with these calcium channel blockers can cause a dangerously slow heart rate.",
        "region": "heart",
        "min_hours_apart": None,
        "spacing_note": "Both drugs slow the heart for hours after each dose, so spacing them apart in the day still leaves overlapping effects — this combination needs a prescriber's sign-off.",
    },
    {
        "class_a": ["tramadol", "oxycodone", "hydrocodone", "morphine", "fentanyl", "codeine"],
        "class_b": ["alprazolam", "lorazepam", "diazepam", "clonazepam", "temazepam"],
        "severity": "significant",
        "description": "Combining an opioid with a benzodiazepine significantly increases the risk of dangerous breathing problems.",
        "region": "lungs",
        "min_hours_apart": None,
        "spacing_note": "Both drugs suppress breathing for hours per dose, so there's no gap that makes this combination safe on its own — this needs direct medical guidance, especially for a caregiver managing doses.",
    },
    {
        "class_a": ["levothyroxine"],
        "class_b": ["calcium carbonate", "calcium citrate", "ferrous sulfate", "iron"],
        "severity": "minor",
        "description": "Calcium and iron supplements can reduce how much levothyroxine the body absorbs — usually managed by spacing doses apart.",
        "region": "thyroid",
        "min_hours_apart": 4,
        "spacing_note": None,
    },
    {
        "class_a": ["lithium"],
        "class_b": ["ibuprofen", "naproxen", "diclofenac", "indomethacin"],
        "severity": "significant",
        "description": "NSAIDs can raise lithium levels in the blood, increasing the risk of lithium toxicity.",
        "region": "kidneys",
        "min_hours_apart": None,
        "spacing_note": "NSAIDs raise lithium levels for as long as both are in the system, so timing doesn't prevent this — lithium levels should be monitored if they're combined.",
    },
    {
        "class_a": ["lithium"],
        "class_b": ["lisinopril", "enalapril", "ramipril", "captopril"],
        "severity": "significant",
        "description": "ACE inhibitors can raise lithium levels in the blood, increasing the risk of lithium toxicity.",
        "region": "kidneys",
        "min_hours_apart": None,
        "spacing_note": "This builds up over the whole time both drugs are on board, not around a single dose — lithium levels should be monitored if they're combined.",
    },
    {
        "class_a": ["sildenafil", "tadalafil", "vardenafil"],
        "class_b": ["nitroglycerin", "isosorbide"],
        "severity": "significant",
        "description": "Combining these erectile-dysfunction medications with nitrates can cause a severe, dangerous drop in blood pressure.",
        "region": "heart",
        "min_hours_apart": None,
        "spacing_note": "This combination is generally avoided entirely, not just spaced out — even doses taken many hours apart can still overlap enough to cause a dangerous blood pressure drop. Get explicit guidance from a prescriber first.",
    },
    {
        "class_a": ["clopidogrel"],
        "class_b": ["omeprazole", "esomeprazole"],
        "severity": "minor",
        "description": "Certain acid-reducing medications may weaken clopidogrel's antiplatelet effect.",
        "region": "blood",
        "min_hours_apart": None,
        "spacing_note": "This is a drug-metabolism interaction rather than a timing one, so spacing doses apart doesn't help — a pharmacist can suggest an acid reducer that doesn't interact.",
    },
    {
        "class_a": ["methotrexate"],
        "class_b": ["ibuprofen", "naproxen", "aspirin", "diclofenac", "indomethacin"],
        "severity": "significant",
        "description": "NSAIDs can raise methotrexate levels in the body, increasing the risk of toxicity.",
        "region": "kidneys",
        "min_hours_apart": None,
        "spacing_note": "NSAIDs reduce methotrexate clearance for as long as both are in the body, so spacing doses apart in the day isn't protective — this combination needs a prescriber's review.",
    },
]


def _matches_class(normalized_name: str, aliases: list) -> bool:
    return any(alias in normalized_name for alias in aliases)


def lookup_known_interaction(normalized_name_a: str, normalized_name_b: str):
    """
    normalized_name_a / normalized_name_b: lowercased, dose/form-stripped
    drug names (see normalize_drug_name). Checks both orderings since we
    don't know which drug the caller listed first.
    """
    for entry in KNOWN_INTERACTIONS:
        a_hits_a = _matches_class(normalized_name_a, entry["class_a"])
        b_hits_b = _matches_class(normalized_name_b, entry["class_b"])
        a_hits_b = _matches_class(normalized_name_a, entry["class_b"])
        b_hits_a = _matches_class(normalized_name_b, entry["class_a"])

        if (a_hits_a and b_hits_b) or (a_hits_b and b_hits_a):
            return {
                "severity": entry["severity"],
                "description": entry["description"],
                "region": entry["region"],
                "min_hours_apart": entry.get("min_hours_apart"),
                "spacing_note": entry.get("spacing_note"),
            }
    return None
