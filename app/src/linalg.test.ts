import { describe, expect, it } from 'vitest'
import { runDocument, type EngineOptions } from './engine'

const en: EngineOptions = { mode: 'auto', digits: 6, lang: 'en' }
const run = (xs: string[]) => runDocument(xs, en).outcomes.map((r) => r.result ?? r.kind)
const v = (...xs: number[]) => `\\begin{pmatrix}${xs.join('\\\\')}\\end{pmatrix}`

describe('functions', () => {
  it('defines and uses f(x)', () => {
    expect(run(['f(x)=x^2+1', 'f(3)', "f'(x)", "f'(2)", '\\int_0^1 f(x)\\,dx'])).toEqual(['define', '=10', '=2x', '=4', '=\\frac{4}{3}\\approx1.33333'])
  })
  it('uses earlier variables inside functions', () => {
    const { functions, outcomes } = runDocument(['a=3', 'g(t)=a\\sin(t)', 'g(0)'], en)
    expect(outcomes[2].result).toBe('=0')
    expect(functions[0]).toMatchObject({ name: 'g', params: ['t'] })
  })
  it('functions of two variables', () => {
    expect(run(['h(x,y)=x^2+y', 'h(2,3)'])[1]).toBe('=7')
  })
})

describe('vectors & matrices', () => {
  it('cross and dot products', () => {
    expect(run([`${v(1, 0, 0)}\\times${v(0, 1, 0)}`])[0]).toBe(`=${v(0, 0, 1)}`)
    expect(run([`${v(1, 2, 3)}\\cdot${v(4, 5, 6)}`])[0]).toBe('=32')
  })
  it('vector variables, sums, scaling and norms', () => {
    expect(run([`a=${v(1, 2, 2)}`, 'b=' + v(1, 0, 0), 'a+2b', '\\left\\|a\\right\\|', 'a\\times b'])).toEqual([
      'define',
      'define',
      `=${v(3, 2, 2)}`,
      '=3',
      `=${v(0, 2, -2)}`,
    ])
  })
  it('matrix inverse, transpose, eigenvalues, determinant', () => {
    const A = '\\begin{pmatrix}2&1\\\\1&2\\end{pmatrix}'
    const out = run([`A=${A}`, 'A^{-1}', 'A^{T}', '\\det(A)'])
    expect(out[1]).toBe('=\\begin{pmatrix}\\frac{2}{3}&-\\frac{1}{3}\\\\-\\frac{1}{3}&\\frac{2}{3}\\end{pmatrix}')
    expect(out[2]).toBe(`=${A}`)
    expect(out[3]).toBe('=3')
  })
  it('scientific × still multiplies numbers', () => {
    expect(run(['2\\times3'])).toEqual(['=6'])
  })
})
