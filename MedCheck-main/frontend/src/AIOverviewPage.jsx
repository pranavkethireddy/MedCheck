import RiskSummaryCard from './RiskSummaryCard.jsx'
import RiskGauge from './RiskGauge.jsx'
import EduBlurb from './EduBlurb.jsx'
import { SEVERITY_LABEL } from './interactionData.js'
import { hoursApart } from './timing.js'
import { useInteractionCheck } from './useInteractionCheck.js'

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path
        d="M12 3l7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6l7-3z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// The dedicated "AI overview" page: everything Gemini has to say about this
// medication list in one place — the one-paragraph overall summary
// (RiskSummaryCard, reused as-is) PLUS a full recommendation card per
// flagged pair (explanation, timing guidance, questions to ask a provider).
// InteractionResults.jsx on the Interactions page shows the same underlying
// interactions, but framed as a technical reference list next to the body
// map; this page is meant to read as advice, so it reuses the exact same
// `.interaction-item` card styling (rather than introducing a second visual
// language) but drops the voice-mute toolbar and "backend unreachable" note
// that only make sense on the raw list.
function AIOverviewPage({ medications }) {
  const { interactions, loading, error } = useInteractionCheck(medications)

  const flagged = (interactions || []).map((interaction) => {
    const [nameA, nameB] = interaction.drugs
    const medA = medications.find((m) => m.name === nameA)
    const medB = medications.find((m) => m.name === nameB)
    return { ...interaction, gap: hoursApart(medA?.timeOfDay, medB?.timeOfDay) }
  })

  return (
    <>
      <section className="page-section grid-span-12">
        <div className="page-section-head">
          <h2>Overall risk summary</h2>
          <p className="page-section-sub">
            A plain-language read of your whole list, written by Gemini — a
            starting point for what to bring up with your provider, not a
            diagnosis.
          </p>
        </div>
        <div className="home-section home-section-primary">
          {medications.length < 2 ? (
            <p className="med-list-empty">
              Add at least two medications to get an AI-generated risk summary and recommendations.
            </p>
          ) : (
            <div className="ai-overview-summary-row">
              <RiskGauge medications={medications} interactions={interactions} />
              <div className="ai-overview-summary-text">
                <RiskSummaryCard medications={medications} />
              </div>
            </div>
          )}
        </div>
        <EduBlurb title="How this page works">
          Gemini reads the interactions already flagged below and writes a plain-language
          summary and a recommendation for each one — it never invents new interactions, and
          it's a starting point for a conversation with your pharmacist or doctor, not a
          diagnosis.
        </EduBlurb>
      </section>

      {medications.length >= 2 && (
        <section className="page-section grid-span-12">
          <div className="page-section-head">
            <h2>Recommendations for each combination</h2>
            <p className="page-section-sub">
              One card per flagged pair — what it means, how to space doses if
              timing helps, and questions worth asking your provider.
            </p>
          </div>
          <div className="home-section">
            {loading ? (
              <div className="interactions-empty-wrap">
                <span className="med-icon-bubble med-icon-bubble-muted">
                  <ShieldIcon />
                </span>
                <p>Checking interactions…</p>
              </div>
            ) : error ? (
              <p className="form-error">{error}</p>
            ) : flagged.length === 0 ? (
              <div className="interactions-empty-wrap">
                <span className="med-icon-bubble med-icon-bubble-safe">
                  <ShieldIcon />
                </span>
                <p>No known interactions found — nothing to recommend right now.</p>
              </div>
            ) : (
              <ul className="interaction-list">
                {flagged.map((interaction, i) => (
                  <li
                    key={interaction.drugs.join('-') + i}
                    className={`interaction-item interaction-${interaction.severity}`}
                  >
                    <span className="interaction-badge">
                      {SEVERITY_LABEL[interaction.severity] || interaction.severity}
                    </span>
                    <p className="interaction-drugs">{interaction.drugs.join(' + ')}</p>
                    <p className="interaction-description">
                      {interaction.explanation || interaction.description}
                    </p>

                    {interaction.min_hours_apart != null ? (
                      <p className="interaction-wait-time">
                        <strong>
                          Wait at least {interaction.min_hours_apart} hour
                          {interaction.min_hours_apart === 1 ? '' : 's'} between doses
                        </strong>{' '}
                        of these two — taking them too close together can reduce how
                        well one of them works.
                        {interaction.gap != null && (
                          <> You currently take yours about {interaction.gap} hour{interaction.gap === 1 ? '' : 's'} apart.</>
                        )}
                      </p>
                    ) : (
                      interaction.spacing_note && (
                        <p className="interaction-wait-time interaction-wait-time-no-gap">
                          <strong>Not a timing fix:</strong> {interaction.spacing_note}
                        </p>
                      )
                    )}

                    {interaction.min_hours_apart == null && interaction.gap != null && (
                      <p className="interaction-timing">
                        You take these about {interaction.gap} hour{interaction.gap === 1 ? '' : 's'} apart.
                      </p>
                    )}

                    {interaction.questions && (
                      <div className="interaction-questions">
                        <p className="interaction-questions-title">Questions to ask your provider:</p>
                        <ul>
                          {interaction.questions.map((q) => (
                            <li key={q}>{q}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}
    </>
  )
}

export default AIOverviewPage
