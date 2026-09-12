// TODO: once the `medications` table exists in Supabase (see the SQL in
// the project plan), replace the `medications` prop with a real fetch:
//   const { data } = await supabase.from('medications').select('*').eq('user_id', userId)
// For now this just renders whatever list gets passed in from App.jsx,
// which starts out empty and grows as you add medications on screen.

function MedicationList({ medications, onRemove }) {
  if (medications.length === 0) {
    return <p className="med-list-empty">No medications added yet.</p>
  }

  return (
    <ul className="med-list">
      {medications.map((med) => (
        <li key={med.rxcui} className="med-list-item">
          <span>{med.name}</span>
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
