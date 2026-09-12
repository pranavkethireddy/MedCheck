import { useRef, useState } from 'react'
import { askVoiceAssistant, speak, transcribe } from './voiceClient.js'
import InfoTooltip from './InfoTooltip.jsx'
import { useAiStatus } from './useAiStatus.js'
import { formatCountdown } from './AiStatusBanner.jsx'

// Chrome's MediaRecorder default (no mimeType passed) happens to be
// audio/webm;codecs=opus, which is why this worked fine in testing here.
// Safari — desktop AND iOS, which is the realistic "caregiver checking in
// on their phone" scenario — does not support recording to webm at all; it
// silently records a different container (MP4/AAC) instead. The old code
// ignored that and hardcoded `type: 'audio/webm'` on the resulting Blob
// regardless of what was actually recorded, so on Safari the bytes and the
// label disagreed and ElevenLabs' STT would fail to decode it — surfacing
// to the user as "speech to text just doesn't work," with no obvious error
// unless they happened to check the network tab. Explicitly probing for a
// supported mimeType (and using the recorder's own reported type on
// playback/upload instead of a hardcoded guess) fixes this for every
// browser rather than just the one this was originally tested in.
const PREFERRED_MIME_TYPES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
  'audio/ogg;codecs=opus',
  'audio/ogg',
]

function pickSupportedMimeType() {
  if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) return ''
  return PREFERRED_MIME_TYPES.find((type) => {
    try {
      return MediaRecorder.isTypeSupported(type)
    } catch {
      return false
    }
  }) || ''
}

function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="9" y="2" width="6" height="12" rx="3" stroke="currentColor" strokeWidth="2" />
      <path d="M5 11a7 7 0 0 0 14 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M12 18v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

// Caregiver voice assistant: press the mic, say something — "switch to
// Grandma", "add patient MED-1042", "mark Warfarin as taken", or any open
// question about the currently-selected patient — and this records,
// transcribes it (ElevenLabs speech-to-text), interprets it (Gemini, via
// /api/voice/assistant — see backend/app/voice_assistant.py), performs the
// resulting action through the callbacks passed in, and speaks the reply
// back (ElevenLabs text-to-speech). Every step surfaces a plain error
// message rather than throwing if a backend/API key isn't configured — it
// never blocks any of CaregiverMode's other, already-working features.
function VoiceAssistant({
  patients,
  currentPatientId,
  currentPatientName,
  currentPatientMedications,
  currentPatientInteractions,
  onSwitchPatient,
  onAddPatientByCode,
  onMarkTaken,
}) {
  const [recording, setRecording] = useState(false)
  const [busy, setBusy] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [reply, setReply] = useState('')
  const [error, setError] = useState('')
  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])
  // Same shared circuit-breaker read as AiStatusBanner.jsx — used here to
  // grey the mic out and show a live countdown *before* someone can even
  // start a recording, rather than letting them record, wait for
  // transcription, and only then discover (via a 429) that the AI step
  // was always going to fail. Also stops them from immediately mashing
  // the button again the instant one attempt fails, which just re-trips
  // the backend's own cooldown further.
  const { limited: aiLimited, retryAfterSeconds } = useAiStatus()

  async function startRecording() {
    setError('')
    setTranscript('')
    setReply('')

    if (typeof MediaRecorder === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setError("Voice recording isn't supported in this browser.")
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = pickSupportedMimeType()
      // Only pass a mimeType when we actually found a supported one — an
      // unsupported explicit mimeType throws immediately, whereas omitting
      // the option entirely lets the browser fall back to its own default.
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
      chunksRef.current = []
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop())
        // Use what the recorder actually reports, not a hardcoded guess —
        // this is the field that was wrong before (see note above).
        const actualType = recorder.mimeType || mimeType || 'audio/webm'
        handleRecordingComplete(new Blob(chunksRef.current, { type: actualType }))
      }
      mediaRecorderRef.current = recorder
      recorder.start()
      setRecording(true)
    } catch (err) {
      setError("Couldn't access your microphone: " + err.message)
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop()
    setRecording(false)
  }

  async function handleRecordingComplete(blob) {
    setBusy(true)
    try {
      const text = await transcribe(blob)
      setTranscript(text)
      if (!text) {
        setError("Didn't catch anything — try again.")
        return
      }

      const result = await askVoiceAssistant({
        transcript: text,
        patients,
        currentPatientId,
        currentPatientName,
        currentPatientMedications,
        currentPatientInteractions,
      })
      setReply(result.responseText || '')

      if (result.action === 'switch_patient' && result.targetPatientName) {
        const match = patients.find(
          (p) => p.name.toLowerCase() === result.targetPatientName.toLowerCase()
        )
        if (match) onSwitchPatient(match.id)
      } else if (result.action === 'add_patient' && result.code) {
        onAddPatientByCode(result.code)
      } else if (result.action === 'mark_taken' && result.medicationName) {
        onMarkTaken(result.medicationName)
      }

      if (result.responseText) {
        speak(result.responseText)
          .then((audio) => audio.play())
          .catch((err) => console.warn('Voice reply unavailable:', err.message))
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="voice-assistant">
      <div className="section-heading-row">
        <h3>
          Ask by voice <span className="feature-new-badge">New</span>
        </h3>
        <InfoTooltip>
          Press the mic and say things like "switch to Grandma", "add
          patient MED-1042", "mark Warfarin as taken", or ask any question
          about the patient you're currently viewing.
        </InfoTooltip>
      </div>

      <button
        type="button"
        className={`voice-assistant-mic${recording ? ' voice-assistant-mic-active' : ''}`}
        onClick={recording ? stopRecording : startRecording}
        disabled={busy || (aiLimited && !recording)}
        title={aiLimited && !recording ? `AI is cooling down — try again in ${formatCountdown(retryAfterSeconds)}` : undefined}
      >
        <MicIcon />
        {recording
          ? 'Stop'
          : busy
          ? 'Thinking…'
          : aiLimited
          ? `Cooling down (${formatCountdown(retryAfterSeconds)})`
          : 'Ask by voice'}
      </button>

      {transcript && <p className="voice-assistant-transcript">"{transcript}"</p>}
      {reply && <p className="voice-assistant-reply">{reply}</p>}
      {error && <p className="form-error">{error}</p>}
      {!error && aiLimited && (
        <p className="voice-assistant-cooldown-note">
          The AI assistant is getting a lot of requests right now — it'll be usable again
          automatically once the cooldown above finishes.
        </p>
      )}
    </div>
  )
}

export default VoiceAssistant
