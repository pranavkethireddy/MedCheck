// A small horizontal bar chart breaking down flagged interactions by
// severity — reuses the app's existing status colors (--warn for
// significant, --minor-ink for minor) rather than introducing new hues,
// since severity here is a status/state, not an arbitrary category. Each
// bar carries its own row label + count directly (no separate legend
// needed for two self-labeled rows).
function SeverityChart({ interactions }) {
  const significant = interactions.filter((i) => i.severity === 'significant').length
  const minor = interactions.filter((i) => i.severity === 'minor').length
  const max = Math.max(significant, minor, 1)

  const rows = [
    { label: 'Significant — talk to your provider', count: significant, className: 'severity-chart-bar-significant' },
    { label: 'Minor — worth noting', count: minor, className: 'severity-chart-bar-minor' },
  ]

  return (
    <div className="severity-chart" role="img" aria-label={`${significant} significant and ${minor} minor interactions flagged`}>
      {rows.map((row) => (
        <div className="severity-chart-row" key={row.label}>
          <span className="severity-chart-row-label">{row.label}</span>
          <div className="severity-chart-track">
            <div
              className={`severity-chart-bar ${row.className}`}
              style={{ width: `${row.count === 0 ? 0 : Math.max(6, (row.count / max) * 100)}%` }}
            />
          </div>
          <span className="severity-chart-row-count">{row.count}</span>
        </div>
      ))}
    </div>
  )
}

export default SeverityChart
