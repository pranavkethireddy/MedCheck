import { useState } from 'react'
import bodyOutlineSrc from './assets/body-outline.png'

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
// Coordinates measured directly off assets/body-outline.png (a plain
// pixel-analysis pass — find each landmark's actual pixel position, then
// verify by drawing markers back onto a copy of the image) rather than
// guessed, so pins land on the right part of *this* figure specifically.
const REGION_META = {
  brain: { label: 'Brain / nervous system', x: 50, y: 12 },
  thyroid: { label: 'Thyroid', x: 50, y: 19 },
  lungs: { label: 'Lungs / breathing', x: 50, y: 30 },
  heart: { label: 'Heart', x: 44, y: 33 },
  stomach: { label: 'Stomach / GI tract', x: 50, y: 44 },
  kidneys: { label: 'Kidneys', x: 58, y: 48 },
  blood: { label: 'Bloodstream / bleeding risk', x: 34, y: 50 },
  muscle: { label: 'Muscles', x: 46, y: 72 },
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

// Front-facing body outline (assets/body-outline.png), sized to fill the
// figure box exactly — REGION_META's percentages are measured against this
// image's actual proportions, so the image and the coordinates have to
// move together if either changes.
function BodyOutline() {
  return <img src={bodyOutlineSrc} className="body-outline" alt="" aria-hidden="true" />
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
