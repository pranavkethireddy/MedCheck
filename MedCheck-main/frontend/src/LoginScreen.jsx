import { useState } from 'react'
import { supabase, isSupabaseConfigured } from './supabaseClient.js'

function CrossIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M9 4h6v5h5v6h-5v5H9v-5H4V9h5V4z" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M4 10.5l4 4 8-9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// A small, quiet nod to HackRice 16's casino theme — a suit of cards laid
// out like a hand, used once in the brand panel. Kept purely decorative
// (aria-hidden) and monoline so it reads as a subtle motif rather than a
// literal casino graphic — this is still a medical tool first.
function CardSuitRow() {
  return (
    <svg
      className="brand-suit-row"
      viewBox="0 0 140 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path d="M14 4c-4 0-7 3-7 7 0 6 7 10 7 13 0-3 7-7 7-13 0-4-3-7-7-7z" fill="currentColor" opacity="0.55" />
      <path
        d="M49 4l4 8h9l-7 6 3 9-9-6-9 6 3-9-7-6h9z"
        fill="currentColor"
        opacity="0.4"
      />
      <path
        d="M84 4c4.5 4 8 7.5 8 12a8 8 0 0 1-16 0c0-4.5 3.5-8 8-12z"
        fill="currentColor"
        opacity="0.55"
      />
      <path
        d="M119 4c5 0 9 3.6 9 9.5 0 3-2 5-4.2 6.7L119 24l-4.8-3.8C112 18.5 110 16.5 110 13.5c0-5.9 4-9.5 9-9.5z"
        fill="currentColor"
        opacity="0.4"
      />
    </svg>
  )
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" width="18" height="18" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 15.9 18.9 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4c-7.5 0-14 4.2-17.7 10.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.5 0 10.4-1.9 14.3-5.1l-6.6-5.6C29.6 35 26.9 36 24 36c-5.2 0-9.6-3.3-11.2-7.9l-6.5 5C9.9 39.7 16.4 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.2 5.6l6.6 5.6C41.4 36 44 30.5 44 24c0-1.3-.1-2.7-.4-3.5z"
      />
    </svg>
  )
}

/**
 * LoginScreen — uses real Supabase auth once your teammate's project
 * exists and .env is filled in. Until then, it automatically falls back
 * to fake login so you're not blocked waiting on the backend. Google
 * sign-in needs one more thing beyond a real Supabase project: the Google
 * provider enabled in Supabase Auth settings with a real Google Cloud
 * OAuth client (see backend/README.md's "Google sign-in setup" section).
 * Until that's done, the button stays visibly disabled with a note
 * instead of pretending to work.
 */
function LoginScreen({ onLoggedIn, initialError = '' }) {
  const [mode, setMode] = useState('signin') // 'signin' | 'signup'
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  // Seeded from App.jsx's read of a failed-OAuth redirect (Google sign-in
  // not enabled yet, or cancelled at Google's screen) — a real string here
  // means someone just landed back from an unsuccessful Google attempt.
  const [error, setError] = useState(initialError)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!email || !password) {
      setError('Enter an email and password.')
      return
    }
    if (mode === 'signup' && !name.trim()) {
      setError('Enter your name.')
      return
    }
    if (mode === 'signup' && password.length < 6) {
      setError('Password should be at least 6 characters.')
      return
    }

    setLoading(true)

    if (!isSupabaseConfigured) {
      // No real Supabase project yet — fake it so you can keep testing
      // the rest of the app. Swaps to the real thing automatically once
      // .env has real values, no code change needed. The name only comes
      // from the signup form, so a demo "log in" (no signup) has none —
      // App.jsx falls back to the email prefix in that case.
      setTimeout(() => {
        setLoading(false)
        onLoggedIn({ email, name: name.trim() || undefined })
      }, 700)
      return
    }

    const { data, error: authError } =
      mode === 'signup'
        ? await supabase.auth.signUp({ email, password, options: { data: { name: name.trim() } } })
        : await supabase.auth.signInWithPassword({ email, password })

    setLoading(false)

    if (authError) {
      setError(authError.message)
      return
    }

    if (mode === 'signup' && !data.session) {
      // Depending on your Supabase auth settings, sign-up may require
      // email confirmation before a session exists.
      setError('Check your email to confirm your account, then log in.')
      setMode('signin')
      return
    }

    onLoggedIn(data.user)
  }

  async function handleGoogleSignIn() {
    if (!isSupabaseConfigured) {
      setError(
        'Google sign-in needs a real Supabase project first — see backend/README.md for setup steps.'
      )
      return
    }

    setError('')
    setGoogleLoading(true)
    // This redirects the whole page to Google, then back here — there's no
    // user object to hand to onLoggedIn synchronously. App.jsx's existing
    // supabase.auth.onAuthStateChange listener picks up the resulting
    // session automatically once the redirect lands, the same way a
    // restored session on refresh already works.
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })

    if (oauthError) {
      // Only reachable if Supabase couldn't even start the redirect (e.g.
      // the Google provider isn't enabled yet) — a bad Google Cloud
      // config instead surfaces later, as an error param on the redirect
      // back, which App.jsx checks for separately.
      setError(oauthError.message)
      setGoogleLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="brand-panel">
        <div className="brand-lockup">
          <span className="brand-icon">
            <CrossIcon />
          </span>
          <p className="brand-mark">MedCheck</p>
        </div>
        <h1>Know before you mix.</h1>
        <p className="brand-copy">
          Add what you take. We'll flag risky combinations in plain
          language, so you know what to bring up with your pharmacist.
        </p>
        <ul className="brand-highlights">
          <li>
            <CheckIcon /> Checked against RxNorm and openFDA
          </li>
          <li>
            <CheckIcon /> Plain-language explanations, not medical jargon
          </li>
          <li>
            <CheckIcon /> Share a read-only view with a caregiver in seconds
          </li>
        </ul>
        <div className="brand-panel-footer">
          <CardSuitRow />
          <p>Built for HackRice 16</p>
        </div>
      </div>

      <div className="form-panel">
        <form className="auth-card" onSubmit={handleSubmit} noValidate>
          <h2>{mode === 'signin' ? 'Log in' : 'Create your account'}</h2>

          <button
            type="button"
            className="google-signin-btn"
            onClick={handleGoogleSignIn}
            disabled={googleLoading || loading}
            title={!isSupabaseConfigured ? 'Needs a real Supabase project — see backend/README.md' : undefined}
          >
            <GoogleIcon />
            {googleLoading ? 'Redirecting…' : 'Continue with Google'}
          </button>

          <div className="auth-divider">
            <span>or</span>
          </div>

          {mode === 'signup' && (
            <>
              <label htmlFor="name">Name</label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jordan Rivera"
                autoComplete="name"
              />
            </>
          )}

          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
          />

          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
          />

          {error && <p className="form-error">{error}</p>}

          <button type="submit" disabled={loading}>
            {loading ? 'Please wait…' : mode === 'signin' ? 'Log in' : 'Sign up'}
          </button>

          <button
            type="button"
            className="link-button"
            onClick={() => {
              setMode(mode === 'signin' ? 'signup' : 'signin')
              setError('')
            }}
          >
            {mode === 'signin'
              ? "Don't have an account? Sign up"
              : 'Already have an account? Log in'}
          </button>

          {!isSupabaseConfigured && (
            <p className="demo-mode-note">
              Running without Supabase — any email/password will "log in."
            </p>
          )}
        </form>
      </div>
    </div>
  )
}

export default LoginScreen
