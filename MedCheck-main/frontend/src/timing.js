// Rough, demo-level helper: given two "HH:MM" (24-hour) times, how many
// hours apart are they? Used to show a spacing note next to flagged
// interactions — NOT real clinical timing/half-life guidance, just an
// illustration of the idea for the demo.
export function hoursApart(timeA, timeB) {
  if (!timeA || !timeB) return null

  const toMinutes = (t) => {
    const [h, m] = t.split(':').map(Number)
    return h * 60 + m
  }

  const diff = Math.abs(toMinutes(timeA) - toMinutes(timeB))
  const shorterWay = Math.min(diff, 1440 - diff) // shorter direction around a 24h clock
  return Math.round((shorterWay / 60) * 10) / 10 // one decimal place
}

// "14:30" -> "2:30 PM"
export function formatTime(t) {
  const [h, m] = t.split(':').map(Number)
  const period = h >= 12 ? 'PM' : 'AM'
  const hour12 = ((h + 11) % 12) + 1
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`
}

// "08:00" -> 480 (minutes since midnight). Mirrors
// backend/app/overlap.py's parse_time_to_minutes exactly, so a medication
// list flags the same overlapping pairs whether it came from a real
// backend fetch (which already ran that Python version server-side) or
// is sitting in local/demo state that never touched the backend at all —
// MedicationTimeline.jsx always computes it client-side for that reason,
// rather than depending on a specific endpoint having returned `overlaps`.
export function timeToMinutes(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return null
  const match = /^(\d{1,2}):(\d{2})$/.exec(timeStr.trim())
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) return null
  return hours * 60 + minutes
}

// medications: [{ name, timeOfDay, ... }, ...] -> [{ a, b, minutesApart }, ...]
// Two doses "overlap" if they fall within `windowMinutes` of each other —
// same ~60 minute default as the backend's version, illustrative rather
// than real clinical timing guidance (same framing as hoursApart above).
export function findScheduleOverlaps(medications, windowMinutes = 60) {
  const timed = (medications || [])
    .map((med) => ({ med, minutes: timeToMinutes(med.timeOfDay) }))
    .filter((entry) => entry.minutes !== null)

  const overlaps = []
  for (let i = 0; i < timed.length; i++) {
    for (let j = i + 1; j < timed.length; j++) {
      const diff = Math.abs(timed[i].minutes - timed[j].minutes)
      if (diff <= windowMinutes) {
        overlaps.push({ a: timed[i].med, b: timed[j].med, minutesApart: diff })
      }
    }
  }
  return overlaps
}
