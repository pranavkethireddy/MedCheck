// A semicircular gauge summarizing overall interaction risk in one glance,
// at the top of the AI overview page — same "illustrative overview, not a
// real clinical score" spirit as timing.js's hoursApart() (which says so
// explicitly in its own doc comment). This is a simple heuristic over
// what's already been flagged (significant interactions count double),
// not a real medical severity index, and says so in its own caption.
//
// SVG path math: a semicircle from angle 180° (left) to 0° (right) along
// a radius-80 arc centered at (100, 100) — arcLength(t) below walks that
// same arc for any fraction 0..1, used both for the colored zone
// backgrounds and for the needle's tip position.
function arcPoint(fraction, radius = 80, cx = 100, cy = 100) {
  const angle = Math.PI - fraction * Math.PI // 180° -> 0°
  return { x: cx + radius * Math.cos(angle), y: cy - radius * Math.sin(angle) }
}

function arcPath(fromFraction, toFraction, radius = 80) {
  const start = arcPoint(fromFraction, radius)
  const end = arcPoint(toFraction, radius)
  const largeArc = toFraction - fromFraction > 0.5 ? 1 : 0
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x} ${end.y}`
}

function computeRisk(medications, interactions) {
  if (!medications || medications.length < 2) {
    return { score: 0, label: 'Not enough data', tone: 'neutral' }
  }
  const significant = interactions.filter((i) => i.severity === 'significant').length
  const minor = interactions.filter((i) => i.severity === 'minor').length
  const raw = significant * 2 + minor
  const score = Math.max(0, Math.min(100, raw === 0 ? 4 : 30 + raw * 18))

  if (significant > 0) return { score, label: 'Needs attention', tone: 'alert' }
  if (minor > 0) return { score, label: 'Minor notes', tone: 'minor' }
  return { score, label: 'All clear', tone: 'clear' }
}

function RiskGauge({ medications, interactions }) {
  const { score, label, tone } = computeRisk(medications, interactions)
  const fraction = score / 100
  const needleTip = arcPoint(fraction, 68)
  const needleBase1 = arcPoint(Math.max(0, fraction - 0.02), 14)
  const needleBase2 = arcPoint(Math.min(1, fraction + 0.02), 14)

  return (
    <div className={`risk-gauge risk-gauge-${tone}`}>
      <svg viewBox="0 0 200 115" className="risk-gauge-svg" aria-hidden="true">
        <path d={arcPath(0, 0.34)} className="risk-gauge-zone risk-gauge-zone-clear" strokeWidth="16" fill="none" strokeLinecap="round" />
        <path d={arcPath(0.34, 0.64)} className="risk-gauge-zone risk-gauge-zone-minor" strokeWidth="16" fill="none" strokeLinecap="round" />
        <path d={arcPath(0.64, 1)} className="risk-gauge-zone risk-gauge-zone-alert" strokeWidth="16" fill="none" strokeLinecap="round" />
        <polygon
          points={`${needleBase1.x},${needleBase1.y} ${needleBase2.x},${needleBase2.y} ${needleTip.x},${needleTip.y}`}
          className="risk-gauge-needle"
        />
        <circle cx="100" cy="100" r="7" className="risk-gauge-hub" />
      </svg>
      <p className="risk-gauge-label">{label}</p>
      <p className="risk-gauge-caption">An illustrative overview of what's been flagged below — not a clinical risk score.</p>
    </div>
  )
}

export default RiskGauge
