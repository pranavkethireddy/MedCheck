import { formatTime } from './timing.js'

// App.jsx now owns real data: it fetches this list from Backend Person
// 1's /api/get-medications on login and passes it down here, so this stays
// a plain display component — no fetching happens in this file.
//
// Each `med` is either a real saved row from the backend (has `.id`, a
// Supabase uuid) or, in demo mode with no Supabase project configured, a
// plain { name, rxcui, timeOfDay } the user just picked — hence
// `med.id ?? med.rxcui` below as a stand-in unique key in both cases.
//
// `readOnly` (used by CaregiverMode.jsx) hides the Remove button, since
// caregivers can view a patient's medications but shouldn't be able to
// change them.

function PillIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M12 3v18M3 12h18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  )
}

function MedicationList({ medications, onRemove, readOnly = false }) {
  if (medications.length === 0) {
    return (
      <div className="med-list-empty-wrap">
        <span className="med-icon-bubble med-icon-bubble-muted">
          <PillIcon />
        </span>
        <p>No medications yet — add one below to get started.</p>
      </div>
    )
  }

  return (
    <ul className="med-list">
      {medications.map((med) => {
        const key = med.id ?? med.rxcui
        return (
          <li key={key} className="med-list-item med-item-pop">
            <div className="med-item-main">
              <span className="med-icon-bubble" style={{ backgroundColor: 'var(--accent)' }}>
                <PillIcon />
              </span>
              <span>{med.name}</span>
              {med.timeOfDay && <span className="med-time-badge">{formatTime(med.timeOfDay)}</span>}
            </div>
            {!readOnly && (
              <button
                type="button"
                className="link-button"
                onClick={() => onRemove(key)}
              >
                Remove
              </button>
            )}
          </li>
        )
      })}
    </ul>
  )
}

export default MedicationList
