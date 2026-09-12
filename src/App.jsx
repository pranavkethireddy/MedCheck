import { useState } from 'react'
import LoginScreen from './LoginScreen.jsx'
import AddMedication from './AddMedication.jsx'
import MedicationList from './MedicationList.jsx'

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
      <header className="home-header">
        <p className="brand-mark">MedCheck</p>
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
      </main>
    </div>
  )
}

export default App
