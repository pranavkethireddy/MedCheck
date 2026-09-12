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
"""

KNOWN_INTERACTIONS = [
    {
        "class_a": ["warfarin"],
        "class_b": ["ibuprofen", "naproxen", "aspirin", "diclofenac", "celecoxib", "indomethacin", "ketorolac", "meloxicam"],
        "severity": "significant",
        "description": "Combining warfarin with an NSAID pain reliever can significantly increase the risk of bleeding.",
        "region": "blood",
    },
    {
        "class_a": ["warfarin"],
        "class_b": ["ciprofloxacin", "metronidazole", "sulfamethoxazole", "trimethoprim", "clarithromycin", "erythromycin", "fluconazole"],
        "severity": "significant",
        "description": "Certain antibiotics can raise warfarin's blood-thinning effect, increasing bleeding risk.",
        "region": "blood",
    },
    {
        "class_a": ["lisinopril", "enalapril", "ramipril", "captopril", "benazepril"],
        "class_b": ["spironolactone", "triamterene", "amiloride", "potassium chloride", "potassium"],
        "severity": "significant",
        "description": "ACE inhibitors combined with potassium-sparing diuretics or potassium supplements can cause dangerously high potassium levels.",
        "region": "heart",
    },
    {
        "class_a": ["lisinopril", "enalapril", "ramipril", "captopril", "benazepril"],
        "class_b": ["ibuprofen", "naproxen", "aspirin", "diclofenac", "celecoxib", "indomethacin"],
        "severity": "minor",
        "description": "NSAIDs can reduce how well ACE inhibitors work and put extra strain on the kidneys.",
        "region": "kidneys",
    },
    {
        "class_a": ["sertraline", "fluoxetine", "citalopram", "escitalopram", "paroxetine", "fluvoxamine"],
        "class_b": ["tramadol"],
        "severity": "significant",
        "description": "Combining an SSRI with tramadol raises the risk of serotonin syndrome, a potentially serious reaction.",
        "region": "brain",
    },
    {
        "class_a": ["sertraline", "fluoxetine", "citalopram", "escitalopram", "paroxetine", "fluvoxamine"],
        "class_b": ["phenelzine", "tranylcypromine", "isocarboxazid", "selegiline"],
        "severity": "significant",
        "description": "SSRIs and MAOIs together carry a serious risk of serotonin syndrome and should not be combined without close medical supervision.",
        "region": "brain",
    },
    {
        "class_a": ["sertraline", "fluoxetine", "citalopram", "escitalopram", "paroxetine", "fluvoxamine"],
        "class_b": ["ibuprofen", "naproxen", "aspirin", "diclofenac"],
        "severity": "minor",
        "description": "SSRIs combined with NSAIDs may increase the risk of gastrointestinal bleeding.",
        "region": "stomach",
    },
    {
        "class_a": ["simvastatin", "atorvastatin", "lovastatin"],
        "class_b": ["clarithromycin", "erythromycin"],
        "severity": "significant",
        "description": "These antibiotics can raise statin levels in the body, increasing the risk of muscle damage.",
        "region": "muscle",
    },
    {
        "class_a": ["digoxin"],
        "class_b": ["furosemide", "hydrochlorothiazide", "chlorthalidone", "bumetanide"],
        "severity": "significant",
        "description": "Diuretics can lower potassium levels, which increases the risk of digoxin toxicity.",
        "region": "heart",
    },
    {
        "class_a": ["metoprolol", "atenolol", "propranolol", "carvedilol", "bisoprolol"],
        "class_b": ["verapamil", "diltiazem"],
        "severity": "significant",
        "description": "Beta-blockers combined with these calcium channel blockers can cause a dangerously slow heart rate.",
        "region": "heart",
    },
    {
        "class_a": ["tramadol", "oxycodone", "hydrocodone", "morphine", "fentanyl", "codeine"],
        "class_b": ["alprazolam", "lorazepam", "diazepam", "clonazepam", "temazepam"],
        "severity": "significant",
        "description": "Combining an opioid with a benzodiazepine significantly increases the risk of dangerous breathing problems.",
        "region": "lungs",
    },
    {
        "class_a": ["levothyroxine"],
        "class_b": ["calcium carbonate", "calcium citrate", "ferrous sulfate", "iron"],
        "severity": "minor",
        "description": "Calcium and iron supplements can reduce how much levothyroxine the body absorbs — usually managed by spacing doses apart.",
        "region": "thyroid",
    },
    {
        "class_a": ["lithium"],
        "class_b": ["ibuprofen", "naproxen", "diclofenac", "indomethacin"],
        "severity": "significant",
        "description": "NSAIDs can raise lithium levels in the blood, increasing the risk of lithium toxicity.",
        "region": "kidneys",
    },
    {
        "class_a": ["lithium"],
        "class_b": ["lisinopril", "enalapril", "ramipril", "captopril"],
        "severity": "significant",
        "description": "ACE inhibitors can raise lithium levels in the blood, increasing the risk of lithium toxicity.",
        "region": "kidneys",
    },
    {
        "class_a": ["sildenafil", "tadalafil", "vardenafil"],
        "class_b": ["nitroglycerin", "isosorbide"],
        "severity": "significant",
        "description": "Combining these erectile-dysfunction medications with nitrates can cause a severe, dangerous drop in blood pressure.",
        "region": "heart",
    },
    {
        "class_a": ["clopidogrel"],
        "class_b": ["omeprazole", "esomeprazole"],
        "severity": "minor",
        "description": "Certain acid-reducing medications may weaken clopidogrel's antiplatelet effect.",
        "region": "blood",
    },
    {
        "class_a": ["methotrexate"],
        "class_b": ["ibuprofen", "naproxen", "aspirin", "diclofenac", "indomethacin"],
        "severity": "significant",
        "description": "NSAIDs can raise methotrexate levels in the body, increasing the risk of toxicity.",
        "region": "kidneys",
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
            }
    return None
