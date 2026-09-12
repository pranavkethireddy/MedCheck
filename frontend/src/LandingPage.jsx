import MagicRings from './components/MagicRings'

function CrossIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M9 4h6v5h5v6h-5v5H9v-5H4V9h5V4z" />
    </svg>
  )
}

// The pre-login splash page. Shown once per session before LoginScreen —
// see App.jsx's `showLanding` state for how the two are switched between.
function LandingPage({ onGetStarted }) {
  return (
    <div className="landing-page">
      <div className="landing-page-bg">
        <MagicRings color="#2DD4BF" colorTwo="#0F2E2B" />
      </div>

      <div className="landing-page-content">
        <div className="landing-page-logo">
          <CrossIcon />
        </div>
        <h1 className="landing-page-title">MedCheck</h1>
        <p className="landing-page-tagline">Know before you mix.</p>
        <button className="landing-get-started-btn" onClick={onGetStarted}>
          Get started
        </button>
      </div>
    </div>
  )
}

export default LandingPage
