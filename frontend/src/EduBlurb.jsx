import BorderGlow from './components/BorderGlow.jsx'

function BulbIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path
        d="M9 18h6M10 21h4M8 14.5A5.5 5.5 0 1 1 16 14.5c-.7.9-1.3 1.6-1.3 2.5H9.3c0-.9-.6-1.6-1.3-2.5z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function EduBlurb({ title, children }) {
  return (
    <BorderGlow
      backgroundColor="#0F1A1A"
      borderRadius={14}
      colors={['#2DD4BF', '#14B8A6', '#5EEAD4']}
      glowColor="170 80 70"
    >
      <div className="edu-blurb">
        <span className="edu-blurb-icon">
          <BulbIcon />
        </span>
        <div>
          <p className="edu-blurb-title">{title}</p>
          <p className="edu-blurb-copy">{children}</p>
        </div>
      </div>
    </BorderGlow>
  )
}

export default EduBlurb
