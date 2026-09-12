import { useEffect, useState } from 'react'
import LoginScreen from './LoginScreen.jsx'
import AddMedication from './AddMedication.jsx'
import MedicationList from './MedicationList.jsx'
import InteractionResults from './InteractionResults.jsx'
import BodyMap from './BodyMap.jsx'
import AssistantMemory from './AssistantMemory.jsx'
import CaregiverAccessCard from './CaregiverAccessCard.jsx'
import CaregiverMode from './CaregiverMode.jsx'
import OneTimeMedicationCheck from './OneTimeMedicationCheck.jsx'
import InfoTooltip from './InfoTooltip.jsx'
import StatusBanner from './StatusBanner.jsx'
import SiteNav from './SiteNav.jsx'
import SiteFooter from './SiteFooter.jsx'
import { supabase, isSupabaseConfigured } from './supabaseClient.js'
import { saveMedication, getMedications, deleteMedication } from './backendClient.js'

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
  const [mode, setMode] = useState('individual') // 'individual' | 'caregiver'

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
      const saved = await saveMedication({
        userId: user.id,
        name: drug.name,
        rxcui: drug.rxcui,
        timeOfDay: drug.timeOfDay,
      })
      // Fall back to the locally-entered time if the backend doesn't
      // return/store it yet — keeps the badge showing either way.
      setMedications((prev) => [...prev, { ...saved, timeOfDay: saved.timeOfDay ?? drug.timeOfDay }])
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
    setMode('individual')
  }

  const firstName = user?.email ? user.email.split('@')[0] : null

  return (
    <div className="site" id="top">
      <SiteNav
        mode={mode}
        onModeChange={setMode}
        userEmail={user?.email}
        onLogout={handleLogout}
      />

      <div className="page-title-band">
        <div className="site-container">
          <p className="page-eyebrow">
            {mode === 'individual' ? 'Individual account' : 'Caregiver account'}
          </p>
          <h1>
            {mode === 'individual'
              ? `Your medication overview${firstName ? `, ${firstName}` : ''}`
              : 'Patients you support'}
          </h1>
          <p className="page-title-sub">
            {mode === 'individual'
              ? 'Everything you take, checked against known interactions — so you know what to bring up with your provider.'
              : 'View medications and interaction flags for anyone who has shared their access code with you.'}
          </p>
        </div>
      </div>

      <main className="site-main">
        <div className="site-container">
          {mode === 'caregiver' ? (
            <CaregiverMode />
          ) : (
            <div className="home-main">
              <section id="overview" className="page-section">
                <StatusBanner medications={medications} />
              </section>

              {medications.length >= 2 && (
                <section id="interactions" className="page-section">
                  <div className="page-section-head">
                    <div className="section-heading-row">
                      <h2>Interaction check</h2>
                      <InfoTooltip>
                        Every pair of your long-term medications is compared for
                        known risky combinations, flagged by how serious they are.
                      </InfoTooltip>
                    </div>
                    <p className="page-section-sub">
                      Reviewed automatically whenever your medication list changes.
                    </p>
                  </div>
                  <div className="home-section home-section-primary">
                    <InteractionResults medications={medications} />
                  </div>
                </section>
              )}

              {medications.length >= 2 && (
                <section id="body-map" className="page-section">
                  <div className="page-section-head">
                    <div className="section-heading-row">
                      <h2>Where it happens</h2>
                      <InfoTooltip>
                        The same interactions above, pinned to roughly where in
                        the body they show up — hover or tap a pin for details.
                      </InfoTooltip>
                    </div>
                  </div>
                  <div className="home-section">
                    <BodyMap medications={medications} />
                  </div>
                </section>
              )}

              <section id="medications" className="page-section">
                <div className="page-section-head">
                  <h2>Manage what you take</h2>
                  <p className="page-section-sub">
                    Keep your regular medications up to date, and check anything
                    short-term before you take it.
                  </p>
                </div>
                <div className="home-columns">
                  <div className="home-section">
                    <div className="section-heading-row">
                      <h3>Long-term medications</h3>
                      <InfoTooltip>
                        Medications you take regularly. These are saved to your
                        account and checked against anything else you add.
                      </InfoTooltip>
                    </div>
                    {error && <p className="form-error">{error}</p>}
                    {loading ? (
                      <p className="med-list-empty">Loading your medications…</p>
                    ) : (
                      <MedicationList medications={medications} onRemove={handleRemove} />
                    )}
                    <AddMedication onAdd={handleAdd} />
                  </div>

                  <div className="home-section">
                    <OneTimeMedicationCheck currentMedications={medications} />
                  </div>
                </div>
              </section>

              <section id="caregiver-access" className="page-section">
                <div className="page-section-head">
                  <h2>Caregiver access</h2>
                  <p className="page-section-sub">
                    Let someone you trust view your medication list without
                    being able to change it.
                  </p>
                </div>
                <div className="home-section home-section-quiet">
                  <CaregiverAccessCard userEmail={user?.email} />
                </div>
              </section>

              {isRealUser && (
                <section id="assistant-memory" className="page-section">
                  <div className="page-section-head">
                    <div className="section-heading-row">
                      <h2>Your assistant remembers</h2>
                      <InfoTooltip>
                        Backboard-backed persistent memory — your medications
                        and any flagged interactions are remembered here
                        automatically, and you can add your own notes (like an
                        allergy) too.
                      </InfoTooltip>
                    </div>
                  </div>
                  <div className="home-section home-section-quiet">
                    <AssistantMemory userId={user.id} />
                  </div>
                </section>
              )}
            </div>
          )}
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}

export default App
