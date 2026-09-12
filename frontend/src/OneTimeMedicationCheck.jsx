import { useState } from 'react'
import { searchMedications } from './medicationSearch.js'
import { checkInteractions, SEVERITY_LABEL } from './interactionData.js'
import { hoursApart } from './timing.js'
import InfoTooltip from './InfoTooltip.jsx'

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
      <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

// This component intentionally never calls onAdd/saveMedication — whatever
// gets checked here is never written to the patient's saved medication
// history. It only ever reads `currentMedications`, passed down from
// App.jsx, to check against.
function OneTimeMedicationCheck({ currentMedications }) {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [timeOfDay, setTimeOfDay] = useState('')
  const [checkedDrug, setCheckedDrug] = useState(null)

  function handleChange(e) {
    const value = e.target.value
    setQuery(value)
    setSuggestions(searchMedications(value))
    setCheckedDrug(null) // clear any previous result once they start a new search
  }

  function handlePick(drug) {
    setCheckedDrug({ ...drug, timeOfDay: timeOfDay || null })
    setQuery(drug.name)
    setSuggestions([])
  }

  function handleReset() {
    setCheckedDrug(null)
    setQuery('')
    setSuggestions([])
    setTimeOfDay('')
  }

  // Only show interactions that actually involve the drug just checked —
  // not a restatement of interactions already among the long-term list.
  // Also work out the timing gap against whichever long-term medication
  // it's flagged with, if both have a time set.
  const flagged = checkedDrug
    ? checkInteractions([...currentMedications, checkedDrug])
        .filter((i) => i.drugs.includes(checkedDrug.name))
        .map((interaction) => {
          const otherName = interaction.drugs.find((d) => d !== checkedDrug.name)
          const otherMed = currentMedications.find((m) => m.name === otherName)
          return { ...interaction, gap: hoursApart(checkedDrug.timeOfDay, otherMed?.timeOfDay) }
        })
    : []

  return (
    <div className="one-time-check">
      <div className="section-heading-row">
        <h3>Temporary medication check</h3>
        <InfoTooltip>
          Taking something short-term, like a fever reducer? Check it
          against your long-term medications without adding it to your
          history.
        </InfoTooltip>
      </div>

      <label htmlFor="one-time-search">Medication</label>
      <input
        id="one-time-search"
        type="text"
        value={query}
        onChange={handleChange}
        placeholder="e.g. Acetaminophen"
        autoComplete="off"
      />

      <label htmlFor="one-time-time" className="add-med-time-label">
        What time are you taking this? (optional)
      </label>
      <input
        id="one-time-time"
        type="time"
        value={timeOfDay}
        onChange={(e) => setTimeOfDay(e.target.value)}
        className="add-med-time-input"
      />

      {suggestions.length > 0 && (
        <ul className="suggestion-list">
          {suggestions.map((drug) => (
            <li key={drug.rxcui}>
              <button type="button" onClick={() => handlePick(drug)}>
                <span className="suggestion-icon">
                  <SearchIcon />
                </span>
                {drug.name}
              </button>
            </li>
          ))}
        </ul>
      )}

      {checkedDrug && (
        <div className="one-time-result">
          {currentMedications.length === 0 ? (
            <p className="interactions-empty-wrap-inline">
              You don't have any long-term medications saved yet, so there's
              nothing to check {checkedDrug.name} against.
            </p>
          ) : flagged.length === 0 ? (
            <p className="one-time-result-clear">
              No known interaction between {checkedDrug.name} and your
              long-term medications (based on this demo's sample data).
            </p>
          ) : (
            <ul className="interaction-list">
              {flagged.map((interaction) => (
                <li
                  key={interaction.drugs.join('-')}
                  className={`interaction-item interaction-${interaction.severity}`}
                >
                  <span className="interaction-badge">{SEVERITY_LABEL[interaction.severity]}</span>
                  <p className="interaction-drugs">{interaction.drugs.join(' + ')}</p>
                  <p className="interaction-description">{interaction.description}</p>
                  {interaction.gap != null && (
                    <p className="interaction-timing">
                      You're taking these about {interaction.gap} hour{interaction.gap === 1 ? '' : 's'} apart.
                      {interaction.severity === 'minor' &&
                        ' Spacing doses out like this can help reduce risk for minor interactions — but check with your provider if you\'re unsure.'}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}

          <p className="one-time-note">
            This check isn't saved — {checkedDrug.name} won't appear in your
            medication history unless you add it above instead.
          </p>

          <button type="button" className="link-button" onClick={handleReset}>
            Check a different medication
          </button>
        </div>
      )}
    </div>
  )
}

export default OneTimeMedicationCheck
