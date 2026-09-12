import { useState } from 'react'
import { useDrugSearch } from './useDrugSearch.js'

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
  const [timeOfDay, setTimeOfDay] = useState('')
  const [error, setError] = useState('')
  const { suggestions, usingFallback } = useDrugSearch(query)

  function handleChange(e) {
    setQuery(e.target.value)
  }

  function handlePick(drug) {
    if (!timeOfDay) {
      setError('Enter what time you take this before adding it.')
      return
    }
    setError('')
    onAdd({ ...drug, timeOfDay })
    setQuery('')
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
        What time do you take this?
      </label>
      <input
        id="med-time"
        type="time"
        value={timeOfDay}
        onChange={(e) => {
          setTimeOfDay(e.target.value)
          if (e.target.value) setError('')
        }}
        className="add-med-time-input"
      />

      {error && <p className="form-error">{error}</p>}

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

      {usingFallback && (
        <p className="suggestion-empty">
          (Backend unreachable — showing a small built-in demo list instead.)
        </p>
      )}
    </div>
  )
}

export default AddMedication
