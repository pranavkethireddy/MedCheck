import InfoTooltip from './InfoTooltip.jsx'

function formatWhen(iso) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

// Caregiver-side "was this actually taken" log. Deliberately caregiver-only
// (never shown in Individual mode) — see backend/app/main.py's
// /api/caregiver/log-medication-taken + /api/caregiver/medication-log, and
// the medication_dose_logs table in backend/supabase_sql/schema.sql.
//
// Purely presentational: CaregiverMode.jsx owns the actual fetch/mark-taken
// logic so both these buttons AND the voice assistant's "mark_taken" action
// go through the exact same code path (onMarkTaken).
function MedicationLog({ patientName, medications, log, loading, marking, error, onMarkTaken }) {
  return (
    <div className="medication-log">
      <div className="section-heading-row">
        <h3>
          Dose log <span className="feature-new-badge">New</span>
        </h3>
        <InfoTooltip>
          Mark a dose as taken when you give it to {patientName}, or when
          they tell you they've taken it. This log is only visible to you
          as their caregiver — {patientName} doesn't see it in their own
          account.
        </InfoTooltip>
      </div>

      {medications.length > 0 && (
        <div className="medication-log-mark-row">
          {medications.map((m) => (
            <button
              key={m.name}
              type="button"
              className="medication-log-mark-btn"
              onClick={() => onMarkTaken(m.name)}
              disabled={marking === m.name}
            >
              {marking === m.name ? 'Logging…' : `Mark ${m.name} taken`}
            </button>
          ))}
        </div>
      )}

      {error && <p className="form-error">{error}</p>}

      {loading ? (
        <p className="med-list-empty">Loading log…</p>
      ) : log.length === 0 ? (
        <p className="med-list-empty">No doses logged yet.</p>
      ) : (
        <ul className="medication-log-list">
          {log.map((entry) => (
            <li key={entry.id}>
              <strong>{entry.medication_name}</strong> — {formatWhen(entry.taken_at)}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default MedicationLog
