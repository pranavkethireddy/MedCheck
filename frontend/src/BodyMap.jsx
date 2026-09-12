import { useState } from 'react'

// Visual companion to InteractionResults: same interaction data, pinned onto
// a body outline instead of a list, so it's obvious at a glance *where* a
// flagged interaction actually shows up. Severity → color, same as the list
// (see index.css --warn / --caution). Hovering (or tapping, for touch) a pin
// shows the same explanation text as the list view.
//
// Backend Person 1's /api/check-interactions now tags every interaction
// with a "region" key (app/body_map.py + app/known_interactions.py on the
// backend) — one of the keys below. This file owns the actual pixel/percent
// placement of each region on the drawing; the backend only ever needs to
// say *which* region, never coordinates, so the drawing can be tweaked here
// without touching the backend.
const REGION_META = {
  brain: { label: 'Brain / nervous system', x: 50, y: 8 },
  thyroid: { label: 'Thyroid', x: 50, y: 17 },
  lungs: { label: 'Lungs / breathing', x: 50, y: 27 },
  heart: { label: 'Heart', x: 42, y: 29 },
  stomach: { label: 'Stomach / GI tract', x: 50, y: 42 },
  kidneys: { label: 'Kidneys', x: 50, y: 47 },
  blood: { label: 'Bloodstream / bleeding risk', x: 26, y: 55 },
  muscle: { label: 'Muscles', x: 50, y: 75 },
}
const FALLBACK_REGION = 'blood'

const SEVERITY_RANK = { significant: 2, minor: 1 }
const SEVERITY_LABEL = { significant: 'Significant', minor: 'Minor' }

function groupByRegion(interactions) {
  const groups = {}
  for (const interaction of interactions || []) {
    const key = REGION_META[interaction.region] ? interaction.region : FALLBACK_REGION
    if (!groups[key]) groups[key] = []
    groups[key].push(interaction)
  }
  return groups
}

function worstSeverity(group) {
  return group.reduce(
    (worst, item) => (SEVERITY_RANK[item.severity] > SEVERITY_RANK[worst] ? item.severity : worst),
    'minor'
  )
}

// Plain, front-facing body outline — intentionally simple (no medical
// illustration license needed, renders crisp at any size).
function BodyOutline() {
  return (
    <svg viewBox="0 0 100 100" className="body-outline" aria-hidden="true">
      <ellipse cx="50" cy="7" rx="7" ry="7.5" />
      <path d="M44 13 h12 v6 h-12 z" />
      <path
        d="M32 20
           q18 -6 36 0
           l4 20
           q-4 3 -9 2
           l-2 -9
           v34
           q0 5 -5 5
           h-3
           q-3 0 -3 -4
           v-24
           h-2
           v24
           q0 4 -3 4
           h-3
           q-5 0 -5 -5
           v-34
           l-2 9
           q-5 1 -9 -2 z"
      />
      <path d="M22 40 l-6 22 q-1 3 2 4 q3 1 4 -2 l7 -21 z" />
      <path d="M78 40 l6 22 q1 3 -2 4 q-3 1 -4 -2 l-7 -21 z" />
      <path d="M40 78 h8 l1 16 q0 2 -2 2 h-4 q-2 0 -2 -2 z" />
      <path d="M60 78 h-8 l-1 16 q0 2 2 2 h4 q2 0 2 -2 z" />
    </svg>
  )
}

function BodyMap({ interactions, loading, error, minMedications }) {
  const [activeRegion, setActiveRegion] = useState(null)

  if (!minMedications) {
    return <p className="med-list-empty">Add at least two medications to see where interactions show up.</p>
  }
  if (loading) {
    return <p className="med-list-empty">Checking interactions…</p>
  }
  if (error) {
    return <p className="form-error">{error}</p>
  }

  const groups = groupByRegion(interactions)
  const regionKeys = Object.keys(groups)

  if (regionKeys.length === 0) {
    return <p className="med-list-empty">No known interactions to show on the body map.</p>
  }

  const active = activeRegion && groups[activeRegion] ? groups[activeRegion] : null

  return (
    <div className="body-map-wrap">
      <div className="body-map-figure">
        <BodyOutline />
        {regionKeys.map((key) => {
          const meta = REGION_META[key]
          const severity = worstSeverity(groups[key])
          return (
            <button
              key={key}
              type="button"
              className={`body-pin body-pin-${severity} ${activeRegion === key ? 'body-pin-active' : ''}`}
              style={{ left: `${meta.x}%`, top: `${meta.y}%` }}
              onMouseEnter={() => setActiveRegion(key)}
              onMouseLeave={() => setActiveRegion((cur) => (cur === key ? null : cur))}
              onFocus={() => setActiveRegion(key)}
              onBlur={() => setActiveRegion((cur) => (cur === key ? null : cur))}
              onClick={() => setActiveRegion((cur) => (cur === key ? null : key))}
              aria-label={`${meta.label}: ${groups[key].length} interaction${groups[key].length > 1 ? 's' : ''}, ${SEVERITY_LABEL[severity].toLowerCase()}`}
            >
              <span className="body-pin-dot" />
            </button>
          )
        })}
      </div>

      <div className="body-map-side">
        <ul className="body-map-legend">
          <li>
            <span className="body-pin-dot body-pin-dot-significant" /> Significant
          </li>
          <li>
            <span className="body-pin-dot body-pin-dot-minor" /> Minor
          </li>
        </ul>

        {active ? (
          <div className="body-map-tooltip">
            <p className="body-map-tooltip-region">{REGION_META[activeRegion].label}</p>
            {active.map((interaction, i) => (
              <div key={i} className="body-map-tooltip-item">
                <span className={`severity-badge severity-${interaction.severity}`}>
                  {SEVERITY_LABEL[interaction.severity] || interaction.severity}
                </span>
                <p className="interaction-drugs">{interaction.drugs.join(' + ')}</p>
                <p className="interaction-description">
                  {interaction.explanation || interaction.description}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="med-list-empty">Hover or tap a pin to see the details.</p>
        )}
      </div>
    </div>
  )
}

export default BodyMap
