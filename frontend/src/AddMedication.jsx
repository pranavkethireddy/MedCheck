import { useEffect, useRef, useState } from 'react'
import { searchDrugs } from './backendClient.js'

// Used only if the real backend call fails (not running, network error,
// etc.) so the screen still demos instead of just breaking — same
// fallback philosophy as supabaseClient.js's demo-mode login.
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

function searchMock(query) {
  const q = query.trim().toLowerCase()
  if (!q) return []
  return MOCK_DRUGS.filter((d) => d.name.toLowerCase().includes(q))
}

function AddMedication({ onAdd }) {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [usingFallback, setUsingFallback] = useState(false)
  const requestIdRef = useRef(0)

  // Debounced real search: waits 250ms after the last keystroke before
  // hitting the backend, and ignores any response that isn't from the
  // most recent request (in case a slower earlier request resolves after
  // a faster later one — otherwise stale results could flash on screen).
  useEffect(() => {
    const q = query.trim()
    if (!q) {
      setSuggestions([])
      return
    }

    const thisRequestId = ++requestIdRef.current
    const timer = setTimeout(async () => {
      try {
        const results = await searchDrugs(q)
        if (requestIdRef.current === thisRequestId) {
          setSuggestions(results)
          setUsingFallback(false)
        }
      } catch (err) {
        console.warn('search-drugs unreachable, falling back to mock list:', err.message)
        if (requestIdRef.current === thisRequestId) {
          setSuggestions(searchMock(q))
          setUsingFallback(true)
        }
      }
    }, 250)

    return () => clearTimeout(timer)
  }, [query])

  function handleChange(e) {
    setQuery(e.target.value)
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

      {usingFallback && (
        <p className="suggestion-empty">
          (Backend unreachable — showing a small built-in demo list instead.)
        </p>
      )}
    </div>
  )
}

export default AddMedication