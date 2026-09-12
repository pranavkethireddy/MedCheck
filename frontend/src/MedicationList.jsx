// TODO: once the `medications` table exists in Supabase (see the SQL in
// the project plan), replace the `medications` prop with a real fetch:
//   const { data } = await supabase.from('medications').select('*').eq('user_id', userId)
// For now this just renders whatever list gets passed in from App.jsx,
// which starts out empty and grows as you add medications on screen.

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
    </ul>
  )
}

export default MedicationList
