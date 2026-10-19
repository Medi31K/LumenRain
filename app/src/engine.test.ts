import { describe, expect, it } from 'vitest'
import { inputOf, runDocument, unwrapResult, type EngineOptions } from './engine'

const en: EngineOptions = { mode: 'auto', digits: 6, lang: 'en' }
const da: EngineOptions = { ...en, lang: 'da' }
const run = (xs: string[], o = en) => runDocument(xs, o).outcomes.map((r) => r.result ?? r.kind)

describe('evaluate', () => {
  it('handles plain arithmetic without float noise', () => {
    expect(run(['0.1+0.2', '2^{10}'])).toEqual(['=0.3', '=1024'])
  })
  it('shows exact and approximate values', () => {
    expect(run(['\\frac{1}{3}+\\frac{1}{6}'])).toEqual(['=\\frac{1}{2}\\approx0.5'])
    expect(run(['\\sqrt{2}/3+\\pi'])[0]).toMatch(/\\approx3\.613$/)
  })
  it('respects exact / decimal modes', () => {
    expect(run(['\\sqrt{8}'], { ...en, mode: 'exact' })).toEqual(['=2\\sqrt{2}'])
    expect(run(['\\sqrt{8}'], { ...en, mode: 'decimal' })).toEqual(['\\approx2.82843'])
  })
  it('uses a decimal comma in Danish', () => {
    expect(run(['1/4'], da)).toEqual(['=\\frac{1}{4}\\approx0{,}25'])
    expect(run(['2{,}5\\cdot2'], da)).toEqual(['=5'])
  })
})

describe('variables', () => {
  it('defines and reuses variables in document order', () => {
    const { outcomes, variables } = runDocument(['m=2.5', 'v=12', 'E_{kin}=\\frac{1}{2}mv^2', 'E_{kin}/2'], en)
    expect(outcomes.map((o) => o.kind)).toEqual(['define', 'define', 'define', 'value'])
    expect(outcomes[2].result).toBe('=180')
    expect(outcomes[3].result).toBe('=90')
    expect(variables.map((v) => v.latex)).toEqual(['2.5', '12', '180'])
  })
})

describe('solve', () => {
  it('solves for x', () => {
    expect(run(['x^2-4=0'])[0]).toBe('\\;\\Rightarrow\\; x=2\\lor x=-2')
    expect(run(['2x+3=7'])[0]).toBe('\\;\\Rightarrow\\; x=2')
  })
  it('checks equalities without unknowns', () => {
    expect(run(['1+1=2'])[0]).toContain('true')
  })
})

describe('result stripping', () => {
  it('removes a computed result before re-running', () => {
    expect(inputOf('x^2-4=0\\class{lr-res}{\\quad\\Rightarrow\\quad x=2}')).toBe('x^2-4=0')
    expect(inputOf('x^2-4=0\\quad\\Rightarrow\\quad x=2\\lor x=-2')).toBe('x^2-4=0')
    expect(inputOf('\\sqrt{2}=\\sqrt{2}\\approx1.414')).toBe('\\sqrt{2}=\\sqrt{2}')
  })
  it('unwraps results for export', () => {
    expect(unwrapResult('1+1\\class{lr-res}{=2}', true)).toBe('1+1=2')
  })
  it('re-runs a pasted chain like E=½mv²=180', () => {
    expect(run(['m=2', 'v=3', 'E=\\frac12mv^2=9'])[2]).toBe('=9')
  })
})
