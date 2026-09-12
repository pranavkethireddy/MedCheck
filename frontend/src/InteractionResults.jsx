import { checkInteractions, SEVERITY_LABEL } from './interactionData.js'
import { hoursApart } from './timing.js'

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

function InteractionResults({ medications }) {
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

  // Attach a timing gap (if both meds in the pair have a time set) to each
  // flagged interaction, so we can show a spacing note alongside it.
  const flagged = checkInteractions(medications).map((interaction) => {
    const [nameA, nameB] = interaction.drugs
    const medA = medications.find((m) => m.name === nameA)
    const medB = medications.find((m) => m.name === nameB)
    return { ...interaction, gap: hoursApart(medA?.timeOfDay, medB?.timeOfDay) }
  })

  if (flagged.length === 0) {
    return (
      <div className="interactions-empty-wrap">
        <span className="med-icon-bubble med-icon-bubble-safe">
          <ShieldIcon />
        </span>
        <p>No known interactions among your current medications (based on this demo's sample data).</p>
      </div>
    )
  }

  return (
    <ul className="interaction-list">
      {flagged.map((interaction) => (
        <li
          key={interaction.drugs.join('-')}
          className={`interaction-item interaction-${interaction.severity}`}
        >
          <span className="interaction-badge">{SEVERITY_LABEL[interaction.severity]}</span>
          <p className="interaction-drugs">{interaction.drugs.join(' + ')}</p>
          <p className="interaction-description">{interaction.description}</p>

          {interaction.gap != null && (
            <p className="interaction-timing">
              You take these about {interaction.gap} hour{interaction.gap === 1 ? '' : 's'} apart.
              {interaction.severity === 'minor' &&
                ' Spacing doses out like this can help reduce risk for minor interactions — but check with your provider if you\'re unsure.'}
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
  )
}

export default InteractionResults
