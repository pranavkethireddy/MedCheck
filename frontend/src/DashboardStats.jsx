import { formatTime, timeToMinutes } from './timing.js'
import BorderGlow from './components/BorderGlow.jsx'

function PillIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="4.5" y="9.5" width="15" height="7" rx="3.5" transform="rotate(-32 12 13)" stroke="currentColor" strokeWidth="1.7" />
      <path d="M12.4 9.2l1.9 6.6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  )
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12 7.5v5l3.2 1.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function LinkIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path
        d="M9.5 14.5l5-5M8.2 16.8l-1.4 1.4a3.5 3.5 0 0 1-5-5l2.8-2.8a3.5 3.5 0 0 1 5-.1M15.8 7.2l1.4-1.4a3.5 3.5 0 0 1 5 5l-2.8 2.8a3.5 3.5 0 0 1-5 .1"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path
        d="M12 3l7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6l7-3z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function findNextDose(medications) {
  const timed = (medications || [])
    .map((m) => ({ med: m, minutes: timeToMinutes(m.timeOfDay) }))
    .filter((entry) => entry.minutes !== null)

  if (timed.length === 0) return null

  const now = new Date()
  const nowMinutes = now.getHours() * 60 + now.getMinutes()

  const upcomingToday = timed
    .filter((entry) => entry.minutes >= nowMinutes)
    .sort((a, b) => a.minutes - b.minutes)

  if (upcomingToday.length > 0) {
    return { med: upcomingToday[0].med, whenLabel: formatTime(upcomingToday[0].med.timeOfDay) }
  }

  const earliest = [...timed].sort((a, b) => a.minutes - b.minutes)[0]
  return { med: earliest.med, whenLabel: `${formatTime(earliest.med.timeOfDay)} tomorrow` }
}

function DashboardStats({ medications, interactions, loading }) {
  const significant = interactions.filter((i) => i.severity === 'significant').length
  const minor = interactions.filter((i) => i.severity === 'minor').length
  const nextDose = findNextDose(medications)

  let riskLabel = 'No data yet'
  let riskClass = 'stat-chip-neutral'
  if (medications.length >= 2 && !loading) {
    if (significant > 0) {
      riskLabel = 'Needs attention'
      riskClass = 'stat-chip-alert'
    } else if (minor > 0) {
      riskLabel = 'Minor notes'
      riskClass = 'stat-chip-minor'
    } else {
      riskLabel = 'All clear'
      riskClass = 'stat-chip-clear'
    }
  }

  const glowProps = {
    backgroundColor: '#0F1A1A',
    borderRadius: 16,
    colors: ['#2DD4BF', '#14B8A6', '#5EEAD4'],
    glowColor: '170 80 70',
  }

  return (
    <div className="stat-grid">
      <BorderGlow {...glowProps}>
        <div className="stat-card">
          <span className="stat-card-icon">
            <PillIcon />
          </span>
          <p className="stat-card-value">{medications.length}</p>
          <p className="stat-card-label">Medication{medications.length === 1 ? '' : 's'} tracked</p>
        </div>
      </BorderGlow>

      <BorderGlow {...glowProps}>
        <div className="stat-card">
          <span className="stat-card-icon">
            <ClockIcon />
          </span>
          <p className="stat-card-value stat-card-value-compact">
            {nextDose ? nextDose.whenLabel : '—'}
          </p>
          <p className="stat-card-label">
            {nextDose ? `Next dose · ${nextDose.med.name}` : 'No times set yet'}
          </p>
        </div>
      </BorderGlow>

      <BorderGlow {...glowProps}>
        <div className="stat-card">
          <span className="stat-card-icon">
            <LinkIcon />
          </span>
          <p className="stat-card-value">{interactions.length}</p>
          <p className="stat-card-label">
            Interaction{interactions.length === 1 ? '' : 's'} flagged
            {interactions.length > 0 && ` (${significant} significant)`}
          </p>
        </div>
      </BorderGlow>

      <BorderGlow {...glowProps}>
        <div className="stat-card">
          <span className="stat-card-icon">
            <ShieldIcon />
          </span>
          <p className={`stat-chip ${riskClass}`}>{riskLabel}</p>
          <p className="stat-card-label">Overall risk read</p>
        </div>
      </BorderGlow>
    </div>
  )
}

export default DashboardStats
