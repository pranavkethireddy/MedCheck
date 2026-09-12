import { useState } from 'react'

function ModeSwitcher({ mode, onChange, userEmail, displayName, avatarUrl }) {
  const [open, setOpen] = useState(false)
  const shownName = displayName || (userEmail ? userEmail.split('@')[0] : 'Account')
  const initial = (displayName || userEmail || '?').charAt(0).toUpperCase()

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
        {avatarUrl ? (
          <img className="role-avatar role-avatar-photo" src={avatarUrl} alt="" referrerPolicy="no-referrer" />
        ) : (
          <span className="role-avatar">{initial}</span>
        )}
        <span className="role-menu-text">
          <span className="role-username">{shownName}</span>
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
