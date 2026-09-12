// Presentational only — App.jsx owns the actual checkInteractions() fetch
// (single source of truth shared with BodyMap.jsx, so both render the same
// data instead of each making their own network call).
//
// Each interaction item shape (from /api/check-interactions):
//   { severity, description, drugs: [a, b], source, region, explanation? }
// - severity/description/drugs/source: Backend Person 1's curated-list /
//   openFDA check-interactions logic
// - region: which body-map pin this interaction is shown under
// - explanation: Backend Person 2's Gemini rewrite of "description" into
//   plain, calm language (falls back to the raw description if Gemini
//   failed or GEMINI_API_KEY isn't set — see gemini_client.py)

const SEVERITY_LABEL = {
  significant: 'Significant — talk to your provider',
  minor: 'Minor — be aware',
}

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

function InteractionResults({ interactions, loading, error, minMedications }) {
  if (!minMedications) {
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

  if (!interactions || interactions.length === 0) {
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
    <ul className="interaction-list">
      {interactions.map((interaction, i) => (
        <li key={i} className={`interaction-item interaction-${interaction.severity}`}>
          <span className="interaction-badge">
            {SEVERITY_LABEL[interaction.severity] || interaction.severity}
          </span>
          <p className="interaction-drugs">{interaction.drugs.join(' + ')}</p>
          <p className="interaction-description">
            {interaction.explanation || interaction.description}
          </p>
        </li>
      ))}
    </ul>
  )
}

export default InteractionResults
