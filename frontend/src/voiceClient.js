// voiceClient.js — thin wrapper around the ElevenLabs-backed /api/voice/*
// endpoints (backend/app/elevenlabs_client.py + voice_assistant.py). Kept
// separate from backendClient.js because these deal in audio blobs and a
// multipart file upload rather than plain JSON in and out.

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000'

async function readErrorMessage(res, fallback) {
  try {
    const body = await res.json()
    return body.error || fallback
  } catch {
    return fallback
  }
}

// POST /api/voice/speak -> an Audio element already loaded with the mp3
// response, ready to .play(). Throws if the backend or ELEVENLABS_API_KEY
// isn't configured — callers should treat that as "voice unavailable" and
// fail silently (see useSpeakOnInteractions.js) rather than surfacing an
// error for a feature nobody explicitly asked to hear.
export async function speak(text) {
  const res = await fetch(`${BACKEND_URL}/api/voice/speak`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  })
  if (!res.ok) {
    throw new Error(await readErrorMessage(res, `Text-to-speech failed: ${res.status}`))
  }
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const audio = new Audio(url)
  audio.addEventListener('ended', () => URL.revokeObjectURL(url))
  return audio
}

// POST /api/voice/transcribe -> transcript text, from a recorded audio
// Blob (as produced by MediaRecorder in VoiceAssistant.jsx).
export async function transcribe(audioBlob) {
  const formData = new FormData()
  // Match the filename extension to what was actually recorded (audioBlob.type,
  // set by VoiceAssistant.jsx from the MediaRecorder's own reported mimeType —
  // e.g. audio/mp4 on Safari) rather than always claiming .webm. The browser
  // already sends the correct Content-Type on this form part from the Blob's
  // type, which is what the backend forwards to ElevenLabs — this just keeps
  // the filename honest too, in case anything downstream sniffs by extension.
  const subtype = (audioBlob.type.split('/')[1] || 'webm').split(';')[0]
  formData.append('audio', audioBlob, `clip.${subtype}`)

  const res = await fetch(`${BACKEND_URL}/api/voice/transcribe`, {
    method: 'POST',
    body: formData,
  })
  if (!res.ok) {
    throw new Error(await readErrorMessage(res, `Speech-to-text failed: ${res.status}`))
  }
  const body = await res.json()
  return body.text || ''
}

// POST /api/voice/assistant -> { action, targetPatientName, medicationName, code, responseText }
export async function askVoiceAssistant({
  transcript,
  patients,
  currentPatientId,
  currentPatientName,
  currentPatientMedications,
  currentPatientInteractions,
}) {
  const res = await fetch(`${BACKEND_URL}/api/voice/assistant`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      transcript,
      patients,
      currentPatientId,
      currentPatientName,
      currentPatientMedications,
      currentPatientInteractions,
    }),
  })
  if (!res.ok) {
    throw new Error(await readErrorMessage(res, `Voice assistant failed: ${res.status}`))
  }
  return res.json()
}
