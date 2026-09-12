// Shared by CaregiverAccessCard.jsx (encodes a scannable join link into the
// QR code) and App.jsx (reads it back out when the app loads from a
// scanned link) — one query param name to keep in sync between the two.
const CODE_PARAM = 'careCode'

// A patient's own access code, turned into a full URL a phone camera can
// open directly — scanning it lands back on this same app with the code
// attached, instead of the caregiver having to type "MED-1234" by hand.
export function buildCaregiverJoinUrl(code) {
  const url = new URL(window.location.href)
  url.search = ''
  url.hash = ''
  url.searchParams.set(CODE_PARAM, code)
  return url.toString()
}

export function readCaregiverCodeFromUrl() {
  const params = new URLSearchParams(window.location.search)
  return params.get(CODE_PARAM)
}

// Removes the param from the visible URL once it's been picked up, so a
// page refresh (or logging out and back in) doesn't keep re-triggering
// the same "switch to Caregiver mode and prefill this code" behavior.
export function clearCaregiverCodeFromUrl() {
  const url = new URL(window.location.href)
  url.searchParams.delete(CODE_PARAM)
  window.history.replaceState({}, '', url.toString())
}
