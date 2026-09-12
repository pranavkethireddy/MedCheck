import { useEffect, useState } from 'react'
import LoginScreen from './LoginScreen.jsx'
import AddMedication from './AddMedication.jsx'
import MedicationList from './MedicationList.jsx'
import InteractionResults from './InteractionResults.jsx'
import BodyMap from './BodyMap.jsx'
import AssistantMemory from './AssistantMemory.jsx'
import { supabase, isSupabaseConfigured } from './supabaseClient.js'
import { saveMedication, getMedications, deleteMedication, checkInteractions } from './backendClient.js'

function CrossIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M12 3v18M3 12h18" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  )
}

function App() {
  const [user, setUser] = useState(null)
  // Whether we've finished checking for an already-logged-in Supabase
  // session yet. Starts true so we don't flash LoginScreen for a moment
  // before the check resolves (or forever, in demo mode, where there's
  // nothing to check).
  const [checkingSession, setCheckingSession] = useState(isSupabaseConfigured)
  const [medications, setMedications] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [interactions, setInteractions] = useState([])
  const [interactionsLoading, setInteractionsLoading] = useState(false)
  const [interactionsError, setInteractionsError] = useState('')

  // `user.id` only exists when LoginScreen did a REAL Supabase login (see
  // supabaseClient.js's isSupabaseConfigured) — the fallback demo login
  // only ever gives us { email }. Everything below treats "no user.id" as
  // "stay purely local," so the app still works with nothing configured.
  const isRealUser = Boolean(user?.id)

  // Restore an existing Supabase session on load (page refresh, reopening
  // the tab, etc.) instead of forcing a fresh login every time. Supabase
  // already persists the session token in localStorage by default — this
  // is just the piece that actually reads it back on mount. Also keeps
  // `user` in sync if the token refreshes or the session ends elsewhere
  // (e.g. logged out in another tab), until handleLogout is called here.
  useEffect(() => {
    if (!isSupabaseConfigured) return // demo mode: nothing to restore

    let cancelled = false

    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return
      if (data.session?.user) setUser(data.session.user)
      setCheckingSession(false)
    })

    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        setUser(null)
      } else if (session?.user) {
        setUser(session.user)
      }
    })

    return () => {
      cancelled = true
      subscription.subscription.unsubscribe()
    }
  }, [])

  // Load this user's saved medications once they're really logged in.
  useEffect(() => {
    if (!isRealUser) return

    let cancelled = false
    setLoading(true)
    setError('')

    getMedications(user.id)
      .then((data) => {
        if (!cancelled) setMedications(data.medications || [])
      })
      .catch((err) => {
        console.error('Failed to load medications:', err.message)
        if (!cancelled) setError("Couldn't load your saved medications from the backend.")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  // Single source of truth for interaction checks — both the list view
  // (InteractionResults) and the body map (BodyMap) render the same data
  // instead of each fetching it separately.
  useEffect(() => {
    if (medications.length < 2) {
      setInteractions([])
      setInteractionsError('')
      return
    }

    let cancelled = false
    setInteractionsLoading(true)
    setInteractionsError('')

    const drugs = medications.map((m) => ({ rxcui: m.rxcui, name: m.name }))
    checkInteractions(drugs)
      .then((results) => {
        if (!cancelled) setInteractions(results || [])
      })
      .catch((err) => {
        console.error('Failed to check interactions:', err.message)
        if (!cancelled) setInteractionsError("Couldn't check interactions right now.")
      })
      .finally(() => {
        if (!cancelled) setInteractionsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [medications])

  if (checkingSession) {
    return (
      <div className="placeholder-page">
        <p className="med-list-empty">Loading…</p>
      </div>
    )
  }

  if (!user) {
    return <LoginScreen onLoggedIn={setUser} />
  }

  async function handleAdd(drug) {
    if (medications.some((m) => m.rxcui === drug.rxcui)) return // no duplicates
    setError('')

    if (!isRealUser) {
      // Demo mode (no real Supabase project configured yet) — keep it
      // purely local, exactly like before.
      setMedications((prev) => [...prev, drug])
      return
    }

    try {
      const saved = await saveMedication({ userId: user.id, name: drug.name, rxcui: drug.rxcui })
      setMedications((prev) => [...prev, saved])
    } catch (err) {
      console.error('Failed to save medication:', err.message)
      setError(`Couldn't save ${drug.name}: ${err.message}`)
    }
  }

  async function handleRemove(key) {
    const target = medications.find((m) => (m.id ?? m.rxcui) === key)
    if (!target) return
    setError('')

    // Optimistic removal so the UI feels instant either way.
    setMedications((prev) => prev.filter((m) => (m.id ?? m.rxcui) !== key))

    if (!isRealUser || !target.id) return // demo-mode entry — nothing to delete on the backend

    try {
      await deleteMedication({ id: target.id, userId: user.id })
    } catch (err) {
      console.error('Failed to delete medication:', err.message)
      setError(`Couldn't remove ${target.name} — putting it back.`)
      setMedications((prev) => [...prev, target]) // roll back so state matches what's really saved
    }
  }

  async function handleLogout() {
    if (isRealUser) {
      await supabase.auth.signOut()
    }
    setUser(null)
    setMedications([])
    setError('')
  }

  return (
    <div className="home-page">
      <div className="home-content">
        <header className="home-header">
          <div className="home-brand-lockup">
            <span className="home-brand-icon">
              <CrossIcon />
            </span>
            <div>
              <p className="brand-mark">MedCheck</p>
              <p className="home-greeting">
                Welcome back{user?.email ? `, ${user.email.split('@')[0]}` : ''} 👋
              </p>
            </div>
          </div>
          <button className="link-button" onClick={handleLogout}>
            Log out
          </button>
        </header>

        <main className="home-main">
          <section className="home-section">
            <h2>Your medications</h2>
            {error && <p className="form-error">{error}</p>}
            {loading ? (
              <p className="med-list-empty">Loading your medications…</p>
            ) : (
              <MedicationList medications={medications} onRemove={handleRemove} />
            )}
          </section>

          <section className="home-section">
            <AddMedication onAdd={handleAdd} />
          </section>

          <section className="home-section">
            <h2>Interaction check</h2>
            <InteractionResults
              interactions={interactions}
              loading={interactionsLoading}
              error={interactionsError}
              minMedications={medications.length >= 2}
            />
          </section>

          <section className="home-section">
            <h2>Where it happens</h2>
            <BodyMap
              interactions={interactions}
              loading={interactionsLoading}
              error={interactionsError}
              minMedications={medications.length >= 2}
            />
          </section>

          {isRealUser && (
            <section className="home-section">
              <h2>Your assistant remembers</h2>
              <AssistantMemory userId={user.id} />
            </section>
          )}
        </main>
      </div>
    </div>
  )
}

export default App
