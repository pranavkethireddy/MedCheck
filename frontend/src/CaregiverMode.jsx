import { useEffect, useRef, useState } from 'react'
import MedicationList from './MedicationList.jsx'
import InteractionResults from './InteractionResults.jsx'
import BodyMap from './BodyMap.jsx'
import MedicationTimeline from './MedicationTimeline.jsx'
import RiskSummaryCard from './RiskSummaryCard.jsx'
import MedicationLog from './MedicationLog.jsx'
import MedicationCalendar from './MedicationCalendar.jsx'
import VoiceAssistant from './VoiceAssistant.jsx'
import InfoTooltip from './InfoTooltip.jsx'
import PrintButton from './PrintButton.jsx'
import DashboardStats from './DashboardStats.jsx'
import SeverityChart from './SeverityChart.jsx'
import {
  getCaregiverPatients,
  getMedicationLog,
  getPatientMedications,
  linkCaregiverPatient,
  logMedicationTaken,
} from './backendClient.js'
import { useInteractionCheck } from './useInteractionCheck.js'

// Demo-mode fallback — no real Supabase project configured (no userId), or
// the real backend is unreachable. Same two mock patients as before, so the
// feature still demos fine with nothing configured. Real linking below
// (via /api/caregiver/*, see app/main.py and backend/supabase_sql/schema.sql)
// is what actually runs for a real logged-in user.
const MOCK_CODE_DIRECTORY = {
  'MED-1042': {
    id: 'demo-patient-1',
    name: 'Grandma',
    medications: [
      { rxcui: '11289', name: 'Warfarin' },
      { rxcui: '5640', name: 'Ibuprofen' },
      { rxcui: '29046', name: 'Lisinopril' },
    ],
  },
  'MED-2091': {
    id: 'demo-patient-2',
    name: 'College roommate',
    medications: [
      { rxcui: '312938', name: 'Sertraline' },
      { rxcui: '10689', name: 'Tramadol' },
    ],
  },
}

function CaregiverMode({ userId, initialCode }) {
  const [patients, setPatients] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [codeInput, setCodeInput] = useState(initialCode || '')
  const [error, setError] = useState('')
  const [showAddForm, setShowAddForm] = useState(true)
  const [patientMedications, setPatientMedications] = useState({}) // patientId -> medications[]
  const [loadingMeds, setLoadingMeds] = useState(false)
  const [loadingPatients, setLoadingPatients] = useState(false)
  const [medicationLogs, setMedicationLogs] = useState({}) // patientId -> log entries[]
  const [loadingLog, setLoadingLog] = useState(false)
  const [logError, setLogError] = useState('')
  const [marking, setMarking] = useState(null)

  const isReal = Boolean(userId)

  // Restore previously-linked patients on load — real mode only, there's
  // nothing to restore for the demo directory (it's always re-entered by
  // code each session).
  useEffect(() => {
    if (!isReal) return
    let cancelled = false
    setLoadingPatients(true)
    getCaregiverPatients(userId)
      .then((list) => {
        if (cancelled) return
        const restored = list.map((p) => ({ id: p.patientId, name: p.name }))
        setPatients(restored)
        if (restored.length > 0) {
          setSelectedId(restored[0].id)
          setShowAddForm(false)
        }
      })
      .catch((err) => {
        // Best-effort restore — if the backend's unreachable, the caregiver
        // just starts from an empty list and can re-add patients by code.
        console.warn('Failed to load previously-linked patients:', err.message)
      })
      .finally(() => {
        if (!cancelled) setLoadingPatients(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  // Arrived here via a scanned QR code (see caregiverLink.js / App.jsx) —
  // make sure the "add patient" form is showing with the code ready to
  // submit, even if the restore-patients effect above just hid it because
  // this caregiver already has other patients linked. Guarded with a ref
  // so it only forces this open once, and doesn't keep re-opening the form
  // if the caregiver deliberately closes it afterward.
  const appliedInitialCode = useRef(false)
  useEffect(() => {
    if (!initialCode || appliedInitialCode.current) return
    appliedInitialCode.current = true
    setCodeInput(initialCode)
    setShowAddForm(true)
  }, [initialCode])

  // Fetch the selected patient's medications whenever the selection
  // changes — real mode only (demo patients already carry their
  // medications inline in MOCK_CODE_DIRECTORY). Cached per patientId so
  // switching tabs back and forth doesn't refetch every time.
  useEffect(() => {
    if (!isReal || !selectedId || patientMedications[selectedId]) return
    let cancelled = false
    setLoadingMeds(true)
    getPatientMedications({ callerId: userId, patientId: selectedId })
      .then((data) => {
        if (cancelled) return
        setPatientMedications((prev) => ({ ...prev, [selectedId]: data.medications || [] }))
      })
      .catch((err) => {
        console.error('Failed to load patient medications:', err.message)
        if (!cancelled) setError("Couldn't load this patient's medications. Try again in a moment.")
      })
      .finally(() => {
        if (!cancelled) setLoadingMeds(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, userId])

  // Fetch the selected patient's dose log whenever the selection changes —
  // real mode only. Cached per patientId; marking a new dose taken just
  // prepends to the cached list rather than refetching.
  useEffect(() => {
    if (!isReal || !selectedId || medicationLogs[selectedId]) return
    let cancelled = false
    setLoadingLog(true)
    setLogError('')
    getMedicationLog({ callerId: userId, patientId: selectedId })
      .then((entries) => {
        if (!cancelled) setMedicationLogs((prev) => ({ ...prev, [selectedId]: entries || [] }))
      })
      .catch((err) => {
        console.error('Failed to load medication log:', err.message)
        if (!cancelled) setLogError("Couldn't load the dose log.")
      })
      .finally(() => {
        if (!cancelled) setLoadingLog(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, userId])

  // Shared by the "Add patient" form and the voice assistant's
  // "add_patient" action, so both go through the exact same code path.
  async function redeemCode(rawCode) {
    setError('')
    const code = (rawCode || '').trim().toUpperCase()
    if (!code) return

    if (!isReal) {
      // Demo mode — same local lookup this always used.
      const match = MOCK_CODE_DIRECTORY[code]
      if (!match) {
        setError("That code doesn't match any patient. Double-check it and try again.")
        return
      }
      if (patients.some((p) => p.id === match.id)) {
        setError('You already have access to this patient.')
        return
      }
      setPatients((prev) => [...prev, { id: match.id, name: match.name }])
      setPatientMedications((prev) => ({ ...prev, [match.id]: match.medications }))
      setSelectedId(match.id)
      setCodeInput('')
      setShowAddForm(false)
      return
    }

    try {
      const { patientId, name } = await linkCaregiverPatient({ callerId: userId, code })
      setPatients((prev) =>
        prev.some((p) => p.id === patientId) ? prev : [...prev, { id: patientId, name }]
      )
      setSelectedId(patientId)
      setCodeInput('')
      setShowAddForm(false)
    } catch (err) {
      // The backend already returns friendly messages for every case that
      // matters here — unknown code, already-linked, self-linking — so
      // just surface it as-is instead of re-deriving our own copy.
      setError(err.message || "Couldn't add that patient — try again.")
    }
  }

  function handleAddPatient(e) {
    e.preventDefault()
    redeemCode(codeInput)
  }

  // Shared by the "Mark taken" buttons and the voice assistant's
  // "mark_taken" action.
  async function handleMarkTaken(medicationName) {
    if (!selectedId) return
    setLogError('')

    if (!isReal) {
      // Demo mode — nothing to persist, just reflect it in the UI.
      const entry = {
        id: `demo-log-${Date.now()}`,
        medication_name: medicationName,
        taken_at: new Date().toISOString(),
      }
      setMedicationLogs((prev) => ({
        ...prev,
        [selectedId]: [entry, ...(prev[selectedId] || [])],
      }))
      return
    }

    setMarking(medicationName)
    try {
      const { log: entry } = await logMedicationTaken({
        callerId: userId,
        patientId: selectedId,
        medicationName,
      })
      setMedicationLogs((prev) => ({
        ...prev,
        [selectedId]: [entry, ...(prev[selectedId] || [])],
      }))
    } catch (err) {
      setLogError(`Couldn't log ${medicationName}: ${err.message}`)
    } finally {
      setMarking(null)
    }
  }

  const selectedPatient = patients.find((p) => p.id === selectedId)
  const selectedMedications = selectedId ? patientMedications[selectedId] || [] : []
  const medsReady = !isReal || Boolean(patientMedications[selectedId])
  const selectedLog = selectedId ? medicationLogs[selectedId] || [] : []

  // Fed to the voice assistant as context (see VoiceAssistant.jsx and
  // backend/app/voice_assistant.py) so it can answer open questions about
  // the currently-selected patient without a second security-checked round
  // trip — InteractionResults.jsx already computes this same list for
  // display, so this is a second (cheap, cached) call to the same hook
  // rather than plumbing it through props.
  const { interactions: selectedInteractions } = useInteractionCheck(selectedMedications)

  return (
    <main className="home-main">
      <section className="home-section grid-span-12">
        <div className="caregiver-mode-header">
          <h2>Caregiver mode</h2>
          <InfoTooltip label="How this works">
            <p>
              Caregiver mode lets you view medications for someone who's
              shared their access code with you.
            </p>
            <ol>
              <li>Ask the patient to switch to Individual mode in their own account.</li>
              <li>They'll find their access code under "Add a caregiver."</li>
              <li>Enter that code below to add them as a patient here.</li>
              <li>Add multiple patients and switch between them anytime.</li>
            </ol>
            <p className="how-to-note">
              You can view their medications, but can't add or remove any on
              their behalf.
            </p>
          </InfoTooltip>
        </div>

        {loadingPatients && <p className="med-list-empty">Loading your patients…</p>}

        {patients.length > 0 && (
          <div className="patient-tabs">
            {patients.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`patient-tab${p.id === selectedId ? ' patient-tab-active' : ''}`}
                onClick={() => setSelectedId(p.id)}
              >
                {p.name}
              </button>
            ))}
            <button
              type="button"
              className="patient-tab patient-tab-add"
              onClick={() => setShowAddForm(true)}
            >
              + Add patient
            </button>
          </div>
        )}

        {(showAddForm || patients.length === 0) && (
          <form className="add-patient-form" onSubmit={handleAddPatient}>
            <label htmlFor="access-code">Patient access code</label>
            <input
              id="access-code"
              type="text"
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value)}
              placeholder="e.g. MED-1042"
            />
            {error && <p className="form-error">{error}</p>}
            <div className="add-patient-form-actions">
              <button type="submit">Add patient</button>
              {patients.length > 0 && (
                <button
                  type="button"
                  className="link-button"
                  onClick={() => setShowAddForm(false)}
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        )}
      </section>

      {selectedPatient && (
        <>
          <section className="grid-span-12">
            <DashboardStats
              medications={selectedMedications}
              interactions={selectedInteractions}
              loading={!medsReady || loadingMeds}
            />
          </section>

          <div className="no-print caregiver-print-row grid-span-12">
            <PrintButton
              label={`Print / save ${selectedPatient.name}'s summary`}
              medications={selectedMedications}
              interactions={selectedInteractions}
              subjectName={selectedPatient.name}
            />
          </div>

          <section className="home-section grid-span-12">
            <VoiceAssistant
              patients={patients}
              currentPatientId={selectedPatient.id}
              currentPatientName={selectedPatient.name}
              currentPatientMedications={selectedMedications}
              currentPatientInteractions={selectedInteractions}
              onSwitchPatient={setSelectedId}
              onAddPatientByCode={redeemCode}
              onMarkTaken={handleMarkTaken}
            />
          </section>

          <section className="home-section grid-span-12">
            <div className="section-heading-row">
              <h2>{selectedPatient.name}'s medications</h2>
              <InfoTooltip>
                A read-only view of what this patient has saved as their
                long-term medications. You can't add or remove anything here.
              </InfoTooltip>
            </div>
            {!medsReady || loadingMeds ? (
              <p className="med-list-empty">Loading {selectedPatient.name}'s medications…</p>
            ) : (
              <MedicationList medications={selectedMedications} onRemove={() => {}} readOnly />
            )}
          </section>

          {medsReady && selectedMedications.length >= 2 && (
            <section className="home-section home-section-primary grid-span-12">
              <div className="section-heading-row">
                <h2>
                  AI risk overview <span className="feature-new-badge">New</span>
                </h2>
                <InfoTooltip>
                  A plain-language summary of {selectedPatient.name}'s overall
                  interaction risk, written by Gemini — a starting point for
                  what to bring up with their provider, not a diagnosis.
                </InfoTooltip>
              </div>
              <RiskSummaryCard medications={selectedMedications} />
            </section>
          )}

          <section className="home-section grid-span-12">
            <div className="section-heading-row">
              <h2>Interaction check</h2>
              <InfoTooltip>
                Checked the same way as an individual account — every pair
                of their medications is compared for known risky
                combinations.
              </InfoTooltip>
            </div>
            {selectedMedications.length >= 2 && selectedInteractions.length > 0 && (
              <div style={{ marginBottom: '1.25rem' }}>
                <SeverityChart interactions={selectedInteractions} />
              </div>
            )}
            <InteractionResults medications={selectedMedications} />
          </section>

          <section className="home-section grid-span-12">
            <div className="section-heading-row">
              <h2>Where it happens</h2>
              <InfoTooltip>
                Same interactions above, pinned to roughly where in the body
                they show up.
              </InfoTooltip>
            </div>
            <BodyMap medications={selectedMedications} />
          </section>

          {medsReady && selectedMedications.length >= 1 && (
            <section className="home-section grid-span-12">
              <div className="section-heading-row">
                <h2>
                  Daily schedule <span className="feature-new-badge">New</span>
                </h2>
                <InfoTooltip>
                  Every medication with a time of day set, plotted across a
                  24-hour day — flags anything scheduled within an hour of
                  another dose.
                </InfoTooltip>
              </div>
              <MedicationTimeline medications={selectedMedications} />
            </section>
          )}

          <section className="home-section grid-span-12">
            <MedicationLog
              patientName={selectedPatient.name}
              medications={selectedMedications}
              log={selectedLog}
              loading={loadingLog}
              marking={marking}
              error={logError}
              onMarkTaken={handleMarkTaken}
            />
          </section>

          {medsReady && selectedMedications.length >= 1 && (
            <section className="home-section grid-span-12">
              <MedicationCalendar
                medications={selectedMedications}
                patientName={selectedPatient.name}
              />
            </section>
          )}
        </>
      )}
    </main>
  )
}

export default CaregiverMode
