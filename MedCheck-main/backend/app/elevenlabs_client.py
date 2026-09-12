"""
ElevenLabs integration: text-to-speech (reads interaction warnings aloud)
and speech-to-text (the ears of the caregiver voice assistant in
app/voice_assistant.py). Raw HTTP via `requests`, no SDK dependency — same
style as app/openfda_client.py and app/rxnorm_client.py.

Unlike backboard_client.py's remember()/recall_memories() (which are
best-effort background enrichment that must never break the request that
triggered them), voice output/input IS the feature being requested here —
so these functions raise on failure instead of silently no-op'ing, and
main.py surfaces a clear error to the frontend, which already treats
"backend unreachable" as a normal, expected case everywhere else in this
app (see useInteractionCheck.js) and simply skips the voice feature rather
than breaking anything else on the page.
"""

import os

import requests

DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM"  # "Rachel" — a calm, clear preset ElevenLabs voice
TTS_MODEL_ID = "eleven_turbo_v2_5"  # low-latency; more than enough quality for a spoken warning
STT_MODEL_ID = "scribe_v1"


def _api_key() -> str:
    api_key = os.environ.get("ELEVENLABS_API_KEY")
    if not api_key:
        raise RuntimeError(
            "ELEVENLABS_API_KEY is missing. Check .env exists and contains "
            "ELEVENLABS_API_KEY=your-key-here"
        )
    return api_key


def synthesize_speech(text: str) -> bytes:
    """Text -> mp3 bytes, via ElevenLabs' text-to-speech API."""
    voice_id = os.environ.get("ELEVENLABS_VOICE_ID", DEFAULT_VOICE_ID)
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"

    resp = requests.post(
        url,
        headers={"xi-api-key": _api_key(), "Content-Type": "application/json"},
        json={
            "text": text,
            "model_id": TTS_MODEL_ID,
            "voice_settings": {"stability": 0.5, "similarity_boost": 0.75},
        },
        timeout=20,
    )
    if not resp.ok:
        raise RuntimeError(f"ElevenLabs text-to-speech failed: {resp.status_code} {resp.text[:200]}")
    return resp.content


def transcribe_speech(audio_bytes: bytes, content_type: str = "audio/webm") -> str:
    """Recorded audio -> transcript text, via ElevenLabs' speech-to-text API."""
    url = "https://api.elevenlabs.io/v1/speech-to-text"

    resp = requests.post(
        url,
        headers={"xi-api-key": _api_key()},
        data={"model_id": STT_MODEL_ID},
        files={"file": ("audio", audio_bytes, content_type)},
        timeout=30,
    )
    if not resp.ok:
        raise RuntimeError(f"ElevenLabs speech-to-text failed: {resp.status_code} {resp.text[:200]}")

    data = resp.json()
    return data.get("text", "")
