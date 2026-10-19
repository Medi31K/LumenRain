// Paper-cutout scenery: layered waves sway, clouds drift, wind gusts sweep by.
// All motion is CSS (transform / stroke-dashoffset) so it stays on the GPU.

const W = 1440
const H = 900

function wavePath(width: number, height: number, amp: number, crests: number, phase: number): string {
  const step = width / crests
  let d = `M 0 ${height} L 0 ${amp}`
  for (let i = 0; i < crests; i++) {
    const x0 = i * step
    const peak = (i + phase) % 2 ? 0 : amp * 2
    d += ` Q ${x0 + step / 2} ${peak} ${x0 + step} ${amp}`
  }
  return `${d} L ${width} ${height} Z`
}

function Cloud({ x, y, s, i }: { x: number; y: number; s: number; i: number }) {
  return (
    <g className={`cloud cloud-${i}`} style={{ ['--x' as string]: `${x}px` }}>
      <g transform={`translate(0 ${y}) scale(${s})`}>
        <g className="cloud-bob">
          <ellipse cx="45" cy="60" rx="45" ry="30" />
          <ellipse cx="105" cy="45" rx="55" ry="45" />
          <ellipse cx="175" cy="58" rx="45" ry="32" />
        </g>
      </g>
    </g>
  )
}

function windPath(w: number): string {
  return `M 0 20 C ${w * 0.3} 0 ${w * 0.6} 30 ${w * 0.85} 12 C ${w} 2 ${w} -14 ${w * 0.88} -10 C ${w * 0.8} -6 ${w * 0.84} 6 ${w * 0.92} 0`
}

// x is the resting position (no motion); with motion the clouds drift across.
const clouds = [
  { x: 1180, y: 150, s: 0.9 },
  { x: 30, y: 300, s: 0.75 },
  { x: 1220, y: 420, s: 0.6 },
  { x: 640, y: 250, s: 0.45 },
]
const winds = [
  { x: 40, y: 380, w: 240 },
  { x: 1150, y: 330, w: 210 },
  { x: 1050, y: 80, w: 170 },
]

export function Background() {
  return (
    <svg className="scene" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      <g className="clouds">
        {clouds.map((c, i) => (
          <Cloud key={i} {...c} i={i} />
        ))}
      </g>
      <g className="winds">
        {winds.map((w, i) => (
          <g key={i} transform={`translate(${w.x} ${w.y})`}>
            <path className={`wind wind-${i}`} d={windPath(w.w)} pathLength={100} />
          </g>
        ))}
      </g>
      <g className="waves">
        {[0, 1, 2, 3].map((k) => (
          <g key={k} transform={`translate(-120 ${640 + k * 58})`}>
            <path className={`wave wave-${k + 1}`} d={wavePath(W + 240, 320, 18 + k * 4, 7 + k, k)} />
          </g>
        ))}
      </g>
    </svg>
  )
}
