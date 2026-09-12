import { useEffect, useRef, useState } from 'react'
import { searchDrugs } from './backendClient.js'
import { searchMedications } from './medicationSearch.js'

// Shared by AddMedication.jsx (long-term medications) and
// OneTimeMedicationCheck.jsx (a single short-term drug) — both need the
// exact same "type a name, get suggestions" behavior: a debounced real
// search against Backend Person 1's /api/search-drugs, falling back to the
// small built-in medicationSearch.js list if the backend call fails, so
// the search box still works even with the Python backend unreachable.
export function useDrugSearch(query) {
  const [suggestions, setSuggestions] = useState([])
  const [usingFallback, setUsingFallback] = useState(false)
  const requestIdRef = useRef(0)

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
        console.warn('search-drugs unreachable, falling back to built-in list:', err.message)
        if (requestIdRef.current === thisRequestId) {
          setSuggestions(searchMedications(q))
          setUsingFallback(true)
        }
      }
    }, 250)

    return () => clearTimeout(timer)
  }, [query])

  return { suggestions, usingFallback }
}
