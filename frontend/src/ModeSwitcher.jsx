import { useState } from 'react'

function ModeSwitcher({ mode, onChange, userEmail }) {
  const [open, setOpen] = useState(false)
  const initial = (userEmail || '?').charAt(0).toUpperCase()

  function handleSelect(next) {
    onChange(next)
    setOpen(false)
  }

  return (
    <div className="role-menu">
      <button
        type="button"
        className="role-menu-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="role-avatar">{initial}</span>
        <span className="role-menu-text">
          <span className="role-username">{userEmail ? userEmail.split('@')[0] : 'Account'}</span>
          <span className="role-current">
            Role: {mode === 'individual' ? 'Individual' : 'Caregiver'}
            <span className="role-chevron">⌄</span>
          </span>
        </span>
      </button>

      {open && (
        <div className="role-menu-popover">
          <button
            type="button"
            className={`role-menu-option${mode === 'individual' ? ' role-menu-option-active' : ''}`}
            onClick={() => handleSelect('individual')}
          >
            Individual
          </button>
          <button
            type="button"
            className={`role-menu-option${mode === 'caregiver' ? ' role-menu-option-active' : ''}`}
            onClick={() => handleSelect('caregiver')}
          >
            Caregiver
          </button>
        </div>
      )}
    </div>
  )
}

export default ModeSwitcher
