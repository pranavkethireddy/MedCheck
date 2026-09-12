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
