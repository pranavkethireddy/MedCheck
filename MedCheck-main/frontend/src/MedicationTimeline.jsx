import { useMemo, useState } from 'react'
import InfoTooltip from './InfoTooltip.jsx'
import { findScheduleOverlaps, formatTime, timeToMinutes } from './timing.js'

// A day-view schedule: every medication with a time set gets plotted on a
// 24-hour line at the actual minute it's taken, instead of just a list.
// Two doses scheduled within an hour of each other are flagged directly on
// the timeline — the same "same time window" idea the backend already
// computed in app/overlap.py (find_schedule_overlaps) and returned as
// `overlaps` from /api/get-medications, but nothing on the frontend ever
// drew it. Computed client-side here (see timing.js's findScheduleOverlaps,
// a direct port of the Python version) so this works the same way whether
// `medications` came from a real backend fetch or is sitting in local/demo
// state that never called that endpoint at all (e.g. Individual mode
// before saving, or CaregiverMode's mock patients).
const HOUR_TICKS = [0, 3, 6, 9, 12, 15, 18, 21, 24]

function tickLabel(hour) {
  if (hour === 0 || hour === 24) return '12am'
  if (hour === 12) return '12pm'
  return hour < 12 ? `${hour}am` : `${hour - 12}pm`
}

// When two+ medications land at (near enough) the same minute, stack their
// markers vertically instead of drawing them exactly on top of each other.
function assignLanes(timed) {
  const sorted = [...timed].sort((a, b) => a.minutes - b.minutes)
  const lanes = [] // last-used minute per lane
  return sorted.map((entry) => {
    let lane = lanes.findIndex((lastMinutes) => entry.minutes - lastMinutes > 35)
    if (lane === -1) {
      lane = lanes.length
      lanes.push(entry.minutes)
    } else {
      lanes[lane] = entry.minutes
    }
    return { ...entry, lane }
  })
}

function MedicationTimeline({ medications }) {
  const [activeKey, setActiveKey] = useState(null)

  const timed = useMemo(
    () =>
      assignLanes(
        (medications || [])
          .map((med) => ({ med, minutes: timeToMinutes(med.timeOfDay) }))
          .filter((entry) => entry.minutes !== null)
      ),
    [medications]
  )
  const untimed = (medications || []).filter((med) => timeToMinutes(med.timeOfDay) === null)
  const overlaps = useMemo(() => findScheduleOverlaps(medications), [medications])

  const overlappingNames = new Set()
  overlaps.forEach((o) => {
    overlappingNames.add(o.a.name)
    overlappingNames.add(o.b.name)
  })

  if (!medications || medications.length === 0) {
    return <p className="med-list-empty">Add medications with a time of day to see your daily schedule.</p>
  }
  if (timed.length === 0) {
    return (
      <p className="med-list-empty">
        None of your medications have a time of day set yet — add one when saving a medication to see it here.
      </p>
    )
  }

  const maxLane = Math.max(0, ...timed.map((t) => t.lane))

  return (
    <div className="med-timeline">
      <div className="med-timeline-track-wrap" style={{ '--timeline-lanes': maxLane + 1 }}>
        <div className="med-timeline-track">
          {HOUR_TICKS.map((hour) => (
            <div key={hour} className="med-timeline-tick" style={{ left: `${(hour / 24) * 100}%` }}>
              <span>{tickLabel(hour)}</span>
            </div>
          ))}

          {timed.map(({ med, minutes, lane }) => {
            const key = `${med.name}-${minutes}`
            const flagged = overlappingNames.has(med.name)
            return (
              <button
                key={key}
                type="button"
                className={`med-timeline-marker${flagged ? ' med-timeline-marker-flagged' : ''}${
                  activeKey === key ? ' med-timeline-marker-active' : ''
                }`}
                style={{ left: `${(minutes / 1440) * 100}%`, top: `${lane * 30 + 14}px` }}
                onMouseEnter={() => setActiveKey(key)}
                onMouseLeave={() => setActiveKey((cur) => (cur === key ? null : cur))}
                onFocus={() => setActiveKey(key)}
                onBlur={() => setActiveKey((cur) => (cur === key ? null : cur))}
                onClick={() => setActiveKey((cur) => (cur === key ? null : key))}
                aria-label={`${med.name} at ${formatTime(med.timeOfDay)}${flagged ? ', same window as another medication' : ''}`}
              >
                <span className="med-timeline-dot" />
                {activeKey === key && (
                  <span className="med-timeline-tooltip">
                    <strong>{med.name}</strong>
                    <br />
                    {formatTime(med.timeOfDay)}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {overlaps.length > 0 && (
        <div className="med-timeline-warning">
          <strong>
            {overlaps.length} pair{overlaps.length === 1 ? '' : 's'} scheduled within an hour of each other:
          </strong>{' '}
          {overlaps
            .map((o) => `${o.a.name} (${formatTime(o.a.timeOfDay)}) + ${o.b.name} (${formatTime(o.b.timeOfDay)})`)
            .join('; ')}
          . Taking medications close together in time can make it harder to tell which one caused a side effect —
          worth mentioning to your pharmacist.
        </div>
      )}

      {untimed.length > 0 && (
        <p className="med-timeline-note">
          {untimed.length} medication{untimed.length === 1 ? '' : 's'} without a time set aren't shown here:{' '}
          {untimed.map((m) => m.name).join(', ')}.
        </p>
      )}
    </div>
  )
}

export default MedicationTimeline
