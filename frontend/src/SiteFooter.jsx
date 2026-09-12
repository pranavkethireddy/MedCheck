// A real footer does a lot of work for credibility — and for a medication
// tool it's also the right home for the "this isn't medical advice"
// disclaimer, which matters more here than on most projects.
function SiteFooter() {
  const year = new Date().getFullYear()

  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="site-footer-disclaimer">
          <p className="site-footer-disclaimer-title">
            MedCheck is not a substitute for professional medical advice.
          </p>
          <p>
            Interaction data is drawn from public drug databases and can't
            account for your full clinical picture — your dosage, your
            history, or your other conditions. Use MedCheck to start a
            conversation with your pharmacist or doctor, never to replace
            one. If you think you're having a serious reaction, contact a
            healthcare professional immediately.
          </p>
        </div>

        <div className="site-footer-columns">
          <div className="site-footer-col">
            <h3>MedCheck</h3>
            <ul>
              <li>
                <a href="#overview">Overview</a>
              </li>
              <li>
                <a href="#interactions">Interaction check</a>
              </li>
              <li>
                <a href="#medications">My medications</a>
              </li>
              <li>
                <a href="#caregiver-access">Caregiver access</a>
              </li>
            </ul>
          </div>

          <div className="site-footer-col">
            <h3>Data sources</h3>
            <ul>
              <li>
                <a href="https://rxnav.nlm.nih.gov/" target="_blank" rel="noreferrer">
                  RxNorm / RxNav
                </a>
              </li>
              <li>
                <a href="https://open.fda.gov/" target="_blank" rel="noreferrer">
                  openFDA
                </a>
              </li>
              <li>
                <a
                  href="https://www.nlm.nih.gov/research/umls/rxnorm/index.html"
                  target="_blank"
                  rel="noreferrer"
                >
                  U.S. National Library of Medicine
                </a>
              </li>
            </ul>
          </div>

          <div className="site-footer-col">
            <h3>In an emergency</h3>
            <ul>
              <li>
                <a href="tel:911">Call 911 (U.S.)</a>
              </li>
              <li>
                <a href="tel:18002221222">Poison Control: 1-800-222-1222</a>
              </li>
            </ul>
          </div>
        </div>

        <div className="site-footer-bottom">
          <p>© {year} MedCheck. Built for HackRice 16.</p>
        </div>
      </div>
    </footer>
  )
}

export default SiteFooter
