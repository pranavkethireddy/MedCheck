import InteractionResults from './InteractionResults.jsx'
import BodyMap from './BodyMap.jsx'
import InfoTooltip from './InfoTooltip.jsx'
import SeverityChart from './SeverityChart.jsx'
import EduBlurb from './EduBlurb.jsx'
import { useInteractionCheck } from './useInteractionCheck.js'

// Interactions and the body map used to be two separate nav sections on one
// long scrolling page; they're the same underlying data (see
// useInteractionCheck.js), just a list view vs. a visual one, so they now
// live together on a single "Interactions" page instead of being split
// across two.
function InteractionsPage({ medications }) {
  const { interactions, loading } = useInteractionCheck(medications)

  return (
    <>
      <section className="page-section grid-span-12">
        <div className="page-section-head">
          <div className="section-heading-row">
            <h2>Interaction check</h2>
            <InfoTooltip>
              Every pair of your long-term medications is compared for known
              risky combinations, flagged by how serious they are.
            </InfoTooltip>
          </div>
          <p className="page-section-sub">
            Reviewed automatically whenever your medication list changes.
          </p>
        </div>

        {medications.length >= 2 && !loading && interactions.length > 0 && (
          <div className="home-section" style={{ marginBottom: '1.5rem' }}>
            <h3>Severity breakdown</h3>
            <SeverityChart interactions={interactions} />
          </div>
        )}

        <div className="home-section home-section-primary">
          <InteractionResults medications={medications} />
        </div>

        <EduBlurb title="How we check interactions">
          Every pair of medications you take long-term is compared against a curated list of
          known interactions, cross-referenced with RxNorm and openFDA data. A flag here means
          "worth a conversation with your pharmacist or doctor" — not that you should stop
          taking anything on your own.
        </EduBlurb>
      </section>

      <section className="page-section grid-span-12">
        <div className="page-section-head">
          <div className="section-heading-row">
            <h2>Where it happens</h2>
            <InfoTooltip>
              The same interactions above, pinned to roughly where in the body
              they show up — hover or tap a pin for details.
            </InfoTooltip>
          </div>
        </div>
        <div className="home-section">
          <BodyMap medications={medications} />
        </div>
      </section>
    </>
  )
}

export default InteractionsPage
