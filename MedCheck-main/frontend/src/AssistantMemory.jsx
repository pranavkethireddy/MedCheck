import { useEffect, useState } from 'react'
import { getMemories, saveMemory } from './backendClient.js'

// "Best Use of Backboard" integration point. The backend already writes
// memories automatically in the background whenever you save a medication
// or a real interaction gets flagged (see app/backboard_client.py +
// BackgroundTasks calls in main.py) — this component is just the visible
// half: it shows what your Backboard assistant has remembered, and lets you
// add something yourself (an allergy, a preference, anything) the same way
// Backboard's own examples describe ("remembers allergies and preferences").
//
// This is intentionally best-effort: if BACKBOARD_API_KEY isn't set on the
// backend yet, /api/memory/list just comes back with an empty list rather
// than an error, so the rest of the app is never blocked on this being
// configured.

function AssistantMemory({ userId }) {
  const [memories, setMemories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  function load() {
    setLoading(true)
    setError('')
    getMemories(userId)
      .then((data) => setMemories(data.memories || []))
      .catch((err) => {
        console.error('Failed to load memories:', err.message)
        setError("Couldn't load your assistant's memory right now.")
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (!userId) return
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  async function handleAddNote(e) {
    e.preventDefault()
    const content = note.trim()
    if (!content) return

    setSaving(true)
    try {
      await saveMemory({ userId, content })
      setNote('')
      load() // refresh so the new note shows up
    } catch (err) {
      console.error('Failed to save memory:', err.message)
      setError("Couldn't save that note right now.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="assistant-memory">
      <form className="assistant-memory-form" onSubmit={handleAddNote}>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. I'm allergic to penicillin"
          aria-label="Tell your assistant something to remember"
        />
        <button type="submit" disabled={saving || !note.trim()}>
          {saving ? 'Saving…' : 'Remember this'}
        </button>
      </form>

      {loading ? (
        <p className="med-list-empty">Loading…</p>
      ) : error ? (
        <p className="form-error">{error}</p>
      ) : memories.length === 0 ? (
        <p className="med-list-empty">
          Nothing remembered yet — add a note above, or add/flag a medication and it'll show up here.
        </p>
      ) : (
        <ul className="assistant-memory-list">
          {memories.map((m, i) => (
            <li key={m.id || i}>{m.content || m.text || JSON.stringify(m)}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default AssistantMemory
