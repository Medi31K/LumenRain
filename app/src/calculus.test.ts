import { describe, expect, it } from 'vitest'
import { runDocument, type EngineOptions } from './engine'

const en: EngineOptions = { mode: 'auto', digits: 6, lang: 'en' }
const run = (xs: string[]) => runDocument(xs, en).outcomes.map((r) => r.result ?? r.kind)

describe('calculus & engineering operators', () => {
  it('differentiates (ordinary and partial)', () => {
    expect(run(['\\frac{d}{dx}x^3'])).toEqual(['=3x^2'])
    expect(run(['\\frac{\\partial}{\\partial x}(x^2y)'])).toEqual(['=2xy'])
    expect(run(['\\frac{\\partial^2}{\\partial x^2}(x^3y)'])).toEqual(['=6xy'])
  })
  it('integrates', () => {
    expect(run(['\\int x^2\\,dx'])[0]).toBe('=\\frac{x^3}{3}')
    expect(run(['\\int_0^1 x^2\\,dx'])[0]).toBe('=\\frac{1}{3}\\approx0.333333')
  })
  it('limits, sums, products, binomials', () => {
    expect(run(['\\lim_{x\\to0}\\frac{\\sin(x)}{x}', '\\sum_{n=1}^{10}n^2', '\\prod_{k=1}^{5}k', '\\binom{5}{2}'])).toEqual(['=1', '=385', '=120', '=10'])
  })
  it('uses defined variables in derivatives', () => {
    expect(run(['a=3', '\\frac{d}{dx}(ax^2)'])[1]).toBe('=6x')
  })
  it('determinants', () => {
    expect(run(['\\det\\begin{pmatrix}1&2\\\\3&4\\end{pmatrix}'])).toEqual(['=-2'])
  })
})
