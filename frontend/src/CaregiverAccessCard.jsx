import { useState } from 'react'
import InfoTooltip from './InfoTooltip.jsx'

// TODO (backend): this whole file is mocked. A real version needs:
//   - a `caregiver_access_codes` table: { patient_user_id, code, created_at }
//   - GET /caregiver/my-code?userId=...  -> returns the existing code, or
//     generates + stores one on first call
//   The code below is generated client-side from the user's email just so
//   it stays the same across reloads during a demo — it is NOT how this
//   should work for real, since anyone could recompute it from a known email.
function generateMockCode(seed) {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i)
    hash |= 0
  }
  const num = (Math.abs(hash) % 9000) + 1000
  return `MED-${num}`
}

function CaregiverAccessCard({ userEmail }) {
  const [copied, setCopied] = useState(false)
  const code = generateMockCode(userEmail || 'demo-user')

  function handleCopy() {
    navigator.clipboard?.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="caregiver-access-card">
      <div className="caregiver-access-media">
        <img
          src="https://images.unsplash.com/photo-1586324304780-c9a5031a3599?fm=jpg&q=80&w=1200&auto=format&fit=crop"
          alt="Two people holding hands"
        />
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
        <span className="caregiver-code">{code}</span>
        <button type="button" className="link-button" onClick={handleCopy}>
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
    </div>
  )
}

export default CaregiverAccessCard
