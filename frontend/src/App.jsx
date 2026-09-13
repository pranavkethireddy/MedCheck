import { useEffect, useState } from 'react'
import LoginScreen from './LoginScreen.jsx'
import LandingPage from './LandingPage.jsx'
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
import GhostFibers from './components/GhostFibers'
import MedicationCalendar from './MedicationCalendar.jsx'

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
  const [showLanding, setShowLanding] = useState(true)
  const [checkingSession, setCheckingSession] = useState(isSupabaseConfigured)
  const [medications, setMedications] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [mode, setMode] = useState('individual')
  const [activeSection, setActiveSection] = useState('overview')
  const [pendingCaregiverCode] = useState(() => readCaregiverCodeFromUrl())
  const [oauthError] = useState(() => {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    const description = hash.get('error_description')
    if (description) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search)
      return description.replace(/\+/g, ' ')
    }
    return ''
  })

  const isRealUser = Boolean(user?.id)

  const { interactions } = useInteractionCheck(medications)

  useEffect(() => {
    if (!isSupabaseConfigured) return

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

  useEffect(() => {
    if (!user || !pendingCaregiverCode) return
    setMode('caregiver')
    clearCaregiverCodeFromUrl()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, pendingCaregiverCode])

  useEffect(() => {
    if (user) window.scrollTo(0, 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Boolean(user)])

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
    if (showLanding) {
      return <LandingPage onGetStarted={() => setShowLanding(false)} />
    }
    return <LoginScreen onLoggedIn={setUser} initialError={oauthError} />
  }

  async function handleAdd(drug) {
    if (medications.some((m) => m.rxcui === drug.rxcui)) return
    setError('')

    if (!isRealUser) {
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

    setMedications((prev) => prev.filter((m) => (m.id ?? m.rxcui) !== key))

    if (!isRealUser || !target.id) return

    try {
      await deleteMedication({ id: target.id, userId: user.id })
    } catch (err) {
      console.error('Failed to delete medication:', err.message)
      setError(`Couldn't remove ${target.name} — putting it back.`)
      setMedications((prev) => [...prev, target])
    }
  }

  async function handleUpdateTime(key, timeOfDay) {
    const target = medications.find((m) => (m.id ?? m.rxcui) === key)
    if (!target) return
    setError('')

    const previousTime = target.timeOfDay ?? null

    setMedications((prev) =>
      prev.map((m) => ((m.id ?? m.rxcui) === key ? { ...m, timeOfDay } : m))
    )

    if (!isRealUser || !target.id) return

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
    setShowLanding(true)
  }

  function handleModeChange(nextMode) {
    setMode(nextMode)
    setActiveSection('overview')
  }

  const displayName =
    user?.user_metadata?.name || user?.user_metadata?.full_name || user?.name || null
  const firstName = displayName ? displayName.split(' ')[0] : user?.email ? user.email.split('@')[0] : null
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
    <div className="site" id="top" style={{ position: 'relative', background: 'transparent' }}>
      <div style={{ position: 'absolute', inset: 0, zIndex: -1, pointerEvents: 'none' }}>
  <GhostFibers lineColor="#0F2E2B" glowColor="#2DD4BF" />
      </div>

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
                    <div className="home-section">
                      <MedicationCalendar medications={medications} />
                    </div>
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
