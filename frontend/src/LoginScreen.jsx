import { useState } from 'react'
import { supabase, isSupabaseConfigured } from './supabaseClient.js'

/**
 * LoginScreen — uses real Supabase auth once your teammate's project
 * exists and .env is filled in. Until then, it automatically falls back
 * to fake login so you're not blocked waiting on the backend.
 */
function LoginScreen({ onLoggedIn }) {
  const [mode, setMode] = useState('signin') // 'signin' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!email || !password) {
      setError('Enter an email and password.')
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
      // .env has real values, no code change needed.
      setTimeout(() => {
        setLoading(false)
        onLoggedIn({ email })
      }, 700)
      return
    }

    const { data, error: authError } =
      mode === 'signup'
        ? await supabase.auth.signUp({ email, password })
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

  return (
    <div className="auth-page">
      <div className="brand-panel">
        <p className="brand-mark">MedCheck</p>
        <h1>Know before you mix.</h1>
        <p className="brand-copy">
          Add what you take. We'll flag risky combinations in plain
          language, so you know what to bring up with your pharmacist.
        </p>
      </div>

      <div className="form-panel">
        <form className="auth-card" onSubmit={handleSubmit} noValidate>
          <h2>{mode === 'signin' ? 'Log in' : 'Create your account'}</h2>

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
