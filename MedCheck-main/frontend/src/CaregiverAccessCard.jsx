import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import InfoTooltip from './InfoTooltip.jsx'
import { getMyCaregiverCode } from './backendClient.js'
import { buildCaregiverJoinUrl } from './caregiverLink.js'

// Fallback used in demo mode (no real logged-in userId — e.g. the app has
// no Supabase project configured) or if the backend is unreachable —
// generated deterministically from the user's email so it stays stable
// across reloads during a demo. This is NOT how it works for a real user:
// getMyCaregiverCode() below (backed by /api/caregiver/my-code and the
// caregiver_access_codes table) is what actually runs whenever a real
// userId is present, and is what CaregiverMode.jsx's real linking flow
// checks codes against.
function generateMockCode(seed) {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i)
    hash |= 0
  }
  const num = (Math.abs(hash) % 9000) + 1000
  return `MED-${num}`
}

function CaregiverAccessCard({ userId, userEmail, displayName }) {
  const [code, setCode] = useState(null)
  const [copied, setCopied] = useState(false)
  const [usingFallback, setUsingFallback] = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState(null)
  const [showQr, setShowQr] = useState(false)

  useEffect(() => {
    if (!userId) {
      // Demo mode — no real account to attach a stored code to.
      setCode(generateMockCode(userEmail || 'demo-user'))
      setUsingFallback(true)
      return
    }

    let cancelled = false
    // Prefer the real name collected at signup — this is what a caregiver
    // actually sees once they link this code, so "pranav.kethireddy" showing
    // up instead of "Pranav Kethireddy" was a real (if minor) rough edge.
    const codeDisplayName = displayName || (userEmail ? userEmail.split('@')[0] : '')

    getMyCaregiverCode({ userId, displayName: codeDisplayName })
      .then((realCode) => {
        if (cancelled) return
        setCode(realCode)
        setUsingFallback(false)
      })
      .catch((err) => {
        console.warn('Failed to fetch a real access code, using local fallback:', err.message)
        if (cancelled) return
        setCode(generateMockCode(userEmail || 'demo-user'))
        setUsingFallback(true)
      })

    return () => {
      cancelled = true
    }
  }, [userId, userEmail, displayName])

  // Generated client-side (the `qrcode` package draws it entirely in the
  // browser, no network round trip) as soon as there's a real code to
  // encode — a caregiver on another device can scan this instead of
  // typing "MED-1234" by hand. Encodes a full URL (see caregiverLink.js)
  // so scanning it lands back on this app with the code already filled
  // in, rather than just a bare code a camera app can't act on.
  useEffect(() => {
    if (!code) {
      setQrDataUrl(null)
      return
    }
    let cancelled = false
    QRCode.toDataURL(buildCaregiverJoinUrl(code), { width: 180, margin: 1 })
      .then((dataUrl) => {
        if (!cancelled) setQrDataUrl(dataUrl)
      })
      .catch((err) => {
        console.warn('Failed to generate QR code:', err.message)
      })
    return () => {
      cancelled = true
    }
  }, [code])

  function handleCopy() {
    if (!code) return
    navigator.clipboard?.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="caregiver-access-card">
      <div className="caregiver-access-media" aria-hidden="true">
        <svg viewBox="0 0 120 60" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="40" cy="24" r="14" stroke="currentColor" strokeWidth="2.5" />
          <path
            d="M18 54c2-11 11-18 22-18s20 7 22 18"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <circle cx="82" cy="20" r="11" stroke="currentColor" strokeWidth="2.5" />
          <path
            d="M64 54c1.5-9 9-14.5 18-14.5s16.5 5.5 18 14.5"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <path d="M52 34l6 6 6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <div className="section-heading-row">
        <h3>Your access code</h3>
        <InfoTooltip>
          Share this code with someone you'd like to have read-only access
          to your medication list — they can enter it in their own
          account's Caregiver mode.
        </InfoTooltip>
      </div>
      <div className="caregiver-code-row">
        <span className="caregiver-code">{code || 'Loading…'}</span>
        <button type="button" className="link-button" onClick={handleCopy} disabled={!code}>
          {copied ? 'Copied!' : 'Copy'}
        </button>
        {qrDataUrl && (
          <button type="button" className="link-button" onClick={() => setShowQr((v) => !v)}>
            {showQr ? 'Hide QR code' : 'Show QR code'} <span className="feature-new-badge">New</span>
          </button>
        )}
      </div>
      {showQr && qrDataUrl && (
        <div className="caregiver-qr-wrap">
          <img src={qrDataUrl} alt={`QR code for access code ${code}`} width={180} height={180} />
          <p className="caregiver-qr-caption">
            Scan with a phone camera to open MedCheck with this code ready to add.
          </p>
        </div>
      )}
      {usingFallback && (
        <p className="suggestion-empty">
          (Backend unreachable — showing a locally generated demo code instead.)
        </p>
      )}
    </div>
  )
}

export default CaregiverAccessCard
