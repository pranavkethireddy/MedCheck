// App.jsx now owns real data: it fetches this list from Backend Person
// 1's /api/get-medications on login and passes it down here, so this stays
// a plain display component — no fetching happens in this file.
//
// Each `med` is either a real saved row from the backend (has `.id`, a
// Supabase uuid) or, in demo mode with no Supabase project configured, a
// plain { name, rxcui } the user just picked — hence `med.id ?? med.rxcui`
// below as a stand-in unique key in both cases.

function MedicationList({ medications, onRemove }) {
  if (medications.length === 0) {
    return <p className="med-list-empty">No medications added yet.</p>
  }

  return (
    <ul className="med-list">
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
    </ul>
  )
}

export default MedicationList
