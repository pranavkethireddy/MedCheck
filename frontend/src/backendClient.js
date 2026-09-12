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

// GET /api/get-medications?userId=... -> { medications, overlaps }
export async function getMedications(userId) {
  return request(`/api/get-medications?userId=${encodeURIComponent(userId)}`)
}

// DELETE /api/delete-medication?id=...&userId=...
export async function deleteMedication({ id, userId }) {
  return request(
    `/api/delete-medication?id=${encodeURIComponent(id)}&userId=${encodeURIComponent(userId)}`,
    { method: 'DELETE' }
  )
}

// POST /api/check-interactions -> [{ severity, description, drugs, source, ... }, ...]
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
