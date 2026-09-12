import { useState } from 'react'
import { SEVERITY_LABEL } from './interactionData.js'
import { hoursApart } from './timing.js'
import { useInteractionCheck } from './useInteractionCheck.js'
import { useSpeakOnInteractions } from './useSpeakOnInteractions.js'

// Reused in two places: Individual mode's own long-term list, and
// CaregiverMode.jsx for whichever patient is currently selected — so this
// stays self-contained (takes `medications`, fetches its own interaction
// check) rather than depending on state lifted in App.jsx, which only
// exists for the Individual-mode case.

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path
        d="M12 3l7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6l7-3z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function SpeakerOnIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" />
      <path d="M16 8.5a5 5 0 0 1 0 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M18.5 6a8.5 8.5 0 0 1 0 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function SpeakerOffIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" />
      <path d="M16 9l5 6M21 9l-5 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function InteractionResults({ medications }) {
  const { interactions, loading, error, usingFallback } = useInteractionCheck(medications)
  const [voiceEnabled, setVoiceEnabled] = useState(true)

  // Attach a timing gap (if both meds in the pair have a time set) to each
  // flagged interaction, so we can show a spacing note alongside it. Real,
  // backend-sourced interactions don't carry "questions" (that's a mock-data
  // extra) — the `interaction.questions` check below just no-ops for those.
  // Computed unconditionally (before any early return below) so the
  // useSpeakOnInteractions hook call that follows always runs in the same
  // order every render, per the Rules of Hooks.
  const flagged = (interactions || []).map((interaction) => {
    const [nameA, nameB] = interaction.drugs
    const medA = medications.find((m) => m.name === nameA)
    const medB = medications.find((m) => m.name === nameB)
    return { ...interaction, gap: hoursApart(medA?.timeOfDay, medB?.timeOfDay) }
  })

  // Auto-speaks (ElevenLabs text-to-speech) as soon as a new set of
  // significant/minor interactions is found — see useSpeakOnInteractions.js.
  // Only actually enabled once loading/error states have resolved, so it
  // never fires on stale/partial data.
  useSpeakOnInteractions(flagged, { enabled: voiceEnabled && !loading && !error })

  if (medications.length < 2) {
    return (
      <div className="interactions-empty-wrap">
        <span className="med-icon-bubble med-icon-bubble-muted">
          <ShieldIcon />
        </span>
        <p>Add at least two medications to check for interactions.</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="interactions-empty-wrap">
        <span className="med-icon-bubble med-icon-bubble-muted">
          <ShieldIcon />
        </span>
        <p>Checking interactions…</p>
      </div>
    )
  }

  if (error) {
    return <p className="form-error">{error}</p>
  }

  if (flagged.length === 0) {
    return (
      <div className="interactions-empty-wrap">
        <span className="med-icon-bubble med-icon-bubble-safe">
          <ShieldIcon />
        </span>
        <p>No known interactions found among your current medications.</p>
      </div>
    )
  }

  return (
    <>
      <div className="interaction-results-toolbar">
        <button
          type="button"
          className="voice-mute-toggle"
          onClick={() => setVoiceEnabled((v) => !v)}
          aria-pressed={voiceEnabled}
          title={voiceEnabled ? 'Mute spoken interaction warnings' : 'Unmute spoken interaction warnings'}
        >
          {voiceEnabled ? <SpeakerOnIcon /> : <SpeakerOffIcon />}
          {voiceEnabled ? 'Voice on' : 'Voice off'}
        </button>
      </div>
      {usingFallback && (
        <p className="suggestion-empty">
          (Backend unreachable — showing results from a small built-in demo list instead.)
        </p>
      )}
      <ul className="interaction-list">
        {flagged.map((interaction, i) => (
          <li
            key={interaction.drugs.join('-') + i}
            className={`interaction-item interaction-${interaction.severity}`}
          >
            <span className="interaction-badge">
              {SEVERITY_LABEL[interaction.severity] || interaction.severity}
            </span>
            <p className="interaction-drugs">{interaction.drugs.join(' + ')}</p>
            <p className="interaction-description">
              {interaction.explanation || interaction.description}
            </p>

            {interaction.min_hours_apart != null ? (
              <p className="interaction-wait-time">
                <strong>Wait at least {interaction.min_hours_apart} hour
                {interaction.min_hours_apart === 1 ? '' : 's'} between doses</strong> of these two —
                taking them too close together can reduce how well one of them works.
                {interaction.gap != null && (
                  <> You currently take yours about {interaction.gap} hour{interaction.gap === 1 ? '' : 's'} apart.</>
                )}
              </p>
            ) : (
              interaction.spacing_note && (
                <p className="interaction-wait-time interaction-wait-time-no-gap">
                  <strong>Not a timing fix:</strong> {interaction.spacing_note}
                </p>
              )
            )}

            {interaction.min_hours_apart == null && interaction.gap != null && (
              <p className="interaction-timing">
                You take these about {interaction.gap} hour{interaction.gap === 1 ? '' : 's'} apart.
              </p>
            )}

            {interaction.questions && (
              <div className="interaction-questions">
                <p className="interaction-questions-title">Questions to ask your provider:</p>
                <ul>
                  {interaction.questions.map((q) => (
                    <li key={q}>{q}</li>
                  ))}
                </ul>
              </div>
            )}
          </li>
        ))}
      </ul>
    </>
  )
}

export default InteractionResults
