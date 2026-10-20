import { describe, expect, it } from 'vitest'
import { analyze, fitView, niceStep, renderSvg, DAY_PALETTE } from './graph'

const c = (fn: (x: number) => number) => ({ fn, color: '#000', label: '' })

describe('graph analysis', () => {
  it('finds zeros and extrema of a parabola', () => {
    const f = analyze([c((x) => x * x - 4)], -10, 10)
    const zeros = f.filter((x) => x.kind === 'zero').map((x) => +x.x.toFixed(6))
    expect(zeros).toEqual([-2, 2])
    const min = f.find((x) => x.kind === 'min')!
    expect(min.x).toBeCloseTo(0, 5)
    expect(min.y).toBeCloseTo(-4, 5)
  })
  it('does not report the jump of 1/x as a zero', () => {
    expect(analyze([c((x) => 1 / x)], -5, 5).filter((x) => x.kind === 'zero')).toEqual([])
  })
  it('finds intersections', () => {
    const f = analyze([c((x) => x), c((x) => x * x)], -3, 3).filter((x) => x.kind === 'cross')
    expect(f.map((x) => +x.x.toFixed(6))).toEqual([0, 1])
  })
  it('fits a sensible view and nice steps', () => {
    const [x0, x1, y0, y1] = fitView([c((x) => x * x - 4)])
    expect(x0).toBeLessThan(-2)
    expect(x1).toBeGreaterThan(2)
    expect(y0).toBeLessThan(-4)
    expect(y1).toBeGreaterThan(0)
    expect(niceStep(20)).toBe(2)
    expect(niceStep(7)).toBe(1)
  })
  it('renders an SVG', () => {
    const svg = renderSvg([c(Math.sin)], [-5, 5, -2, 2], { width: 400, height: 200, palette: DAY_PALETTE })
    expect(svg.startsWith('<svg')).toBe(true)
    expect(svg).toContain('<path')
  })
})

import { curveFunction, runDocument } from './engine'

describe('curves from the note', () => {
  it('compiles curves with the note’s variables and functions', () => {
    const { engine } = runDocument(['a=3', 'f(x)=x^2+1'], { mode: 'auto', digits: 6, lang: 'en' })
    expect(curveFunction(engine, 'f(x)')!(2)).toBe(5)
    expect(curveFunction(engine, 'f')!(1)).toBe(2)
    expect(curveFunction(engine, 'y=a\\sin(x)')!(Math.PI / 2)).toBeCloseTo(3)
    expect(curveFunction(engine, 'x^2-2')!(2)).toBe(2)
    expect(curveFunction(engine, 'x+t')).toBeNull()
  })
})
