import { useEffect, useRef, useState } from 'react'
import { Background } from './Background'

// Startup screen in the paper style: the app's own scenery, the wordmark lifting
// off the page, and a pencil-drawn wind stroke that doubles as the progress bar.

const MIN_SHOW_MS = 1800

export function Splash({ ready }: { ready: boolean }) {
  const [progress, setProgress] = useState(0)
  const [leaving, setLeaving] = useState(false)
  const [gone, setGone] = useState(false)
  const readyRef = useRef(ready)
  useEffect(() => {
    readyRef.current = ready
  }, [ready])

  // Eases towards ~90 % while loading, then glides to 100 % once the app is ready.
  useEffect(() => {
    let raf = 0
    const start = performance.now()
    let last = start
    const tick = (now: number) => {
      const elapsed = now - start
      const dt = now - last
      last = now
      setProgress((p) => {
        const done = readyRef.current && elapsed > MIN_SHOW_MS
        const target = done ? 100 : 90 * (1 - Math.exp(-elapsed / 900))
        // Time-based easing: same feel at any frame rate.
        const next = p + (target - p) * (1 - Math.exp(-dt / (done ? 110 : 160)))
        return Math.abs(target - next) < 0.3 ? target : next
      })
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  useEffect(() => {
    if (progress < 100) return
    const t = window.setTimeout(() => setLeaving(true), 250)
    return () => window.clearTimeout(t)
  }, [progress])

  useEffect(() => {
    if (!leaving) return
    const t = window.setTimeout(() => setGone(true), 1000)
    return () => window.clearTimeout(t)
  }, [leaving])

  if (gone) return null
  return (
    <div className={`splash ${leaving ? 'leaving' : ''}`} role="progressbar" aria-label="Lumenrain" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100}>
      <Background />
      <div className="splash-center">
        <span className="brand splash-brand" aria-hidden="true">
          <span className="brand-letters" />
          <span className="brand-drop" />
        </span>
        <svg className="splash-stroke" viewBox="0 0 320 40" aria-hidden="true">
          {/* faint guide, like a pencil line not yet traced */}
          <path className="guide" d="M6 26 C 70 6 140 36 210 18 C 260 6 300 10 290 24 C 284 32 268 26 276 18" pathLength={100} />
          <path className="ink" d="M6 26 C 70 6 140 36 210 18 C 260 6 300 10 290 24 C 284 32 268 26 276 18" pathLength={100} style={{ strokeDashoffset: 100 - progress }} />
        </svg>
        <span className="splash-count">{String(Math.round(progress)).padStart(2, '0')}%</span>
      </div>
    </div>
  )
}
