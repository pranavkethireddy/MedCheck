import { useEffect, useRef, useState } from 'react'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000'
const POLL_INTERVAL_MS = 5000

// Shared, app-wide read of gemini_client.py's circuit breaker (GET
// /api/ai-status) — so every AI-backed feature (interaction explanations,
// the risk summary, the voice assistant) shows ONE consistent "AI features
// are running on backup responses right now" message instead of each one
// discovering the same rate limit independently and showing its own
// scattered error. Every component that calls this hook gets its own
// interval, but the backend call itself is a cheap in-memory read (no
// network call out to Gemini), so a handful of independent pollers is
// fine — same "resilient on its own" tradeoff useInteractionCheck.js
// already makes.
//
// Between polls, retryAfterSeconds counts down locally once per second so
// the countdown feels live rather than only updating every 5s — then gets
// resynced to the server's real value on the next poll.
//
// `pool` picks which of the two independent Gemini keys/quotas to ask
// about (see backend/app/gemini_client.py's GEMINI_API_KEY_ENV_BY_POOL):
// "default" (interaction explanations + risk summary — what the app-wide
// AiStatusBanner shows) or "voice" (the caregiver voice assistant's own
// key — what VoiceAssistant.jsx's mic cooldown tracks). They're reported
// separately now so a rate limit on one doesn't grey out the other.
export function useAiStatus(pool = 'default') {
  const [limited, setLimited] = useState(false)
  const [retryAfterSeconds, setRetryAfterSeconds] = useState(0)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true

    async function poll() {
      try {
        const res = await fetch(`${BACKEND_URL}/api/ai-status?pool=${encodeURIComponent(pool)}`)
        if (!res.ok) return // backend unreachable — just skip this tick, no banner
        const data = await res.json()
        if (!mountedRef.current) return
        setLimited(Boolean(data.limited))
        setRetryAfterSeconds(data.retryAfterSeconds || 0)
      } catch {
        // Backend unreachable entirely (e.g. demo mode with no Python
        // server running) — same graceful "just don't show the banner"
        // fallback as everything else in this app that talks to it.
      }
    }

    poll()
    const pollId = setInterval(poll, POLL_INTERVAL_MS)
    const countdownId = setInterval(() => {
      if (!mountedRef.current) return
      setRetryAfterSeconds((prev) => (prev > 0 ? prev - 1 : 0))
    }, 1000)

    return () => {
      mountedRef.current = false
      clearInterval(pollId)
      clearInterval(countdownId)
    }
  }, [pool])

  return { limited, retryAfterSeconds }
}
