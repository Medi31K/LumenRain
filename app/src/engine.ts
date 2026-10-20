import { compile, ComputeEngine } from '@cortex-js/compute-engine'

export type ResultMode = 'auto' | 'exact' | 'decimal'
export type Lang = 'en' | 'da'

export interface EngineOptions {
  mode: ResultMode
  digits: number
  lang: Lang
}

export interface Outcome {
  kind: 'value' | 'solve' | 'define' | 'check' | 'error' | 'none'
  /** LaTeX to append after the input (already includes the leading operator). */
  result?: string
  /** Human-readable error message key. */
  error?: 'parse' | 'solve' | 'multi'
}

export interface Variable {
  name: string
  latex: string
}

/** A user-defined function, e.g. f(x) = x^2 + 1 (for graphs and later fields). */
export interface FunctionDef {
  name: string
  params: string[]
  /** MathJSON body, with earlier variables already substituted. */
  body: unknown
  latex: string
}

/** Class that marks the computed part of an equation field. */
export const RESULT_CLASS = 'lr-res'
const RESULT_OPEN = `\\class{${RESULT_CLASS}}{`

const TEXT = {
  en: { none: 'no solution', true: 'true', false: 'false' },
  da: { none: 'ingen løsning', true: 'sandt', false: 'falsk' },
}

/** Index just past the brace group that starts at `open` (which must be '{'). */
function skipGroup(s: string, open: number): number {
  let depth = 0
  for (let i = open; i < s.length; i++) {
    if (s[i] === '{') depth++
    else if (s[i] === '}' && --depth === 0) return i + 1
  }
  return s.length
}

/** Replace every `\class{lr-res}{X}` with `keep ? X : ''`. */
export function unwrapResult(latex: string, keep: boolean): string {
  let out = latex
  for (let i = out.indexOf(RESULT_OPEN); i >= 0; i = out.indexOf(RESULT_OPEN)) {
    const bodyStart = i + RESULT_OPEN.length - 1
    const end = skipGroup(out, bodyStart)
    const body = out.slice(bodyStart + 1, end - 1)
    out = out.slice(0, i) + (keep ? body : '') + out.slice(end)
  }
  return out.trim()
}

/** Cut a top-level `\Rightarrow` / `\approx` suffix (results pasted back in from Markdown). */
function cutTopLevel(latex: string, token: string): string {
  let depth = 0
  for (let i = 0; i < latex.length; i++) {
    const c = latex[i]
    if (c === '{') depth++
    else if (c === '}') depth--
    else if (depth === 0 && latex.startsWith(token, i) && !/[a-zA-Z]/.test(latex[i + token.length] ?? '')) {
      return latex.slice(0, i).replace(/\\quad\s*$|\\;\s*$|\\,\s*$/g, '').trim()
    }
  }
  return latex
}

/** Turn a field's current LaTeX into the user's input (strip any earlier answer). */
export function inputOf(latex: string): string {
  let s = unwrapResult(latex, false)
  s = cutTopLevel(s, '\\Rightarrow')
  s = cutTopLevel(s, '\\approx')
  return s
}

function normalize(latex: string): string {
  return latex
    .replace(/\{,\}/g, '.')
    .replace(/\\placeholder\{\}/g, '')
    .replace(/\\left|\\right/g, (m) => m) // keep delimiters; CE understands them
    // × is kept apart from · so that vector × vector can mean the cross product.
    .replace(/\\times/g, '\\otimes ')
    .trim()
}

export function formatNumber(n: number, opts: EngineOptions): string {
  if (!Number.isFinite(n)) return n > 0 ? '\\infty' : n < 0 ? '-\\infty' : '\\text{NaN}'
  let s: string
  if (Number.isInteger(n) && Math.abs(n) < 1e15) {
    s = String(n)
  } else {
    const p = Number(n.toPrecision(opts.digits))
    const abs = Math.abs(p)
    if (abs !== 0 && (abs >= 1e9 || abs < 1e-5)) {
      const [m, e] = p.toExponential(Math.max(0, opts.digits - 1)).split('e')
      const mant = String(Number(m))
      s = `${mant}\\cdot10^{${Number(e)}}`
    } else {
      s = String(p)
    }
  }
  s = s.replace(/^-/, '−').replace('−', '-')
  return opts.lang === 'da' ? s.replace(/\./g, '{,}') : s
}

type Boxed = NonNullable<ReturnType<ComputeEngine['parse']>>

/** Operands of a function expression (e.g. both sides of an Equal). */
const opsOf = (e: Boxed): Boxed[] | undefined => (e as unknown as { ops?: Boxed[] }).ops

function hasError(e: Boxed): boolean {
  return JSON.stringify(e.json).includes('"Error"')
}

/** A literal decimal/integer (not a fraction, radical or constant). */
function isPlainNumber(v: Boxed): boolean {
  const j = v.json as unknown
  return typeof j === 'number' || (typeof j === 'object' && j !== null && !Array.isArray(j) && 'num' in j)
}

// ---------- vectors & matrices ----------

type J = unknown

/** Rows of a Matrix / nested List as MathJSON entries, or null if it isn't one. */
function rowsOf(j: J): J[][] | null {
  if (!Array.isArray(j)) return null
  if (j[0] === 'Matrix') return rowsOf(j[1])
  if (j[0] !== 'List') return null
  const items = j.slice(1)
  if (items.length && items.every((r) => Array.isArray(r) && r[0] === 'List')) return items.map((r) => (r as J[]).slice(1))
  return [items]
}

/** Components of a vector (column, row or plain list), or null. */
function vectorOf(j: J): J[] | null {
  const rows = rowsOf(j)
  if (!rows) return null
  if (rows.length === 1) return rows[0]
  if (rows.every((r) => r.length === 1)) return rows.map((r) => r[0])
  return null
}

const column = (xs: J[]): J => ['Matrix', ['List', ...xs.map((x) => ['List', x])]]

/**
 * Rewrites vector products the engine doesn't do itself:
 * v × w (3D) → cross product, v · w → dot product. Everything else is untouched.
 */
function rewriteVectors(ce: ComputeEngine, j: J): J {
  if (!Array.isArray(j)) return j
  const args = j.slice(1).map((a) => rewriteVectors(ce, a))
  const head = j[0]
  const valueOf = (a: J) => ce.box(a as never).evaluate().json
  if (head === 'CircleTimes' && args.length === 2) {
    const [a, b] = args.map((x) => vectorOf(valueOf(x)))
    if (a && b && a.length === 3 && b.length === 3) {
      const m = (x: J, y: J) => ['Multiply', x, y]
      return column([
        ['Subtract', m(a[1], b[2]), m(a[2], b[1])],
        ['Subtract', m(a[2], b[0]), m(a[0], b[2])],
        ['Subtract', m(a[0], b[1]), m(a[1], b[0])],
      ])
    }
    return ['Multiply', ...args]
  }
  if (head === 'Multiply' && args.length === 2) {
    const [a, b] = args.map((x) => vectorOf(valueOf(x)))
    if (a && b && a.length === b.length && a.length > 1) return ['Add', ...a.map((x, i) => ['Multiply', x, b[i]])]
  }
  return [head, ...args]
}

function entryLatex(ce: ComputeEngine, x: J, opts: EngineOptions): string {
  const b = ce.box(x as never)
  const re = b.N().re
  if (isPlainNumber(b) && typeof re === 'number') return formatNumber(re, opts)
  return b.latex
}

/** pmatrix for matrices/vectors, {a, b} for plain lists (e.g. eigenvalues); null otherwise. */
function collectionLatex(ce: ComputeEngine, v: Boxed, opts: EngineOptions): string | null {
  const j = v.json as J
  if (!Array.isArray(j) || (j[0] !== 'Matrix' && j[0] !== 'List')) return null
  const rows = rowsOf(j)
  if (!rows) return null
  const isMatrix = j[0] === 'Matrix' || (j as J[]).slice(1).every((r) => Array.isArray(r) && r[0] === 'List')
  if (!isMatrix) return `\\left\\{${rows[0].map((x) => entryLatex(ce, x, opts)).join(',\\ ')}\\right\\}`
  return `\\begin{pmatrix}${rows.map((r) => r.map((x) => entryLatex(ce, x, opts)).join('&')).join('\\\\')}\\end{pmatrix}`
}

/** Formats an evaluated value as "exact", "≈ decimal" or both, per mode. */
function formatValue(v: Boxed, opts: EngineOptions, lead = '='): string {
  const collection = collectionLatex(v.engine as ComputeEngine, v, opts)
  if (collection) return `${lead}${collection}`
  const approx = v.N()
  const re = approx.re
  const im = approx.im
  const numeric = typeof re === 'number' && !Number.isNaN(re) && (im === 0 || im === undefined || Number.isNaN(im))
  const exactIsPlainNumber = isPlainNumber(v)

  if (exactIsPlainNumber && numeric) return `${lead}${formatNumber(re, opts)}`
  if (!numeric) return `${lead}${v.latex}`
  const exact = v.latex
  const dec = formatNumber(re, opts)
  if (opts.mode === 'exact') return `${lead}${exact}`
  if (opts.mode === 'decimal') return `\\approx${dec}`
  return `${lead}${exact}\\approx${dec}`
}

function formatSolution(s: Boxed, opts: EngineOptions): string {
  const approx = s.N()
  const re = approx.re
  const realNum = typeof re === 'number' && (approx.im === 0 || Number.isNaN(approx.im))
  if (realNum && isPlainNumber(s)) return formatNumber(re, opts)
  if (realNum && opts.mode === 'decimal') return formatNumber(re, opts)
  return s.latex
}

/**
 * Evaluates every equation field in document order. Definitions such as
 * `m = 2.5` become variables that later fields can use.
 */
export function runDocument(
  inputs: string[],
  opts: EngineOptions,
): { outcomes: Outcome[]; variables: Variable[]; functions: FunctionDef[]; engine: ComputeEngine } {
  const ce = new ComputeEngine()
  const defined = new Set<string>()
  const variables: Variable[] = []
  const functions: FunctionDef[] = []
  const outcomes = inputs.map((raw) => {
    try {
      return runOne(ce, normalize(raw), opts, defined, variables, functions)
    } catch {
      return { kind: 'error', error: 'parse' } as Outcome
    }
  })
  return { outcomes, variables, functions, engine: ce }
}

function unknownsOf(e: Boxed, defined: Set<string>): string[] {
  return e.unknowns.filter((u: string) => !defined.has(u))
}

function runOne(
  ce: ComputeEngine,
  src: string,
  opts: EngineOptions,
  defined: Set<string>,
  variables: Variable[],
  functions: FunctionDef[],
): Outcome {
  if (!src) return { kind: 'none' }
  let e: Boxed = ce.parse(src)
  if (hasError(e)) {
    // Pure notation the engine doesn't compute (∇, bra-ket, vector arrows): not an error.
    if (/\\(nabla|langle|rangle|vec|hat|dot|ddot|oint|iint|iiint|hbar|dagger|propto|forall|exists)\b/.test(src)) return { kind: 'none' }
    return { kind: 'error', error: 'parse' }
  }

  // a = b = 180 (an older answer typed or pasted back): drop the trailing number.
  const chain = opsOf(e)
  if (e.operator === 'Equal' && chain && chain.length > 2) {
    const ops = chain
    const last = ops[ops.length - 1]
    if (unknownsOf(last, defined).length === 0) e = ce.box(['Equal', ...ops.slice(0, -1).map((o) => o.json)] as never)
  }

  const sides = opsOf(e)
  if (e.operator === 'Equal' && sides && sides.length === 2) {
    const [lhs, rhs] = sides
    // Function definition: f(x) = …, g(x, t) = …
    const lj = lhs.json as J
    if (Array.isArray(lj) && typeof lj[0] === 'string' && /^[a-zA-Z](_\w+)?$/.test(lj[0]) && lj.length > 1 && lj.slice(1).every((a) => typeof a === 'string')) {
      const name = lj[0]
      const params = lj.slice(1) as string[]
      const body = ce.box(rewriteVectors(ce, rhs.json) as never).evaluate().json
      ce.assign(name, ce.box(['Function', body, ...params] as never))
      defined.add(name)
      functions.push({ name, params, body, latex: ce.box(body as never).latex })
      variables.push({ name: lhs.latex, latex: ce.box(body as never).latex })
      return { kind: 'define' }
    }
    const name = lhs.operator === 'Symbol' ? (lhs.json as string) : undefined
    // Definition: single symbol on the left, everything on the right known.
    if (name && unknownsOf(rhs, defined).filter((u) => u !== name).length === 0 && !unknownsOf(rhs, defined).includes(name)) {
      const value = ce.box(rewriteVectors(ce, rhs.json) as never).evaluate()
      ce.assign(name, value)
      defined.add(name)
      const shown = isPlainNumber(rhs) || collectionLatex(ce, rhs, opts) === collectionLatex(ce, value, opts) && collectionLatex(ce, rhs, opts) ? '' : formatValue(value, opts)
      variables.push({ name: lhs.latex, latex: formatValue(value, opts, '').replace(/^\\approx/, '') })
      return shown ? { kind: 'define', result: shown } : { kind: 'define' }
    }

    const unknowns = unknownsOf(e, defined)
    if (unknowns.length === 0) {
      const diff = ce.box(['Subtract', lhs.json, rhs.json] as never).N().re
      const ok = typeof diff === 'number' && Math.abs(diff) < 1e-9
      return { kind: 'check', result: `\\quad\\text{${TEXT[opts.lang][ok ? 'true' : 'false']}}` }
    }
    const target = unknowns.includes('x') ? 'x' : unknowns[0]
    const sols = e.solve([target]) as Boxed[] | undefined
    if (!sols) return { kind: 'error', error: 'solve' }
    const t = ce.parse(target === 'x' ? 'x' : target).latex
    const body = sols.length === 0
      ? `\\text{${TEXT[opts.lang].none}}`
      : sols.map((s) => `${t}=${formatSolution(s, opts)}`).join('\\lor ')
    return { kind: 'solve', result: `\\;\\Rightarrow\\; ${body}` }
  }

  e = ce.box(rewriteVectors(ce, e.json) as never)
  if (unknownsOf(e, defined).length > 0) {
    // Symbolic: evaluate (runs d/dx, ∂, ∫, lim, Σ and substitutes known variables), then tidy up.
    let s = e.evaluate()
    if (JSON.stringify(s.json).includes('"Error"')) s = e.simplify()
    else s = s.simplify()
    if (s.latex === e.latex) return { kind: 'none' }
    return { kind: 'value', result: formatValue(s, opts) }
  }
  return { kind: 'value', result: formatValue(e.evaluate(), opts) }
}

/**
 * Turns a curve ("f(x)", "x^2-2", "y=a\\sin(x)", "f") into a numeric function of x,
 * using the variables and functions defined in the note. Null if it can't be plotted.
 */
export function curveFunction(ce: ComputeEngine, latex: string): ((x: number) => number) | null {
  let src = normalize(inputOf(latex))
  if (!src) return null
  if (/^[a-zA-Z]$/.test(src)) src = `${src}(x)`
  let e: Boxed = ce.parse(src)
  if (hasError(e)) return null
  const sides = opsOf(e)
  if (e.operator === 'Equal' && sides?.length === 2) e = sides[1]
  e = e.evaluate()
  if (e.unknowns.some((u: string) => u !== 'x')) return null
  try {
    const c = compile(e as never) as unknown as { success?: boolean; run?: (vars: Record<string, number>) => unknown }
    if (!c.success || !c.run) return null
    const run = c.run
    return (x: number) => {
      const y = run({ x })
      return typeof y === 'number' ? y : NaN
    }
  } catch {
    return null
  }
}
