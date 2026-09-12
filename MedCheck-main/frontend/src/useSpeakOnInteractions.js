import { useEffect, useRef } from 'react'
import { speak } from './voiceClient.js'

// Auto-speaks newly-found interactions via ElevenLabs text-to-speech
// (POST /api/voice/speak) the moment a given set of flagged interactions
// first appears — not on every re-render, and not again for the exact
// same set (e.g. switching caregiver tabs back and forth, or a background
// refetch that returns identical results).
//
// Silently no-ops if the backend or ELEVENLABS_API_KEY isn't configured —
// this is a bonus layer on top of the already-working visual interaction
// list, never a blocker, same graceful-degradation stance as every other
// integration in this app.
//
// Browser note: most browsers only allow audio to play automatically after
// the user has interacted with the page at all (a click anywhere). If
// nothing is audible the very first time, that's this browser policy, not
// a bug — the mute/unmute control (see InteractionResults.jsx) doubles as
// a way to satisfy that requirement.
export function useSpeakOnInteractions(flagged, { enabled = true } = {}) {
  const spokenSignatureRef = useRef(null)

  useEffect(() => {
    if (!enabled) return

    const notable = (flagged || []).filter(
      (f) => f.severity === 'significant' || f.severity === 'minor'
    )
    if (notable.length === 0) return

    const signature = notable
      .map((f) => `${f.drugs.join('+')}:${f.severity}`)
      .sort()
      .join('|')
    if (signature === spokenSignatureRef.current) return
    spokenSignatureRef.current = signature

    const significant = notable.filter((f) => f.severity === 'significant')
    const minor = notable.filter((f) => f.severity === 'minor')

    const parts = []
    if (significant.length > 0) {
      parts.push(
        `${significant.length} significant interaction${significant.length === 1 ? '' : 's'} found: ` +
          significant.map((f) => f.drugs.join(' and ')).join(', ') +
          '.'
      )
    }
    if (minor.length > 0) {
      parts.push(
        `${minor.length} minor interaction${minor.length === 1 ? '' : 's'}: ` +
          minor.map((f) => f.drugs.join(' and ')).join(', ') +
          '.'
      )
    }

    // Spell out any wait-time-based spacing guidance out loud too — this is
    // often the single most actionable thing a caregiver needs to hear.
    const withWaitTime = notable.filter((f) => f.min_hours_apart)
    withWaitTime.forEach((f) => {
      parts.push(
        `Wait at least ${f.min_hours_apart} hour${f.min_hours_apart === 1 ? '' : 's'} between ${f.drugs.join(' and ')}.`
      )
    })

    parts.push('Talk to your provider or pharmacist about these.')

    speak(parts.join(' '))
      .then((audio) => audio.play())
      .catch((err) => {
        console.warn('Auto-speak unavailable:', err.message)
      })
  }, [flagged, enabled])
}
