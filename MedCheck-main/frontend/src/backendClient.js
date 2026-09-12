// backendClient.js — thin wrapper around Backend Person 1's FastAPI
// endpoints. Mirrors the pattern in supabaseClient.js: one file, one place
// to change the URL, everyone else just imports and calls these functions.
//
// This talks to the Python backend directly (search-drugs, save/get/
// delete-medication, check-interactions) — it does NOT go through
// Supabase. Supabase auth (sign up / log in) stays in supabaseClient.js /
// LoginScreen.jsx, calling Supabase directly, per the project plan.

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000'

async function request(path, options = {}) {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })

  let body = {}
  try {
    body = await res.json()
  } catch {
    // A non-JSON response (e.g. the backend isn't running at all, or a
    // proxy/500 page) still needs to surface as an error below rather
    // than crash here on a failed .json() parse.
  }

  if (!res.ok) {
    throw new Error(body.error || `Request to ${path} failed: ${res.status}`)
  }
  return body
}

// GET /api/search-drugs?q=... -> [{ name, rxcui }, ...]
export async function searchDrugs(query) {
  const data = await request(`/api/search-drugs?q=${encodeURIComponent(query)}`)
  return data.results
}

// POST /api/save-medication -> the saved row, including its id
export async function saveMedication({ userId, name, rxcui, timeOfDay }) {
  const data = await request('/api/save-medication', {
    method: 'POST',
    body: JSON.stringify({ userId, name, rxcui, timeOfDay }),
  })
  return data.medication
}

// Supabase's medications row uses the column name time_of_day (snake_case);
// every component in this app (MedicationList, InteractionResults,
// MedicationTimeline, ...) reads timeOfDay (camelCase), the shape a
// freshly-added medication already has before it's ever saved. Without
// this, a medication's time badge and spacing/timeline info would quietly
// vanish the moment it's reloaded from the backend (e.g. after a refresh
// or re-login) — the value doesn't come back as the field name those
// components are looking for. Applied once here so every caller of
// getMedications/getPatientMedications gets a consistent shape.
function normalizeMedication(m) {
  if (!m) return m
  return { ...m, timeOfDay: m.timeOfDay ?? m.time_of_day ?? null }
}

function normalizeMedicationsResponse(data) {
  return {
    ...data,
    medications: (data.medications || []).map(normalizeMedication),
    overlaps: (data.overlaps || []).map((o) => ({
      ...o,
      a: normalizeMedication(o.a),
      b: normalizeMedication(o.b),
    })),
  }
}

// GET /api/get-medications?userId=... -> { medications, overlaps }
export async function getMedications(userId) {
  const data = await request(`/api/get-medications?userId=${encodeURIComponent(userId)}`)
  return normalizeMedicationsResponse(data)
}

// DELETE /api/delete-medication?id=...&userId=...
export async function deleteMedication({ id, userId }) {
  return request(
    `/api/delete-medication?id=${encodeURIComponent(id)}&userId=${encodeURIComponent(userId)}`,
    { method: 'DELETE' }
  )
}

// PATCH /api/update-medication -> the updated row
// Lets someone fill in (or change) a medication's time of day after it's
// already been saved — used by MedicationList's inline time editor.
export async function updateMedicationTime({ id, userId, timeOfDay }) {
  const data = await request('/api/update-medication', {
    method: 'PATCH',
    body: JSON.stringify({ id, userId, timeOfDay }),
  })
  return normalizeMedication(data.medication)
}

// POST /api/check-interactions -> [{ severity, description, drugs, source, region, explanation, ... }, ...]
// drugs: [{ rxcui, name }, ...] — pass names you already have (from
// searchDrugs/getMedications) so this can hit the curated interaction list
// with zero extra network calls; the backend resolves names via RxNorm on
// its own if you only pass rxcuis.
export async function checkInteractions(drugs) {
  const data = await request('/api/check-interactions', {
    method: 'POST',
    body: JSON.stringify({ drugs }),
  })
  return data.interactions
}

// Backboard-backed persistent memory (app/backboard_client.py). Best-effort
// on the backend — if BACKBOARD_API_KEY isn't configured, these still
// resolve normally (list comes back empty, save is a no-op) rather than
// throwing, so the rest of the app never depends on this being set up.

// GET /api/memory/list?userId=... -> { memories: [{ id, content, ... }, ...] }
export async function getMemories(userId) {
  return request(`/api/memory/list?userId=${encodeURIComponent(userId)}`)
}

// POST /api/memory/save -> { saved: true }
export async function saveMemory({ userId, content, metadata }) {
  return request('/api/memory/save', {
    method: 'POST',
    body: JSON.stringify({ userId, content, metadata }),
  })
}

// Real caregiver linking (app/main.py's /api/caregiver/* endpoints, backed
// by the caregiver_access_codes + caregiver_links tables) — replaces the
// hardcoded MOCK_CODE_DIRECTORY that used to live in CaregiverMode.jsx.
// CaregiverMode.jsx and CaregiverAccessCard.jsx still fall back to that
// mock directory whenever there's no real logged-in userId (demo mode) or
// one of these calls fails, same graceful-degradation pattern as
// useInteractionCheck.js / useDrugSearch.js.

// GET /api/caregiver/my-code?userId=...&displayName=... -> "MED-XXXX"
export async function getMyCaregiverCode({ userId, displayName }) {
  const data = await request(
    `/api/caregiver/my-code?userId=${encodeURIComponent(userId)}&displayName=${encodeURIComponent(
      displayName || ''
    )}`
  )
  return data.code
}

// POST /api/caregiver/link -> { patientId, name }
export async function linkCaregiverPatient({ callerId, code }) {
  return request('/api/caregiver/link', {
    method: 'POST',
    body: JSON.stringify({ callerId, code }),
  })
}

// GET /api/caregiver/patients?callerId=... -> [{ patientId, name }, ...]
export async function getCaregiverPatients(callerId) {
  const data = await request(`/api/caregiver/patients?callerId=${encodeURIComponent(callerId)}`)
  return data.patients
}

// GET /api/caregiver/patient-medications?callerId=...&patientId=... -> { medications, overlaps }
export async function getPatientMedications({ callerId, patientId }) {
  const data = await request(
    `/api/caregiver/patient-medications?callerId=${encodeURIComponent(
      callerId
    )}&patientId=${encodeURIComponent(patientId)}`
  )
  return normalizeMedicationsResponse(data)
}

// POST /api/risk-summary -> { summary }
// Takes the same medications + interactions the caller already has from
// checkInteractions() above — this never recomputes interactions itself,
// it just asks Gemini to turn an already-known result into one readable
// paragraph (see RiskSummaryCard.jsx).
export async function getRiskSummary({ medications, interactions }) {
  const data = await request('/api/risk-summary', {
    method: 'POST',
    body: JSON.stringify({ medications, interactions }),
  })
  return data.summary
}

// Caregiver-side "was this actually taken" dose log — deliberately not
// exposed anywhere in Individual mode (see backend/app/main.py and
// backend/supabase_sql/schema.sql's medication_dose_logs table). The
// caregiver marks a dose taken for the patient they're viewing; this is
// not the patient tracking their own adherence.

// POST /api/caregiver/log-medication-taken -> { log: {...} }
export async function logMedicationTaken({ callerId, patientId, medicationName, takenAt }) {
  return request('/api/caregiver/log-medication-taken', {
    method: 'POST',
    body: JSON.stringify({ callerId, patientId, medicationName, takenAt }),
  })
}

// GET /api/caregiver/medication-log?callerId=...&patientId=... -> [{ id, medication_name, taken_at, ... }, ...]
export async function getMedicationLog({ callerId, patientId }) {
  const data = await request(
    `/api/caregiver/medication-log?callerId=${encodeURIComponent(callerId)}&patientId=${encodeURIComponent(
      patientId
    )}`
  )
  return data.log
}
