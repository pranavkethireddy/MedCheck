import { checkInteractions } from './interactionData.js'

// The whole point of MedCheck is answering "is anything I'm taking risky?"
// This banner answers that at the top of the page, before the user has to
// scroll or read anything else. Everything below it is detail.

function AlertIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M12 4l9 16H3l9-16z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M12 10v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="17" r="1" fill="currentColor" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path
        d="M12 3l7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6l7-3z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function StatusBanner({ medications }) {
  const flagged = medications.length >= 2 ? checkInteractions(medications) : []
  const significant = flagged.filter((f) => f.severity === 'significant')
  const minor = flagged.filter((f) => f.severity === 'minor')

  // Nothing to say yet — don't show a scary-looking empty banner to
  // someone who just signed up.
  if (medications.length < 2) {
    return (
      <div className="status-banner status-banner-neutral">
        <span className="status-banner-icon">
          <CheckIcon />
        </span>
        <div>
          <p className="status-banner-title">Add your medications to get started</p>
          <p className="status-banner-sub">
            Once you've added two or more, we'll check them for known interactions.
          </p>
        </div>
      </div>
    )
  }

  if (significant.length > 0) {
    return (
      <div className="status-banner status-banner-alert">
        <span className="status-banner-icon">
          <AlertIcon />
        </span>
        <div>
          <p className="status-banner-title">
            {significant.length} combination{significant.length === 1 ? '' : 's'} worth discussing
            with your provider
          </p>
          <p className="status-banner-sub">
            {significant.map((f) => f.drugs.join(' + ')).join(', ')}
            {minor.length > 0 && ` · plus ${minor.length} minor note${minor.length === 1 ? '' : 's'}`}
          </p>
        </div>
      </div>
    )
  }

  if (minor.length > 0) {
    return (
      <div className="status-banner status-banner-minor">
        <span className="status-banner-icon">
          <AlertIcon />
        </span>
        <div>
          <p className="status-banner-title">
            {minor.length} minor interaction{minor.length === 1 ? '' : 's'} to be aware of
          </p>
          <p className="status-banner-sub">{minor.map((f) => f.drugs.join(' + ')).join(', ')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="status-banner status-banner-clear">
      <span className="status-banner-icon">
        <CheckIcon />
      </span>
      <div>
        <p className="status-banner-title">No known interactions</p>
        <p className="status-banner-sub">
          Across {medications.length} medications you're currently tracking.
        </p>
      </div>
    </div>
  )
}

export default StatusBanner
