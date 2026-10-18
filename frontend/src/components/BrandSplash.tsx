/** Same artwork and background as the mobile splash, so the handoff has no colour jump. */
export function BrandSplash() {
  return (
    <div className="splash" role="status" aria-label="Loading LevelUp">
      <img src="/splash-icon.png" alt="" />
      <span className="spinner" />
    </div>
  )
}
