import ModeSwitcher from './ModeSwitcher.jsx'

function CrossIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M9 4h6v5h5v6h-5v5H9v-5H4V9h5V4z" />
    </svg>
  )
}

// Anchor links scroll to real sections on the page — they're not
// decorative placeholders. In caregiver mode the individual-only sections
// don't exist, so the nav links are hidden rather than pointing at nothing.
function SiteNav({ mode, onModeChange, userEmail, onLogout }) {
  return (
    <nav className="site-nav">
      <div className="site-nav-inner">
        <a className="site-nav-brand" href="#top">
          <span className="site-nav-brand-icon">
            <CrossIcon />
          </span>
          <span className="site-nav-brand-text">MedCheck</span>
        </a>

        {mode === 'individual' && (
          <ul className="site-nav-links">
            <li>
              <a href="#overview">Overview</a>
            </li>
            <li>
              <a href="#interactions">Interactions</a>
            </li>
            <li>
              <a href="#medications">My medications</a>
            </li>
            <li>
              <a href="#caregiver-access">Caregiver access</a>
            </li>
          </ul>
        )}

        <div className="site-nav-right">
          <ModeSwitcher mode={mode} onChange={onModeChange} userEmail={userEmail} />
          <button className="logout-btn" onClick={onLogout}>
            Log out
          </button>
        </div>
      </div>
    </nav>
  )
}

export default SiteNav
