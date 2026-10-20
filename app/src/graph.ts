// Function graphs: sampling, feature detection (zeros, extrema, intersections)
// and an SVG renderer in the paper style. Pure functions, no DOM.

export type View = [xmin: number, xmax: number, ymin: number, ymax: number]

export interface GraphData {
  /** LaTeX of each curve: "f(x)", "x^2-2", "y=3\\sin(x)". */
  exprs: string[]
  /** Visible window; null = fit automatically. */
  view: View | null
}

export interface Curve {
  fn: (x: number) => number
  color: string
  label: string
}

export interface Feature {
  kind: 'zero' | 'max' | 'min' | 'cross'
  x: number
  y: number
  color: string
}

export interface Palette {
  paper: string
  ink: string
  muted: string
  grid: string
  curves: string[]
}

export const DAY_PALETTE: Palette = {
  paper: '#FFFDF7',
  ink: '#2B2A28',
  muted: '#7A746A',
  grid: '#E8E0D0',
  curves: ['#E2674A', '#3C6E91', '#4F9D7A', '#8E6BB5', '#C9A227'],
}

export const NIGHT_PALETTE: Palette = {
  paper: '#262C3D',
  ink: '#E6E1D6',
  muted: '#9A9AAE',
  grid: '#323A50',
  curves: ['#A9B8E0', '#E59A90', '#7FD3C4', '#E6C77A', '#C7A6E8'],
}

const finite = (y: number) => Number.isFinite(y) && Math.abs(y) < 1e12

function safe(fn: (x: number) => number, x: number): number {
  try {
    const y = fn(x)
    return typeof y === 'number' ? y : NaN
  } catch {
    return NaN
  }
}

function bisect(f: (x: number) => number, a: number, b: number): number {
  let fa = f(a)
  for (let i = 0; i < 50; i++) {
    const m = (a + b) / 2
    const fm = f(m)
    if (fm === 0) return m
    if (Math.sign(fm) === Math.sign(fa)) {
      a = m
      fa = fm
    } else b = m
  }
  return (a + b) / 2
}

/** Golden-section search for an extremum of fn in [a, b]. */
function golden(fn: (x: number) => number, a: number, b: number, max: boolean): number {
  const g = (Math.sqrt(5) - 1) / 2
  const s = max ? -1 : 1
  let c = b - g * (b - a)
  let d = a + g * (b - a)
  for (let i = 0; i < 60; i++) {
    if (s * fn(c) < s * fn(d)) b = d
    else a = c
    c = b - g * (b - a)
    d = a + g * (b - a)
  }
  return (a + b) / 2
}

const clean = (v: number) => (Math.abs(v) < 1e-9 ? 0 : v)

/** Zeros, local extrema and pairwise intersections inside [xmin, xmax]. */
export function analyze(curves: Curve[], xmin: number, xmax: number, n = 600): Feature[] {
  const out: Feature[] = []
  const dx = (xmax - xmin) / n
  const xs = Array.from({ length: n + 1 }, (_, i) => xmin + i * dx)
  const samples = curves.map((c) => xs.map((x) => safe(c.fn, x)))

  curves.forEach((c, k) => {
    const ys = samples[k]
    for (let i = 0; i < n; i++) {
      const [y0, y1] = [ys[i], ys[i + 1]]
      if (!finite(y0) || !finite(y1)) continue
      // Zero: a sign change that isn't a jump (e.g. 1/x at 0).
      if (y0 === 0) out.push({ kind: 'zero', x: clean(xs[i]), y: 0, color: c.color })
      else if (Math.sign(y0) !== Math.sign(y1) && y1 !== 0 && Math.abs(y1 - y0) < 50 * (Math.abs(y0) + Math.abs(y1) + 1) * dx * n / 10) {
        const x = bisect((t) => safe(c.fn, t), xs[i], xs[i + 1])
        if (Math.abs(safe(c.fn, x)) < 1e-6 * (1 + Math.abs(y0) + Math.abs(y1))) out.push({ kind: 'zero', x: clean(x), y: 0, color: c.color })
      }
      // Extremum: slope changes sign between neighbouring segments.
      if (i > 0 && finite(ys[i - 1])) {
        const s0 = ys[i] - ys[i - 1]
        const s1 = y1 - y0
        if (s0 > 0 && s1 < 0) {
          const x = golden((t) => safe(c.fn, t), xs[i - 1], xs[i + 1], true)
          out.push({ kind: 'max', x: clean(x), y: clean(safe(c.fn, x)), color: c.color })
        } else if (s0 < 0 && s1 > 0) {
          const x = golden((t) => safe(c.fn, t), xs[i - 1], xs[i + 1], false)
          out.push({ kind: 'min', x: clean(x), y: clean(safe(c.fn, x)), color: c.color })
        }
      }
    }
  })

  for (let a = 0; a < curves.length; a++)
    for (let b = a + 1; b < curves.length; b++) {
      const d = (t: number) => safe(curves[a].fn, t) - safe(curves[b].fn, t)
      for (let i = 0; i < n; i++) {
        const d0 = samples[a][i] - samples[b][i]
        const d1 = samples[a][i + 1] - samples[b][i + 1]
        if (!finite(d0) || !finite(d1)) continue
        if (d0 === 0) {
          out.push({ kind: 'cross', x: clean(xs[i]), y: clean(samples[a][i]), color: curves[a].color })
          continue
        }
        if (d1 === 0 || Math.sign(d0) === Math.sign(d1)) continue
        const x = bisect(d, xs[i], xs[i + 1])
        if (Math.abs(d(x)) < 1e-6 * (1 + Math.abs(d0) + Math.abs(d1))) out.push({ kind: 'cross', x: clean(x), y: clean(safe(curves[a].fn, x)), color: curves[a].color })
      }
    }
  // Drop duplicates found from neighbouring samples.
  return out.filter((f, i) => !out.slice(0, i).some((g) => g.kind === f.kind && g.color === f.color && Math.abs(g.x - f.x) < dx / 2))
}

/** A window that shows the interesting part of the curves. */
export function fitView(curves: Curve[]): View {
  if (!curves.length) return [-10, 10, -6, 6]
  const feats = analyze(curves, -10, 10, 400)
  let xmin = -10
  let xmax = 10
  if (feats.length) {
    const xs = feats.map((f) => f.x).sort((a, b) => a - b)
    // Periodic curves have features everywhere: centre on the middle ones instead.
    const lo = xs[Math.floor(xs.length * 0.1)]
    const hi = xs[Math.ceil(xs.length * 0.9) - 1]
    const span = Math.min(hi - lo, 14)
    const mid = (lo + hi) / 2
    const half = Math.max(3, span * 0.75)
    xmin = Math.floor(mid - half)
    xmax = Math.ceil(mid + half)
  }
  const ys: number[] = []
  for (const c of curves)
    for (let i = 0; i <= 200; i++) {
      const y = safe(c.fn, xmin + ((xmax - xmin) * i) / 200)
      if (finite(y)) ys.push(y)
    }
  if (!ys.length) return [xmin, xmax, -6, 6]
  ys.sort((a, b) => a - b)
  // Middle 80 % of the values plus every zero/extremum: steep tails may leave the frame.
  let ymin = ys[Math.floor(ys.length * 0.1)]
  let ymax = ys[Math.ceil(ys.length * 0.9) - 1]
  for (const f of feats) {
    if (f.x < xmin || f.x > xmax) continue
    ymin = Math.min(ymin, f.y)
    ymax = Math.max(ymax, f.y)
  }
  const pad = Math.max(1, (ymax - ymin) * 0.25)
  return [xmin, xmax, Math.min(ymin - pad, -1), Math.max(ymax + pad, 1)]
}

/** "Nice" grid step: 1, 2 or 5 × 10^k. */
export function niceStep(range: number, target = 8): number {
  const raw = range / target
  const p = 10 ** Math.floor(Math.log10(raw))
  const m = raw / p
  return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p
}

const fmt = (v: number) => {
  const r = Math.round(v * 1e6) / 1e6
  return String(r).replace('-', '−')
}

export interface RenderOptions {
  width: number
  height: number
  palette: Palette
  /** Show feature labels (coordinates) next to the markers. */
  labels?: boolean
}

/** Renders the graph as an SVG string. */
export function renderSvg(curves: Curve[], view: View, o: RenderOptions): string {
  const { width: W, height: H, palette: P } = o
  const [xmin, xmax, ymin, ymax] = view
  const X = (x: number) => ((x - xmin) / (xmax - xmin)) * W
  const Y = (y: number) => H - ((y - ymin) / (ymax - ymin)) * H
  const parts: string[] = []
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="Nunito, system-ui, sans-serif">`)
  parts.push(`<rect width="${W}" height="${H}" fill="${P.paper}"/>`)

  const sx = niceStep(xmax - xmin)
  const sy = niceStep(ymax - ymin, 6)
  for (let x = Math.ceil(xmin / sx) * sx; x <= xmax; x += sx) parts.push(`<line x1="${X(x)}" y1="0" x2="${X(x)}" y2="${H}" stroke="${P.grid}" stroke-width="1"/>`)
  for (let y = Math.ceil(ymin / sy) * sy; y <= ymax; y += sy) parts.push(`<line x1="0" y1="${Y(y)}" x2="${W}" y2="${Y(y)}" stroke="${P.grid}" stroke-width="1"/>`)

  // Axes with tick labels.
  const ax = Math.min(Math.max(Y(0), 0), H)
  const ay = Math.min(Math.max(X(0), 0), W)
  parts.push(`<line x1="0" y1="${ax}" x2="${W}" y2="${ax}" stroke="${P.muted}" stroke-width="1.4"/>`)
  parts.push(`<line x1="${ay}" y1="0" x2="${ay}" y2="${H}" stroke="${P.muted}" stroke-width="1.4"/>`)
  for (let x = Math.ceil(xmin / sx) * sx; x <= xmax; x += sx) {
    if (Math.abs(x) < sx / 2) continue
    parts.push(`<text x="${X(x)}" y="${Math.min(ax + 14, H - 4)}" font-size="11" fill="${P.muted}" text-anchor="middle">${fmt(x)}</text>`)
  }
  for (let y = Math.ceil(ymin / sy) * sy; y <= ymax; y += sy) {
    if (Math.abs(y) < sy / 2) continue
    parts.push(`<text x="${Math.max(ay - 5, 22)}" y="${Y(y) + 4}" font-size="11" fill="${P.muted}" text-anchor="end">${fmt(y)}</text>`)
  }

  // Curves: split into segments at gaps and jumps (asymptotes).
  const n = Math.max(200, Math.round(W))
  curves.forEach((c) => {
    let d = ''
    let prev: number | null = null
    for (let i = 0; i <= n; i++) {
      const x = xmin + ((xmax - xmin) * i) / n
      const y = safe(c.fn, x)
      if (!finite(y)) {
        prev = null
        continue
      }
      const py = Y(y)
      const jump = prev !== null && Math.abs(py - prev) > H * 1.5
      const clamped = Math.max(-H, Math.min(2 * H, py))
      d += `${prev === null || jump ? 'M' : 'L'}${X(x).toFixed(1)} ${clamped.toFixed(1)}`
      prev = py
    }
    if (d) parts.push(`<path d="${d}" fill="none" stroke="${c.color}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>`)
  })

  // Feature markers (paper dots). Busy (periodic) curves only keep their intersections.
  const feats = analyze(curves, xmin, xmax)
  const perCurve = new Map<string, number>()
  for (const f of feats) if (f.kind !== 'cross') perCurve.set(f.color, (perCurve.get(f.color) ?? 0) + 1)
  for (const f of feats) {
    if (f.kind !== 'cross' && (perCurve.get(f.color) ?? 0) > 8) continue
    if (f.y < ymin || f.y > ymax) continue
    const cx = X(f.x).toFixed(1)
    const cy = Y(f.y).toFixed(1)
    const label = `(${fmt(+f.x.toPrecision(4))}, ${fmt(+f.y.toPrecision(4))})`
    const title = { zero: 'zero', max: 'max', min: 'min', cross: 'intersection' }[f.kind]
    parts.push(
      `<g class="feat"><circle cx="${cx}" cy="${cy}" r="5" fill="${P.paper}" stroke="${f.color}" stroke-width="2"/><title>${title} ${label}</title>` +
        (o.labels ? `<text x="${+cx + 8}" y="${+cy - 8}" font-size="11" fill="${P.ink}">${label}</text>` : '') +
        `</g>`,
    )
  }
  parts.push('</svg>')
  return parts.join('')
}
