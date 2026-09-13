import { useState } from 'react'
import ModeSwitcher from './ModeSwitcher.jsx'
import { useDarkMode } from './useDarkMode.js'

function CrossIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M9 4h6v5h5v6h-5v5H9v-5H4V9h5V4z" />
    </svg>
  )
}

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="12" cy="12" r="4.5" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 2.5v2.2M12 19.3v2.2M4.2 4.2l1.6 1.6M18.2 18.2l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.2 19.8l1.6-1.6M18.2 5.8l1.6-1.6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path
        d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// One small monoline icon per nav item, all sharing the same 24x24/stroke
// convention as the rest of the app's icons — kept local to this file since
// none of these are reused elsewhere.
function OverviewIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.7" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.7" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.7" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  )
}

function SparkleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path
        d="M12 3.5l1.7 4.8 4.8 1.7-4.8 1.7L12 16.5l-1.7-4.8-4.8-1.7 4.8-1.7L12 3.5z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M18.5 15.5l.85 2.15 2.15.85-2.15.85-.85 2.15-.85-2.15-2.15-.85 2.15-.85.85-2.15z" fill="currentColor" />
    </svg>
  )
}

function LinkIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path
        d="M9.5 14.5l5-5M8.2 16.8l-1.4 1.4a3.5 3.5 0 0 1-5-5l2.8-2.8a3.5 3.5 0 0 1 5-.1M15.8 7.2l1.4-1.4a3.5 3.5 0 0 1 5 5l-2.8 2.8a3.5 3.5 0 0 1-5 .1"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function ClockNavIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12 7.5v5l3.2 1.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function PillNavIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect
        x="4.5"
        y="9.5"
        width="15"
        height="7"
        rx="3.5"
        transform="rotate(-32 12 13)"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path d="M12.4 9.2l1.9 6.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

function PeopleNavIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="8.5" cy="8" r="2.6" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="16" cy="9" r="2.1" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M3.8 18.5c.4-2.9 2.3-4.6 4.7-4.6s4.3 1.7 4.7 4.6M13.8 18.5c.3-2.3 1.7-3.7 3.6-3.7 1.9 0 3.3 1.4 3.6 3.7"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

function BrainIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path
        d="M9.5 4.5a2.7 2.7 0 0 0-2.7 2.7v.4A2.9 2.9 0 0 0 5 10.3v.6a2.9 2.9 0 0 0 1 2.2 2.7 2.7 0 0 0 2.5 3.7c.3 0 .5 0 .8-.1v1.2a2 2 0 0 0 4 0V7.2a2.7 2.7 0 0 0-2.8-2.7z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path
        d="M14.5 4.5a2.7 2.7 0 0 1 2.7 2.7v.4A2.9 2.9 0 0 1 19 10.3v.6a2.9 2.9 0 0 1-1 2.2 2.7 2.7 0 0 1-2.5 3.7c-.3 0-.5 0-.8-.1v1.2a2 2 0 0 1-4 0"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// Hamburger / close toggle for the sub-900px dropdown — see the
// site-nav-mobile-toggle / site-nav-links-open CSS. Hidden entirely above
// 900px, where the full link list already shows inline.
function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

// Each item is its own page now (see App.jsx's activeSection) rather than
// an anchor-scroll target on one long page — clicking one swaps which page
// is rendered instead of jumping the scroll position. Interactions and the
// body map used to be two separate items; they're combined into one
// "Interactions" page now (see InteractionsPage.jsx), so there's no
// separate "Body map" entry here anymore. In caregiver mode these
// individual-only pages don't exist, so the whole list is hidden.
const NAV_ITEMS = [
  { id: 'overview', label: 'Overview', Icon: OverviewIcon },
  { id: 'ai', label: 'AI overview', Icon: SparkleIcon },
  { id: 'interactions', label: 'Interactions', Icon: LinkIcon },
  { id: 'schedule', label: 'Schedule', Icon: ClockNavIcon },
  { id: 'medications', label: 'My medications', Icon: PillNavIcon },
  { id: 'caregiver', label: 'Caregiver access', Icon: PeopleNavIcon },
]

function SiteNav({ mode, onModeChange, activeSection, onNavigate, userEmail, displayName, avatarUrl, onLogout, isRealUser }) {
  const { theme, toggleTheme } = useDarkMode()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const items = isRealUser ? [...NAV_ITEMS, { id: 'memory', label: 'Assistant memory', Icon: BrainIcon }] : NAV_ITEMS

  return (
    <nav className="site-nav">
      <div className="site-nav-inner">
                <button
          type="button"
          className="site-nav-brand"
          onClick={() => {
            onModeChange('individual')
            onNavigate('overview')
            setMobileMenuOpen((open) => !open)
          }}
        >
          <span className="site-nav-brand-icon">
            <CrossIcon />
          </span>
          <span className="site-nav-brand-text">MedCheck</span>
        </button>

        {mode === 'individual' && (
          <ul className={`site-nav-links${mobileMenuOpen ? ' site-nav-links-open' : ''}`}>
            {items.map(({ id, label, Icon }) => (
              <li key={id}>
                <button
                  type="button"
                  className={activeSection === id ? 'active' : ''}
                  aria-current={activeSection === id ? 'page' : undefined}
                  onClick={() => {
                    onNavigate(id)
                    setMobileMenuOpen(false)
                  }}
                >
                  <Icon /> {label}
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="site-nav-right">
          <ModeSwitcher
            mode={mode}
            onChange={onModeChange}
            userEmail={userEmail}
            displayName={displayName}
            avatarUrl={avatarUrl}
          />
          <div className="site-nav-account-row">
            <button
              type="button"
              className="theme-toggle-btn"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
            </button>
            <button className="logout-btn" onClick={onLogout}>
              Log out
            </button>
          </div>
        </div>
      </div>
    </nav>
  )
}

export default SiteNav
