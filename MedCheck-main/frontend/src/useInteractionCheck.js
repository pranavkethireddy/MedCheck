import { useEffect, useState } from 'react'
import { checkInteractions } from './backendClient.js'
import { mockCheckInteractions } from './interactionData.js'

// Shared by every component that needs "check this list of medications for
// interactions": InteractionResults.jsx (long-term list, both Individual
// mode and a caregiver's selected patient), StatusBanner.jsx (same list, at
// the top of the page), OneTimeMedicationCheck.jsx (long-term list + one
// extra drug). Each caller gets its own independent fetch — a little
// redundant network-wise when two of them check the exact same list at
// once, but it keeps every section resilient on its own (one slow/failed
// check can't freeze a section that doesn't depend on it) and avoids
// threading interaction state through props across very different parts of
// the tree (Individual mode vs. Caregiver mode).
//
// Falls back to the local mock dataset (interactionData.js) on any backend
// failure — same philosophy as AddMedication.jsx's drug-search fallback —
// so the app still demos even if the Python backend isn't reachable.
export function useInteractionCheck(medications) {
  const [interactions, setInteractions] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [usingFallback, setUsingFallback] = useState(false)

  useEffect(() => {
    if (!medications || medications.length < 2) {
      setInteractions([])
      setError('')
      setUsingFallback(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setError('')

    const drugs = medications.map((m) => ({ rxcui: m.rxcui, name: m.name }))
    checkInteractions(drugs)
      .then((results) => {
        if (cancelled) return
        setInteractions(results || [])
        setUsingFallback(false)
      })
      .catch((err) => {
        console.warn('check-interactions unreachable, falling back to mock data:', err.message)
        if (cancelled) return
        setInteractions(mockCheckInteractions(medications))
        setUsingFallback(true)
        setError('')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
    // Re-run whenever the actual medication identities change, not just the
    // array reference (which changes on every render in some parents).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify((medications || []).map((m) => [m.rxcui, m.name, m.timeOfDay]))])

  return { interactions, loading, error, usingFallback }
}
