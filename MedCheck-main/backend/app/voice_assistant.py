"""
The "brain" of the caregiver voice assistant. ElevenLabs (app/
elevenlabs_client.py) handles the actual speech-to-text and text-to-speech;
this module takes the resulting transcript and decides what the caregiver
actually wants, using Gemini (the same app/gemini_client.py already used for
plain-language interaction explanations).

Best-effort in spirit like every other Gemini call in this app: a bad key,
rate limit, or a response that isn't valid JSON falls back to treating
Gemini's raw text as a spoken answer, rather than raising and losing the
whole voice interaction over a formatting hiccup.
"""

import json
import re

from app.gemini_client import call_gemini

VALID_ACTIONS = {"switch_patient", "add_patient", "mark_taken", "answer", "unknown"}


def _build_prompt(
    transcript,
    patients,
    current_patient_name,
    current_patient_medications,
    current_patient_interactions,
):
    patient_names = ", ".join(p.get("name", "") for p in patients if p.get("name")) or "none yet"
    meds_text = (
        ", ".join(m.get("name", "") for m in current_patient_medications if m.get("name"))
        or "none on file"
    )
    interactions_text = (
        "; ".join(
            f"{' + '.join(i.get('drugs', []))} ({i.get('severity')})"
            for i in current_patient_interactions
        )
        or "none flagged"
    )

    return f"""You are a voice assistant embedded in MedCheck, a medication interaction checker used by caregivers. A caregiver just spoke a command or question, transcribed by speech-to-text (so it may contain minor errors) as:

"{transcript}"

Context:
- Patients this caregiver currently has access to: {patient_names}
- Patient currently selected/open (if any): {current_patient_name or "none"}
- That patient's medications: {meds_text}
- That patient's currently flagged interactions: {interactions_text}

Decide what the caregiver wants. Respond with ONLY a single JSON object — no markdown, no code fences, no extra commentary before or after it — with exactly these fields:
  "action": one of "switch_patient", "add_patient", "mark_taken", "answer", "unknown"
  "targetPatientName": the patient name to switch to (only for switch_patient — match one of the listed patient names as closely as possible; null otherwise)
  "medicationName": the medication to mark as taken (only for mark_taken — match one of the listed medications as closely as possible; null otherwise)
  "code": an access code like "MED-1234" mentioned in the transcript (only for add_patient; null otherwise)
  "responseText": a short 1-3 sentence spoken reply. For switch_patient/add_patient/mark_taken, a brief confirmation of what you understood. For answer, the actual answer to their question, in plain, calm, non-alarming language — never diagnose or say what to do medically, suggest mentioning things to a doctor or pharmacist when relevant. For unknown, a brief note that you can only help with caregiving tasks here.

Examples:
"switch to grandma" -> action switch_patient, targetPatientName "Grandma"
"add patient med dash one oh four two" -> action add_patient, code "MED-1042"
"mark warfarin as taken" or "grandma took her warfarin" -> action mark_taken, medicationName "Warfarin"
"is anything grandma takes risky" or "what should I watch for" -> action answer
anything unrelated to medications or patients -> action unknown
"""


def _parse_response(raw_text: str) -> dict:
    text = (raw_text or "").strip()
    # Gemini sometimes wraps JSON in ```json ... ``` even when told not to —
    # pull out the first {...} block rather than trusting it followed
    # instructions exactly.
    match = re.search(r"\{.*\}", text, re.DOTALL)
    candidate = match.group(0) if match else text

    try:
        parsed = json.loads(candidate)
    except (json.JSONDecodeError, TypeError):
        # Not valid JSON at all — treat the raw text as a spoken answer
        # rather than losing the interaction entirely.
        return {
            "action": "answer",
            "targetPatientName": None,
            "medicationName": None,
            "code": None,
            "responseText": text or "Sorry, I didn't quite catch that.",
        }

    action = parsed.get("action")
    if action not in VALID_ACTIONS:
        action = "answer"

    return {
        "action": action,
        "targetPatientName": parsed.get("targetPatientName"),
        "medicationName": parsed.get("medicationName"),
        "code": parsed.get("code"),
        "responseText": parsed.get("responseText") or "Okay.",
    }


def interpret_voice_command(
    transcript,
    patients=None,
    current_patient_name=None,
    current_patient_medications=None,
    current_patient_interactions=None,
) -> dict:
    prompt = _build_prompt(
        transcript,
        patients or [],
        current_patient_name,
        current_patient_medications or [],
        current_patient_interactions or [],
    )
    # Uses the "voice" Gemini key pool (GEMINI_VOICE_API_KEY, see
    # gemini_client.py) — a separate quota from interaction explanations /
    # risk summaries, so a burst of caregivers checking interactions
    # doesn't eat into the budget voice commands need, and vice versa.
    raw = call_gemini(prompt, pool="voice")
    return _parse_response(raw)
