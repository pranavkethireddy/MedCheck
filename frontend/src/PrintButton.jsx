import { useState } from 'react'
import { getRiskSummary } from './backendClient.js'
import { generateMedicationSummaryPdf } from './medicationPdf.js'

function PrinterIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path
        d="M6 9V4h12v5M6 18H4a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-2M6 14h12v6H6v-6z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// Generates an actual, self-contained PDF (medicationPdf.js) instead of
// calling window.print() on whatever's currently visible. That distinction
// matters more now that the dashboard is split into separate pages
// (Overview, AI overview, Interactions, ...) — "print the current page"
// would only ever capture a fraction of the picture, so this always
// assembles the full medication list + interaction check + AI summary,
// regardless of which page is open when it's clicked.
//
// `medications`/`interactions` are passed in rather than fetched here so
// this always reflects exactly what's already on screen (App.jsx's own
// state, or CaregiverMode's selected patient) with no extra network calls
// for those two; only the AI summary paragraph is fetched fresh at click
// time, since it's cheap (per-pair explanations are already cached
// server-side — see gemini_client.py) and no page keeps it in state all
// the time the way it keeps medications/interactions.
function PrintButton({ label = 'Print / save as PDF', medications = [], interactions = [], subjectName }) {
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')

  async function handleClick() {
    setGenerating(true)
    setError('')

    let riskSummary = null
    if (medications.length >= 2) {
      try {
        riskSummary = await getRiskSummary({ medications, interactions })
      } catch (err) {
        console.warn('PDF summary: AI risk overview unavailable, omitting that section:', err.message)
      }
    }

    try {
      generateMedicationSummaryPdf({ subjectName, medications, interactions, riskSummary })
    } catch (err) {
      console.error('Failed to generate PDF summary:', err)
      setError("Couldn't generate the PDF — try again.")
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="no-print print-summary-wrap">
      <button type="button" className="print-summary-btn" onClick={handleClick} disabled={generating}>
        <PrinterIcon />
        {generating ? 'Preparing PDF…' : label}
      </button>
      {error && <p className="form-error">{error}</p>}
    </div>
  )
}

export default PrintButton
