import { useState } from 'react'

// TODO: once your teammate's backend is up, replace MOCK_DRUGS and
// searchMedications() below with a real fetch to their endpoint, e.g.:
//
//   const BACKEND_URL = 'http://localhost:4000' // ask your backend teammate for the real one
//   async function searchMedications(query) {
//     const res = await fetch(`${BACKEND_URL}/search-drugs?q=${encodeURIComponent(query)}`)
//     if (!res.ok) throw new Error('Search failed')
//     return res.json() // expected shape: [{ name, rxcui }, ...]
//   }
//
// Until then, this fake version lets you build + demo the whole screen.
const MOCK_DRUGS = [
  { name: 'Ibuprofen', rxcui: '5640' },
  { name: 'Warfarin', rxcui: '11289' },
  { name: 'Lisinopril', rxcui: '29046' },
  { name: 'Sertraline', rxcui: '312938' },
  { name: 'Tramadol', rxcui: '10689' },
  { name: 'Metformin', rxcui: '6809' },
  { name: 'Atorvastatin', rxcui: '83367' },
  { name: 'Aspirin', rxcui: '1191' },
]

function searchMedications(query) {
  const q = query.trim().toLowerCase()
  if (!q) return []
  return MOCK_DRUGS.filter((d) => d.name.toLowerCase().includes(q))
}

function AddMedication({ onAdd }) {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState([])

  function handleChange(e) {
    const value = e.target.value
    setQuery(value)
    setSuggestions(searchMedications(value))
  }

  function handlePick(drug) {
    onAdd(drug)
    setQuery('')
    setSuggestions([])
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

      {suggestions.length > 0 && (
        <ul className="suggestion-list">
          {suggestions.map((drug) => (
            <li key={drug.rxcui}>
              <button type="button" onClick={() => handlePick(drug)}>
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
