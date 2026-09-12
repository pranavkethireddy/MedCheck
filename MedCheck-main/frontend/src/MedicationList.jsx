import { useState } from 'react'
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
// `readOnly` (used by CaregiverMode.jsx) hides the Remove button AND the
// time editor, since caregivers can view a patient's medications but
// shouldn't be able to change them.
//
// `onUpdateTime(key, timeOfDay)` is optional — when it's not passed (or
// readOnly is set) the time shows as a plain badge with no edit affordance,
// same as before. This is how new adds can require a time (AddMedication.jsx)
// while medications saved before this feature — which may have no time at
// all — are left exactly as they are unless someone deliberately edits them
// here.

function PillIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M12 3v18M3 12h18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  )
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12 7.5v5l3 1.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function MedicationTimeEditor({ initialTime, onSave, onCancel }) {
  const [value, setValue] = useState(initialTime || '')

  return (
    <span className="med-time-editor">
      <input
        type="time"
        className="med-time-editor-input"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        autoFocus
      />
      <button
        type="button"
        className="med-time-editor-save"
        disabled={!value}
        onClick={() => onSave(value)}
      >
        Save
      </button>
      <button type="button" className="link-button med-time-editor-cancel" onClick={onCancel}>
        Cancel
      </button>
    </span>
  )
}

function MedicationList({ medications, onRemove, onUpdateTime, readOnly = false }) {
  const [editingKey, setEditingKey] = useState(null)
  const canEditTime = !readOnly && typeof onUpdateTime === 'function'

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
        const isEditing = canEditTime && editingKey === key

        return (
          <li key={key} className="med-list-item med-item-pop">
            <div className="med-item-main">
              <span className="med-icon-bubble" style={{ backgroundColor: 'var(--accent)' }}>
                <PillIcon />
              </span>
              <span>{med.name}</span>

              {isEditing ? (
                <MedicationTimeEditor
                  initialTime={med.timeOfDay}
                  onCancel={() => setEditingKey(null)}
                  onSave={(timeOfDay) => {
                    onUpdateTime(key, timeOfDay)
                    setEditingKey(null)
                  }}
                />
              ) : canEditTime ? (
                <button
                  type="button"
                  className={med.timeOfDay ? 'med-time-badge med-time-badge-editable' : 'med-time-badge-missing'}
                  onClick={() => setEditingKey(key)}
                  title={med.timeOfDay ? 'Change the time' : 'Add a time'}
                >
                  <ClockIcon />
                  {med.timeOfDay ? formatTime(med.timeOfDay) : 'Add time'}
                </button>
              ) : (
                med.timeOfDay && <span className="med-time-badge">{formatTime(med.timeOfDay)}</span>
              )}
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
