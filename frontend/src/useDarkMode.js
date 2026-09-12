import { useEffect, useState } from 'react'

const STORAGE_KEY = 'medcheck-theme' // 'light' | 'dark'

function getInitialTheme() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'light' || stored === 'dark') return stored
  } catch {
    // localStorage can throw in some privacy modes — fall through to the
    // system preference below rather than crashing the whole app over a
    // theme default.
  }
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
    return 'dark'
  }
  return 'light'
}

// Dark mode toggle (SiteNav) — a single `data-theme` attribute on <html>
// drives every color in index.css via the `[data-theme='dark']` variable
// overrides at the top of that file, so no component needs its own
// dark-mode CSS. Persisted to localStorage so it survives a refresh;
// falls back to the OS-level prefers-color-scheme the first time, same as
// most apps that offer a manual override.
export function useDarkMode() {
  const [theme, setTheme] = useState(getInitialTheme)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    try {
      localStorage.setItem(STORAGE_KEY, theme)
    } catch {
      // Best-effort persistence only — a private-browsing tab just won't
      // remember the choice across reloads, which is fine.
    }
  }, [theme])

  function toggleTheme() {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'))
  }

  return { theme, toggleTheme }
}
