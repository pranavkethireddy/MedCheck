import { useEffect, useState } from 'react'
import LoginScreen from './LoginScreen.jsx'
import AddMedication from './AddMedication.jsx'
import MedicationList from './MedicationList.jsx'
import AIOverviewPage from './AIOverviewPage.jsx'
import InteractionsPage from './InteractionsPage.jsx'
import MedicationTimeline from './MedicationTimeline.jsx'
import PrintButton from './PrintButton.jsx'
import AssistantMemory from './AssistantMemory.jsx'
import CaregiverAccessCard from './CaregiverAccessCard.jsx'
import CaregiverMode from './CaregiverMode.jsx'
import OneTimeMedicationCheck from './OneTimeMedicationCheck.jsx'
import InfoTooltip from './InfoTooltip.jsx'
import StatusBanner from './StatusBanner.jsx'
import SiteNav from './SiteNav.jsx'
import SiteFooter from './SiteFooter.jsx'
import AiStatusBanner from './AiStatusBanner.jsx'
import DashboardStats from './DashboardStats.jsx'
import OnboardingChecklist from './OnboardingChecklist.jsx'
import EduBlurb from './EduBlurb.jsx'
import { supabase, isSupabaseConfigured } from './supabaseClient.js'
import { saveMedication, getMedications, deleteMedication, updateMedicationTime } from './backendClient.js'
import { readCaregiverCodeFromUrl, clearCaregiverCodeFromUrl } from './caregiverLink.js'
import { useInteractionCheck } from './useInteractionCheck.js'

// Individual mode's nav destinations — each is now a real page (only one
// rendered at a time) instead of an anchor-scroll target on one long page.
// Interactions + the body map used to be two separate sections; they're
// the same underlying data (see InteractionsPage.jsx), so they're combined
// into one page here. Titles/subtitles for the page-title-band live here so
// SiteNav, the band, and the footer's link list all agree on the same set
// of page ids.
const PAGE_META = {
  overview: {
    sub: 'Everything you take, checked against known interactions — so you know what to bring up with your provider.',
  },
  ai: {
    sub: "A detailed, plain-language read of your overall risk, plus a recommendation for every combination Gemini flags.",
  },
  interactions: {
    sub: 'Every pair of your long-term medications, and where in the body each flagged interaction shows up.',
  },
  schedule: {
    sub: 'Every medication with a time of day set, plotted across a 24-hour day.',
  },
  medications: {
    sub: 'Keep your regular medications up to date, and check anything short-term before you take it.',
  },
  caregiver: {
    sub: 'Let someone you trust view your medication list without being able to change it.',
  },
  memory: {
    sub: 'Automatically saved from your medications and interactions, plus any notes you add.',
  },
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
  const [mode, setMode] = useState('individual') // 'individual' | 'caregiver'
  // Which Individual-mode page is showing — see PAGE_META above.
  const [activeSection, setActiveSection] = useState('overview')
  // Captured once on first render — a code scanned from a QR code (see
  // caregiverLink.js). Read synchronously so it survives the LoginScreen
  // round trip (the URL param is cleared once it's actually been applied,
  // in the effect below).
  const [pendingCaregiverCode] = useState(() => readCaregiverCodeFromUrl())
  // Supabase reports a failed OAuth attempt (e.g. Google sign-in wasn't
  // actually enabled yet, or the person cancelled at Google's screen) by
  // redirecting back with #error=...&error_description=... in the URL
  // hash, rather than as a normal onAuthStateChange event — so it needs
  // its own read here, once, rather than going unnoticed as a silent
  // "nothing happened" on the login screen.
  const [oauthError] = useState(() => {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    const description = hash.get('error_description')
    if (description) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search)
      return description.replace(/\+/g, ' ')
    }
    return ''
  })

  // `user.id` only exists when LoginScreen did a REAL Supabase login (see
  // supabaseClient.js's isSupabaseConfigured) — the fallback demo login
  // only ever gives us { email }. Everything below treats "no user.id" as
  // "stay purely local," so the app still works with nothing configured.
  const isRealUser = Boolean(user?.id)

  // Computed once here (rather than only inside whichever page happens to
  // be mounted) so the print button — which lives in the page-title-band,
  // above/outside any individual page — always has real interaction data
  // for the PDF summary, no matter which page is currently open.
  const { interactions } = useInteractionCheck(medications)

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

  // Someone scanned a caregiver's QR code — once they're actually logged
  // in, jump straight to Caregiver mode with the code ready to go, then
  // scrub the URL so a refresh (or logging out and back in later) doesn't
  // keep re-triggering this.
  useEffect(() => {
    if (!user || !pendingCaregiverCode) return
    setMode('caregiver')
    clearCaregiverCodeFromUrl()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, pendingCaregiverCode])

  // On narrow screens the login/signup panel stacks and can scroll well
  // past a full screen's height (see .auth-page's <800px breakpoint) — if
  // the browser was scrolled down to reach the submit button, that same
  // scroll position otherwise carries straight into the logged-in view,
  // making the sticky nav appear to overlap the hero band. Snap back to
  // the top the moment a real login/session-restore completes.
  useEffect(() => {
    if (user) window.scrollTo(0, 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Boolean(user)])

  // Each nav destination is now its own page rather than a scroll target,
  // so switching pages should feel like a real navigation — jump back to
  // the top instead of leaving the scroll position wherever the previous,
  // possibly much longer or shorter, page left it.
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [activeSection, mode])

  if (checkingSession) {
    return (
      <div className="placeholder-page">
        <p className="med-list-empty">Loading…</p>
      </div>
    )
  }

  if (!user) {
    return <LoginScreen onLoggedIn={setUser} initialError={oauthError} />
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

  async function handleUpdateTime(key, timeOfDay) {
    const target = medications.find((m) => (m.id ?? m.rxcui) === key)
    if (!target) return
    setError('')

    const previousTime = target.timeOfDay ?? null

    // Optimistic update so the UI feels instant either way.
    setMedications((prev) =>
      prev.map((m) => ((m.id ?? m.rxcui) === key ? { ...m, timeOfDay } : m))
    )

    if (!isRealUser || !target.id) return // demo-mode entry — nothing to persist on the backend

    try {
      await updateMedicationTime({ id: target.id, userId: user.id, timeOfDay })
    } catch (err) {
      console.error('Failed to update medication time:', err.message)
      setError(`Couldn't update the time for ${target.name} — putting it back.`)
      setMedications((prev) =>
        prev.map((m) => ((m.id ?? m.rxcui) === key ? { ...m, timeOfDay: previousTime } : m))
      )
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
    setActiveSection('overview')
  }

  function handleModeChange(nextMode) {
    setMode(nextMode)
    setActiveSection('overview')
  }

  // Real name collected at signup (Supabase email/password: user_metadata.name;
  // Google sign-in: Supabase populates user_metadata.full_name — and
  // sometimes .name too — from the Google profile instead; demo mode:
  // user.name — see LoginScreen.jsx). Falls back to the email's local part
  // for accounts created before this existed, or a demo login that skipped
  // the signup form entirely.
  const displayName =
    user?.user_metadata?.name || user?.user_metadata?.full_name || user?.name || null
  const firstName = displayName ? displayName.split(' ')[0] : user?.email ? user.email.split('@')[0] : null
  // Google sign-in — Supabase mirrors the Google profile photo here.
  // Nothing else sets this, so it's simply absent for email/password and
  // demo-mode accounts, which already fall back to the initials avatar.
  const avatarUrl = user?.user_metadata?.avatar_url || user?.user_metadata?.picture || null

  const pageTitle =
    mode === 'caregiver'
      ? 'Patients you support'
      : activeSection === 'overview'
        ? `Your medication overview${firstName ? `, ${firstName}` : ''}`
        : {
            ai: 'AI overview',
            interactions: 'Interactions',
            schedule: 'Your daily schedule',
            medications: 'My medications',
            caregiver: 'Caregiver access',
            memory: 'Your assistant remembers',
          }[activeSection]

  const pageSub =
    mode === 'caregiver'
      ? 'View medications and interaction flags for anyone who has shared their access code with you.'
      : PAGE_META[activeSection]?.sub

  return (
    <div className="site" id="top">
      <SiteNav
        mode={mode}
        onModeChange={handleModeChange}
        activeSection={activeSection}
        onNavigate={setActiveSection}
        userEmail={user?.email}
        displayName={displayName}
        avatarUrl={avatarUrl}
        onLogout={handleLogout}
        isRealUser={isRealUser}
      />

      <div className="app-shell-main">
        <div className="page-title-band">
          <div className="site-container">
            <p className="page-eyebrow">
              {mode === 'individual' ? 'Individual account' : 'Caregiver account'}
            </p>
            <h1>{pageTitle}</h1>
            {pageSub && <p className="page-title-sub">{pageSub}</p>}
            {mode === 'individual' && medications.length > 0 && (
              <PrintButton
                label="Print / save summary as PDF"
                medications={medications}
                interactions={interactions}
                subjectName={displayName}
              />
            )}
          </div>
        </div>

        <main className="site-main">
          <div className="site-container">
            <AiStatusBanner />
            {mode === 'caregiver' ? (
              <CaregiverMode userId={user?.id} initialCode={pendingCaregiverCode} />
            ) : (
              <div className="home-main">
                {activeSection === 'overview' && (
                  <section className="page-section grid-span-12">
                    <DashboardStats medications={medications} interactions={interactions} loading={loading} />
                    <StatusBanner medications={medications} />
                    {medications.length < 2 && (
                      <OnboardingChecklist medications={medications} onNavigate={setActiveSection} />
                    )}
                  </section>
                )}

                {activeSection === 'ai' && <AIOverviewPage medications={medications} />}

                {activeSection === 'interactions' && <InteractionsPage medications={medications} />}

                {activeSection === 'schedule' && (
                  <section className="page-section grid-span-12">
                    <div className="home-section">
                      <MedicationTimeline medications={medications} />
                    </div>
                    <EduBlurb title="Why timing matters">
                      Two medications that are perfectly safe together can still interact if taken
                      too close in time — some interactions are about spacing, not the drugs
                      themselves. Setting an accurate time of day for each medication is what
                      makes the wait-time guidance on the AI overview page possible.
                    </EduBlurb>
                  </section>
                )}

                {activeSection === 'medications' && (
                  <section id="medications" className="page-section grid-span-12">
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
                          <MedicationList
                            medications={medications}
                            onRemove={handleRemove}
                            onUpdateTime={handleUpdateTime}
                          />
                        )}
                        <AddMedication onAdd={handleAdd} />
                      </div>

                      <div className="home-section">
                        <OneTimeMedicationCheck currentMedications={medications} />
                      </div>
                    </div>
                    <EduBlurb title="Long-term vs. one-time">
                      Your long-term list (left) is what everything else in the app — interaction
                      checks, the AI overview, your schedule — is based on. The one-time check
                      (right) is for something you're about to take just once, like a cold
                      medicine, without adding it to your regular list.
                    </EduBlurb>
                  </section>
                )}

                {activeSection === 'caregiver' && (
                  <section id="caregiver-access" className="page-section grid-span-12">
                    <div className="home-section home-section-quiet">
                      <CaregiverAccessCard
                        userId={user?.id}
                        userEmail={user?.email}
                        displayName={displayName}
                      />
                    </div>
                    <EduBlurb title="What a caregiver can see">
                      Anyone who links with your access code gets a read-only view of your
                      medication list, timing, and flagged interactions — they can't add, edit, or
                      remove anything. You can share this code with as many people as you'd like.
                    </EduBlurb>
                  </section>
                )}

                {activeSection === 'memory' && isRealUser && (
                  <section id="assistant-memory" className="page-section grid-span-12">
                    <div className="home-section home-section-quiet">
                      <AssistantMemory userId={user.id} />
                    </div>
                  </section>
                )}
              </div>
            )}
          </div>
        </main>

        <SiteFooter
          mode={mode}
          isRealUser={isRealUser}
          activeSection={activeSection}
          onNavigate={setActiveSection}
        />
      </div>
    </div>
  )
}

export default App
