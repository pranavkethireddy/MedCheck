import { useEffect, useState } from 'react'
import LoginScreen from './LoginScreen.jsx'
import AddMedication from './AddMedication.jsx'
import MedicationList from './MedicationList.jsx'
import { supabase } from './supabaseClient.js'
import { saveMedication, getMedications, deleteMedication } from './backendClient.js'

function App() {
  const [user, setUser] = useState(null)
  const [medications, setMedications] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // `user.id` only exists when LoginScreen did a REAL Supabase login (see
  // supabaseClient.js's isSupabaseConfigured) — the fallback demo login
  // only ever gives us { email }. Everything below treats "no user.id" as
  // "stay purely local," so the app still works with nothing configured.
  const isRealUser = Boolean(user?.id)

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
      <header className="home-header">
        <p className="brand-mark">MedCheck</p>
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
      </main>
    </div>
  )
}

export default App
