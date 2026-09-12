// App.jsx now owns real data: it fetches this list from Backend Person
// 1's /api/get-medications on login and passes it down here, so this stays
// a plain display component — no fetching happens in this file.
//
// Each `med` is either a real saved row from the backend (has `.id`, a
// Supabase uuid) or, in demo mode with no Supabase project configured, a
// plain { name, rxcui } the user just picked — hence `med.id ?? med.rxcui`
// below as a stand-in unique key in both cases.

// A rotating set of colors so the list doesn't look flat/monochrome —
// each medication gets a consistent color based on its position.
const BUBBLE_COLORS = ['#2f5fd9', '#8b5cf6', '#ec6a5e', '#16a394', '#f2a93b']

function PillIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M12 3v18M3 12h18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  )
}

function MedicationList({ medications, onRemove }) {
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
<<<<<<< HEAD
      {medications.map((med, index) => (
        <li key={med.rxcui} className="med-list-item med-item-pop">
          <div className="med-item-main">
            <span
              className="med-icon-bubble"
              style={{ backgroundColor: BUBBLE_COLORS[index % BUBBLE_COLORS.length] }}
            >
              <PillIcon />
            </span>
            <span>{med.name}</span>
          </div>
          <button
            type="button"
            className="link-button"
            onClick={() => onRemove(med.rxcui)}
          >
            Remove
          </button>
        </li>
      ))}
=======
      {medications.map((med) => {
        const key = med.id ?? med.rxcui
        return (
          <li key={key} className="med-list-item">
            <span>{med.name}</span>
            <button
              type="button"
              className="link-button"
              onClick={() => onRemove(key)}
            >
              Remove
            </button>
          </li>
        )
      })}
>>>>>>> e5bf374e7fa73930ab2331c1bd379b34bbb584a7
    </ul>
  )
}

export default MedicationList