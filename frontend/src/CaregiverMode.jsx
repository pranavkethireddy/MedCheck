import { useState } from 'react'
import MedicationList from './MedicationList.jsx'
import InteractionResults from './InteractionResults.jsx'
import BodyMap from './BodyMap.jsx'
import InfoTooltip from './InfoTooltip.jsx'

// TODO (backend): this file uses a hardcoded mock directory instead of real
// linking. Two endpoints would replace it:
//
//   1. POST /caregiver/link  { code }
//      - looks up `code` in caregiver_access_codes
//      - creates a row in a new `caregiver_links` table:
//          (caregiver_user_id, patient_user_id)
//      - returns the patient's display name (NOT their full record yet)
//
//   2. GET /caregiver/patients   (for the logged-in caregiver)
//      - returns every patient this caregiver has a caregiver_links row for
//      - shape: [{ patientId, name }, ...]
//
//   Then, fetching a specific patient's medications should reuse whatever
//   endpoint already does get-medications for a normal user, but with one
//   added check: does a caregiver_links row exist connecting req.user to
//   that patientId? If not, reject the request — this is the actual
//   security boundary of the whole feature, not just a nice-to-have.
//
// For tonight's demo, typing either MED-1042 or MED-2091 below "adds" one
// of these two mock patients.
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

function CaregiverMode() {
  const [patients, setPatients] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [codeInput, setCodeInput] = useState('')
  const [error, setError] = useState('')
  const [showAddForm, setShowAddForm] = useState(true)

  function handleAddPatient(e) {
    e.preventDefault()
    setError('')
    const code = codeInput.trim().toUpperCase()
    const match = MOCK_CODE_DIRECTORY[code]

    if (!match) {
      setError("That code doesn't match any patient. Double-check it and try again.")
      return
    }
    if (patients.some((p) => p.id === match.id)) {
      setError('You already have access to this patient.')
      return
    }

    setPatients((prev) => [...prev, match])
    setSelectedId(match.id)
    setCodeInput('')
    setShowAddForm(false)
  }

  const selectedPatient = patients.find((p) => p.id === selectedId)

  return (
    <main className="home-main">
      <section className="home-section">
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
          <section className="home-section">
            <div className="section-heading-row">
              <h2>{selectedPatient.name}'s medications</h2>
              <InfoTooltip>
                A read-only view of what this patient has saved as their
                long-term medications. You can't add or remove anything here.
              </InfoTooltip>
            </div>
            <MedicationList medications={selectedPatient.medications} onRemove={() => {}} readOnly />
          </section>

          <section className="home-section">
            <div className="section-heading-row">
              <h2>Interaction check</h2>
              <InfoTooltip>
                Checked the same way as an individual account — every pair
                of their medications is compared for known risky
                combinations.
              </InfoTooltip>
            </div>
            <InteractionResults medications={selectedPatient.medications} />
          </section>

          <section className="home-section">
            <div className="section-heading-row">
              <h2>Where it happens</h2>
              <InfoTooltip>
                Same interactions above, pinned to roughly where in the body
                they show up.
              </InfoTooltip>
            </div>
            <BodyMap medications={selectedPatient.medications} />
          </section>
        </>
      )}
    </main>
  )
}

export default CaregiverMode
