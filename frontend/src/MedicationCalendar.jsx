import { useMemo, useState } from 'react'
import InfoTooltip from './InfoTooltip.jsx'

// TODO (backend): this uses a local, in-memory log — nothing here persists
// across a reload. Your backend already has exactly the right shape for
// this in medication_dose_logs + the caregiver endpoints
// (/api/caregiver/log-medication-taken, /api/caregiver/medication-log) —
// see MedicationLog.jsx's comment. This component needs the same thing,
// scoped to the logged-in user themselves instead of via a caregiver link:
//   POST /api/log-medication-taken   { userId, medicationName, takenAt }
//   GET  /api/medication-log?userId=...
// Swap `logEntries`/`setLogEntries` state below for a real fetch + a real
// POST inside handleMarkTaken, and this component doesn't need to change
// anywhere else.

function toDateKey(date) {
  return date.toISOString().slice(0, 10) // "2026-09-12"
}

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

function MedicationCalendar({ medications, patientName }) {
  const [viewDate, setViewDate] = useState(() => new Date())
  const [selectedKey, setSelectedKey] = useState(() => toDateKey(new Date()))
  const [logEntries, setLogEntries] = useState([]) // [{ id, medicationName, takenAt }]
  const [marking, setMarking] = useState(null)

  function handleMarkTaken(medicationName) {
    setMarking(medicationName)
    const [year, month, day] = selectedKey.split('-').map(Number)
    const now = new Date()
    const takenAt = new Date(year, month - 1, day, now.getHours(), now.getMinutes())
    setLogEntries((prev) => [
      ...prev,
      { id: `${medicationName}-${takenAt.getTime()}`, medicationName, takenAt: takenAt.toISOString() },
    ])
    setTimeout(() => setMarking(null), 300) // brief delay so "Logging…" is visible, matching the real async flow this will become
  }

  const entriesByDay = useMemo(() => {
    const map = {}
    for (const entry of logEntries) {
      const key = toDateKey(new Date(entry.takenAt))
      if (!map[key]) map[key] = []
      map[key].push(entry)
    }
    return map
  }, [logEntries])

  const weeks = useMemo(() => {
    const year = viewDate.getFullYear()
    const month = viewDate.getMonth()
    const firstDay = new Date(year, month, 1)
    const startOffset = firstDay.getDay() // 0 = Sunday
    const daysInMonth = new Date(year, month + 1, 0).getDate()

    const cells = []
    for (let i = 0; i < startOffset; i++) cells.push(null)
    for (let day = 1; day <= daysInMonth; day++) cells.push(new Date(year, month, day))
    while (cells.length % 7 !== 0) cells.push(null)

    const rows = []
    for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7))
    return rows
  }, [viewDate])

  function changeMonth(delta) {
    setViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1))
  }

  const todayKey = toDateKey(new Date())
  const selectedEntries = entriesByDay[selectedKey] || []
  const selectedLabel = (() => {
    const [year, month, day] = selectedKey.split('-').map(Number)
    return new Date(year, month - 1, day).toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    })
  })()

  return (
    <div className="med-calendar">
      <div className="section-heading-row">
        <h3>
          Dose calendar <span className="feature-new-badge">New</span>
        </h3>
        <InfoTooltip>
          {patientName
            ? `Click any date to see what ${patientName} logged as taken that day, or mark one of their medications as taken for that date.`
            : "Click any date to see what you logged as taken that day, or mark one of your medications as taken for that date."}{' '}
          This is separate from the scheduled time of day on the Schedule
          page — this is a record of what actually happened.
        </InfoTooltip>
      </div>

      <div className="med-calendar-body">
        <div className="med-calendar-grid-wrap">
          <div className="med-calendar-month-row">
            <button type="button" className="link-button" onClick={() => changeMonth(-1)}>
              ‹
            </button>
            <span className="med-calendar-month-label">
              {viewDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
            </span>
            <button type="button" className="link-button" onClick={() => changeMonth(1)}>
              ›
            </button>
          </div>

          <div className="med-calendar-weekdays">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
              <span key={i}>{d}</span>
            ))}
          </div>

          {weeks.map((week, wi) => (
            <div className="med-calendar-row" key={wi}>
              {week.map((date, di) => {
                if (!date) return <span key={di} className="med-calendar-cell med-calendar-cell-empty" />
                const key = toDateKey(date)
                const hasEntries = Boolean(entriesByDay[key])
                return (
                  <button
                    type="button"
                    key={di}
                    className={`med-calendar-cell${key === selectedKey ? ' med-calendar-cell-selected' : ''}${
                      key === todayKey ? ' med-calendar-cell-today' : ''
                    }`}
                    onClick={() => setSelectedKey(key)}
                  >
                    {date.getDate()}
                    {hasEntries && <span className="med-calendar-dot" />}
                  </button>
                )
              })}
            </div>
          ))}
        </div>

        <div className="med-calendar-detail">
          <p className="med-calendar-detail-date">{selectedLabel}</p>

          {selectedEntries.length === 0 ? (
            <p className="med-list-empty">Nothing logged for this day yet.</p>
          ) : (
            <ul className="medication-log-list">
              {selectedEntries.map((entry) => (
                <li key={entry.id}>
                  <strong>{entry.medicationName}</strong> — {formatTime(entry.takenAt)}
                </li>
              ))}
            </ul>
          )}

          {medications.length > 0 && (
            <div className="medication-log-mark-row">
              {medications.map((m) => (
                <button
                  key={m.name}
                  type="button"
                  className="medication-log-mark-btn"
                  onClick={() => handleMarkTaken(m.name)}
                  disabled={marking === m.name}
                >
                  {marking === m.name ? 'Logging…' : `Mark ${m.name} taken`}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default MedicationCalendar
