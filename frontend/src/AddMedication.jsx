import { useState } from 'react'
import { searchMedications } from './medicationSearch.js'

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
      <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function AddMedication({ onAdd }) {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [timeOfDay, setTimeOfDay] = useState('')

  function handleChange(e) {
    const value = e.target.value
    setQuery(value)
    setSuggestions(searchMedications(value))
  }

  function handlePick(drug) {
    // TODO (backend): saveMedication in App.jsx already forwards timeOfDay
    // when a real Supabase project is connected — it just needs the
    // /save-medication endpoint to accept and store a time_of_day column,
    // which the original project plan's schema already included.
    onAdd({ ...drug, timeOfDay: timeOfDay || null })
    setQuery('')
    setSuggestions([])
    setTimeOfDay('')
  }

  return (
    <div className="add-med">
      <label htmlFor="med-search">Add a medication</label>
      <input
        id="med-search"
        type="text"
        value={query}
        onChange={handleChange}
        placeholder="Start typing a medication name…"
        autoComplete="off"
      />

      <label htmlFor="med-time" className="add-med-time-label">
        What time do you usually take this? (optional)
      </label>
      <input
        id="med-time"
        type="time"
        value={timeOfDay}
        onChange={(e) => setTimeOfDay(e.target.value)}
        className="add-med-time-input"
      />

      {suggestions.length > 0 && (
        <ul className="suggestion-list">
          {suggestions.map((drug) => (
            <li key={drug.rxcui}>
              <button type="button" onClick={() => handlePick(drug)}>
                <span className="suggestion-icon">
                  <SearchIcon />
                </span>
                {drug.name}
              </button>
            </li>
          ))}
        </ul>
      )}

      {query && suggestions.length === 0 && (
        <p className="suggestion-empty">No matches yet — try a different spelling.</p>
      )}
    </div>
  )
}

export default AddMedication
