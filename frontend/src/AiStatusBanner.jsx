import { useAiStatus } from './useAiStatus.js'

function SparkleOffIcon() {
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

function formatCountdown(seconds) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return m > 0 ? `${m}:${String(s).padStart(2, '0')}` : `${s}s`
}

// Mounted once, high in App.jsx, so it's visible no matter which page is
// open. Reads the same shared circuit-breaker state (see useAiStatus.js /
// backend/app/gemini_client.py) that every individual AI-backed feature
// already falls back gracefully around — this just makes that one shared
// condition visible in one place instead of leaving people to notice it
// separately on the AI overview page, the Interactions page, and the
// voice assistant. Renders nothing at all when AI features are healthy.
function AiStatusBanner() {
  const { limited, retryAfterSeconds } = useAiStatus()

  if (!limited) return null

  return (
    <div className="ai-status-banner" role="status">
      <span className="ai-status-banner-icon">
        <SparkleOffIcon />
      </span>
      <p>
        <strong>AI features are running on backup responses right now</strong> — Gemini's
        request limit was hit. Explanations and the voice assistant will use plain, non-AI
        text until this clears, automatically, in about{' '}
        <span className="ai-status-banner-countdown">{formatCountdown(retryAfterSeconds)}</span>.
      </p>
    </div>
  )
}

export default AiStatusBanner
export { formatCountdown }
