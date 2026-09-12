import { useState } from 'react'
import LoginScreen from './LoginScreen.jsx'
import AddMedication from './AddMedication.jsx'
import MedicationList from './MedicationList.jsx'
import InteractionResults from './InteractionResults.jsx'

function CrossIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M12 3v18M3 12h18" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  )
}

function App() {
  const [user, setUser] = useState(null)
  const [medications, setMedications] = useState([])

  if (!user) {
    return <LoginScreen onLoggedIn={setUser} />
  }

  function handleAdd(drug) {
    setMedications((prev) => {
      if (prev.some((m) => m.rxcui === drug.rxcui)) return prev // no duplicates
      return [...prev, drug]
    })
    // TODO: also save to Supabase here once the medications table exists:
    //   await supabase.from('medications').insert([{ user_id: user.id, name: drug.name, rxcui: drug.rxcui }])
  }

  function handleRemove(rxcui) {
    setMedications((prev) => prev.filter((m) => m.rxcui !== rxcui))
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
          <button className="link-button" onClick={() => setUser(null)}>
            Log out
          </button>
        </header>

        <main className="home-main">
          <section className="home-section">
            <h2>Your medications</h2>
            <MedicationList medications={medications} onRemove={handleRemove} />
          </section>

          <section className="home-section">
            <AddMedication onAdd={handleAdd} />
          </section>

          <section className="home-section">
            <h2>Interaction check</h2>
            <InteractionResults medications={medications} />
          </section>
        </main>
      </div>
    </div>
  )
}

export default App
