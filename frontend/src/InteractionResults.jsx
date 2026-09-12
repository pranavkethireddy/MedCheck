// TODO: once your backend has a real interaction-check endpoint (calling
// RxNav's interaction API, per the project plan), replace MOCK_INTERACTIONS
// and checkInteractions() below with a real fetch, something like:
//
//   async function checkInteractions(medications) {
//     const rxcuis = medications.map((m) => m.rxcui).join('+')
//     const res = await fetch(`${BACKEND_URL}/check-interactions?rxcuis=${rxcuis}`)
//     return res.json() // expected: [{ drugs: [...], severity, description }, ...]
//   }
//
// Until then, this hardcoded list lets you build + demo the whole flow.
const MOCK_INTERACTIONS = [
  {
    drugs: ['Warfarin', 'Ibuprofen'],
    severity: 'significant',
    description:
      "Taking these together can raise the risk of serious bleeding. Worth flagging to your doctor before combining them.",
    questions: [
      'Is there a safer pain reliever I can take instead of ibuprofen?',
      'Should I watch for any specific warning signs?',
    ],
  },
  {
    drugs: ['Tramadol', 'Sertraline'],
    severity: 'significant',
    description:
      'This combination can increase the risk of serotonin syndrome, a rare but serious reaction.',
    questions: [
      'Is this combination safe at my current doses?',
      'What symptoms would mean I should seek care right away?',
    ],
  },
  {
    drugs: ['Lisinopril', 'Ibuprofen'],
    severity: 'minor',
    description:
      "NSAIDs like ibuprofen can make blood pressure medication less effective if used regularly.",
  },
]

const SEVERITY_RANK = { significant: 2, minor: 1 }
const SEVERITY_LABEL = { significant: 'Significant — talk to your provider', minor: 'Minor — be aware' }

function checkInteractions(medications) {
  const names = medications.map((m) => m.name)
  return MOCK_INTERACTIONS.filter((interaction) =>
    interaction.drugs.every((drug) => names.includes(drug))
  ).sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity])
}

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path
        d="M12 3l7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6l7-3z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function InteractionResults({ medications }) {
  if (medications.length < 2) {
    return (
      <div className="interactions-empty-wrap">
        <span className="med-icon-bubble med-icon-bubble-muted">
          <ShieldIcon />
        </span>
        <p>Add at least two medications to check for interactions.</p>
      </div>
    )
  }

  const flagged = checkInteractions(medications)

  if (flagged.length === 0) {
    return (
      <div className="interactions-empty-wrap">
        <span className="med-icon-bubble med-icon-bubble-safe">
          <ShieldIcon />
        </span>
        <p>No known interactions among your current medications (based on this demo's sample data).</p>
      </div>
    )
  }

  return (
    <ul className="interaction-list">
      {flagged.map((interaction) => (
        <li
          key={interaction.drugs.join('-')}
          className={`interaction-item interaction-${interaction.severity}`}
        >
          <span className="interaction-badge">{SEVERITY_LABEL[interaction.severity]}</span>
          <p className="interaction-drugs">{interaction.drugs.join(' + ')}</p>
          <p className="interaction-description">{interaction.description}</p>

          {interaction.questions && (
            <div className="interaction-questions">
              <p className="interaction-questions-title">Questions to ask your provider:</p>
              <ul>
                {interaction.questions.map((q) => (
                  <li key={q}>{q}</li>
                ))}
              </ul>
            </div>
          )}
        </li>
      ))}
    </ul>
  )
}

export default InteractionResults
