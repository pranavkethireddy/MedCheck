import { useState } from 'react'

// A small reusable "?" button that reveals explanatory text on hover OR
// click. Hover shows it temporarily; clicking "pins" it open so it stays
// visible even after the mouse moves away (useful on touch devices, where
// hover doesn't really exist, and for anyone who wants to read it without
// having to keep their mouse still).
function InfoTooltip({ children, label = 'More info' }) {
  const [pinned, setPinned] = useState(false)
  const [hovering, setHovering] = useState(false)
  const open = pinned || hovering

  return (
    <span
      className="info-tooltip-wrap"
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      <button
        type="button"
        className="info-tooltip-btn"
        onClick={() => setPinned((v) => !v)}
        aria-expanded={open}
        aria-label={label}
      >
        ?
      </button>
      {open && <div className="info-tooltip-popover">{children}</div>}
    </span>
  )
}

export default InfoTooltip
