function CheckCircleIcon({ done }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="12" cy="12" r="9.5" stroke="currentColor" strokeWidth="1.7" fill={done ? 'currentColor' : 'none'} />
      {done && <path d="M8 12.3l2.6 2.6L16.3 9" stroke="var(--card-bg)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />}
    </svg>
  )
}

// Shown on the Overview page in place of a single bare "add your
// medications" line once someone has fewer than two — three concrete,
// checkable steps read as more like a guided setup and less like a nearly
// blank page. Every "done" check is derived from state already in hand
// (medications, activeSection navigation) rather than anything persisted,
// so it's necessarily a best-effort read (e.g. "visited" isn't tracked
// across a refresh) — good enough for a first-run nudge.
function OnboardingChecklist({ medications, onNavigate }) {
  const hasOne = medications.length >= 1
  const hasTwo = medications.length >= 2

  const steps = [
    {
      done: hasOne,
      title: 'Add your first medication',
      body: 'Search by name and set the time of day you take it.',
      action: !hasOne && { label: 'Add a medication', target: 'medications' },
    },
    {
      done: hasTwo,
      title: 'Add a second medication',
      body: "We'll automatically check every pair you add for known interactions.",
      action: hasOne && !hasTwo && { label: 'Add another', target: 'medications' },
    },
    {
      done: hasTwo,
      title: 'See your AI overview',
      body: 'Once two or more are on file, get a plain-language risk summary and a recommendation for anything flagged.',
      action: hasTwo && { label: 'View AI overview', target: 'ai' },
    },
  ]

  return (
    <div className="onboarding-checklist">
      <h3>Getting started</h3>
      <ul>
        {steps.map((step, i) => (
          <li key={i} className={step.done ? 'onboarding-step-done' : ''}>
            <span className="onboarding-step-icon">
              <CheckCircleIcon done={step.done} />
            </span>
            <div className="onboarding-step-body">
              <p className="onboarding-step-title">{step.title}</p>
              <p className="onboarding-step-copy">{step.body}</p>
            </div>
            {step.action && (
              <button type="button" className="onboarding-step-action" onClick={() => onNavigate(step.action.target)}>
                {step.action.label}
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

export default OnboardingChecklist
