// Math operators for engineering physics: typed shortcuts (Word/WordMat style)
// and the symbol palette. One table so the palette can show each shortcut.

export interface Operator {
  /** LaTeX inserted; #? = placeholder, #@ = current selection. */
  latex: string
  /** Text you type in an equation to get it (optional). */
  typed?: string
  /** LaTeX used for the palette preview, if different. */
  preview?: string
  /** MathLive already knows this shortcut; don't register it again. */
  native?: boolean
}

export interface OperatorGroup {
  id: 'calculus' | 'vectors' | 'algebra' | 'relations' | 'greek'
  items: Operator[]
}


export const OPERATOR_GROUPS: OperatorGroup[] = [
  {
    id: 'calculus',
    items: [
      { typed: 'ddx', latex: '\\frac{d}{dx}' },
      { typed: 'ddt', latex: '\\frac{d}{dt}' },
      { typed: 'deriv', latex: '\\frac{d#?}{d#?}' },
      { typed: 'nderiv', latex: '\\frac{d^{#?}#?}{d#?^{#?}}' },
      { typed: 'pdx', latex: '\\frac{\\partial}{\\partial x}' },
      { typed: 'pdt', latex: '\\frac{\\partial}{\\partial t}' },
      { typed: 'pderiv', latex: '\\frac{\\partial #?}{\\partial #?}' },
      { typed: 'npderiv', latex: '\\frac{\\partial^{#?}#?}{\\partial #?^{#?}}' },
      { typed: 'partial', latex: '\\partial', native: true },
      { typed: 'int', latex: '\\int #?\\,d#?' },
      { typed: 'dint', latex: '\\int_{#?}^{#?}#?\\,d#?' },
      { typed: 'aint', latex: '\\iint_{#?}#?\\,dA' },
      { typed: 'vint', latex: '\\iiint_{#?}#?\\,dV' },
      { typed: 'oint', latex: '\\oint_{#?}#?\\,d#?' },
      { typed: 'lim', latex: '\\lim_{#?\\to#?}' },
      { typed: 'sum', latex: '\\sum_{#?}^{#?}' },
      { typed: 'prod', latex: '\\prod_{#?}^{#?}' },
      { typed: 'tdot', latex: '\\dot{#?}' },
      { typed: 'tddot', latex: '\\ddot{#?}' },
      { typed: "'", latex: '^{\\prime}', native: true },
    ],
  },
  {
    id: 'vectors',
    items: [
      { typed: 'vec', latex: '\\vec{#?}' },
      { typed: 'hat', latex: '\\hat{#?}' },
      { typed: 'nabla', latex: '\\nabla', native: true },
      { typed: 'grad', latex: '\\nabla #?' },
      { typed: 'div', latex: '\\nabla\\cdot #?' },
      { typed: 'curl', latex: '\\nabla\\times #?' },
      { typed: 'lap', latex: '\\nabla^2 #?' },
      { typed: 'xx', latex: '\\times', native: true },
      { typed: 'abs', latex: '\\left|#?\\right|' },
      { typed: 'norm', latex: '\\left\\|#?\\right\\|' },
      { typed: 'mat', latex: '\\begin{pmatrix}#?&#?\\\\#?&#?\\end{pmatrix}' },
      { typed: 'colv', latex: '\\begin{pmatrix}#?\\\\#?\\\\#?\\end{pmatrix}' },
      { typed: 'det', latex: '\\det' },
      { typed: 'bra', latex: '\\langle #?|' },
      { typed: 'ket', latex: '|#?\\rangle' },
      { typed: 'bk', latex: '\\langle #?|#?\\rangle' },
      { typed: 'hbar', latex: '\\hbar', native: true },
      { typed: 'dagger', latex: '^{\\dagger}' },
    ],
  },
  {
    id: 'algebra',
    items: [
      { typed: '/', latex: '\\frac{#@}{#?}' },
      { typed: 'sqrt(', latex: '\\sqrt{#?}' },
      { typed: 'root(', latex: '\\sqrt[#?]{#?}' },
      { typed: '^', latex: '#@^{#?}' },
      { typed: '_', latex: '#@_{#?}' },
      { typed: 'binom', latex: '\\binom{#?}{#?}' },
      { typed: 'ln', latex: '\\ln', native: true },
      { typed: 'log', latex: '\\log', native: true },
      { typed: 'exp', latex: '\\exp', native: true },
      { typed: 'sin', latex: '\\sin', native: true },
      { typed: 'cos', latex: '\\cos', native: true },
      { typed: 'tan', latex: '\\tan', native: true },
      { typed: 'arcsin', latex: '\\arcsin', native: true },
      { typed: 'sinh', latex: '\\sinh', native: true },
      { typed: 'cosh', latex: '\\cosh', native: true },
      { typed: '+-', latex: '\\pm', native: true },
      { typed: 'oo', latex: '\\infty', native: true },
      { typed: 'deg', latex: '^{\\circ}' },
    ],
  },
  {
    id: 'relations',
    items: [
      { typed: '<=', latex: '\\le', native: true },
      { typed: '>=', latex: '\\ge', native: true },
      { typed: '!=', latex: '\\ne', native: true },
      { typed: '~~', latex: '\\approx', native: true },
      { typed: 'prop', latex: '\\propto' },
      { typed: '==', latex: '\\equiv' },
      { typed: '->', latex: '\\to', native: true },
      { typed: '=>', latex: '\\Rightarrow', native: true },
      { typed: '<=>', latex: '\\Leftrightarrow', native: true },
      { typed: 'elem', latex: '\\in' },
      { typed: 'AA', latex: '\\forall', native: true },
      { typed: 'EE', latex: '\\exists', native: true },
    ],
  },
  {
    id: 'greek',
    items: ['alpha', 'beta', 'gamma', 'delta', 'Delta', 'epsilon', 'varepsilon', 'eta', 'theta', 'kappa', 'lambda', 'mu', 'nu', 'xi', 'pi', 'rho',
      'sigma', 'tau', 'phi', 'varphi', 'chi', 'psi', 'Psi', 'omega', 'Omega', 'Gamma', 'Phi', 'Sigma'].map((n) => ({ typed: n, latex: `\\${n}`, native: true })),
  },
]

/**
 * Typed shortcuts handed to MathLive (single keys and MathLive's own are left alone).
 * MathLive fires a shortcut as soon as it's complete, so no name may be a prefix of another.
 */
export const TYPED_SHORTCUTS: Record<string, string> = Object.fromEntries(
  OPERATOR_GROUPS.flatMap((g) => g.items)
    .filter((o) => o.typed && !o.native && o.typed.length > 1 && !o.latex.includes('#@'))
    .map((o) => [o.typed!, o.latex]),
)
