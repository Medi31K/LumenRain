// Word-style document: a contenteditable page with MathLive equation fields
// embedded inline. Equations alone on a line are "display" equations.

import { MathfieldElement } from 'mathlive'
import { inputOf, RESULT_CLASS, runDocument, type EngineOptions, type Outcome, type Variable } from './engine'
import { isDisplay, type Block, type Inline } from './markdown'

MathfieldElement.soundsDirectory = null
MathfieldElement.fontsDirectory = null

const SHORTCUTS: Record<string, string> = {
  // Word-style: "sqrt(" opens a root; ")" closes it again (see buildUp below).
  'sqrt(': '\\sqrt{#?}',
  'root(': '\\sqrt[#?]{#?}',
  '*': '\\cdot',
  cdot: '\\cdot',
  oo: '\\infty',
  '<=': '\\le',
  '>=': '\\ge',
  '!=': '\\ne',
  '+-': '\\pm',
  deg: '^{\\circ}',
}

// ---------- Word "build-up" rules ----------
// MathLive keeps the caret inside a denominator/exponent until you press →.
// Word ends them when you type an operator or a space, and ")" closes a root.

interface Atom {
  type: string
  parent?: Atom
  parentBranch?: string
  isLastSibling: boolean
}

function caretAtom(mf: MathfieldElement): Atom | null {
  const model = (mf as unknown as { _mathfield?: { model?: { position: number; at(p: number): Atom } } })._mathfield?.model
  return model ? model.at(model.position) : null
}

const ENDS_ON_OPERATOR = (a: Atom) =>
  (a.parent?.type === 'genfrac' && a.parentBranch === 'below') || a.parentBranch === 'superscript' || a.parentBranch === 'subscript'

/** Returns true if the key was fully handled. */
function buildUp(mf: MathfieldElement, key: string): boolean {
  let a = caretAtom(mf)
  if (!a || !a.isLastSibling || a.type === 'first' || a.type === 'placeholder') return false
  if ('+-=<>,'.includes(key) || key === ' ') {
    let moved = false
    while (a && a.isLastSibling && a.type !== 'first' && ENDS_ON_OPERATOR(a)) {
      mf.executeCommand('moveAfterParent')
      moved = true
      a = caretAtom(mf)
    }
    return key === ' ' && moved
  }
  if (key === ')' && a.parent?.type === 'surd' && a.parentBranch === 'body') {
    mf.executeCommand('moveAfterParent')
    return true
  }
  return false
}

/** Removes a shown answer so typing edits the input, keeping the caret where it was. */
function hideResult(mf: MathfieldElement) {
  if (!mf.value.includes(RESULT_CLASS)) return
  const pos = mf.position
  mf.value = inputOf(mf.value)
  mf.position = Math.min(pos, mf.lastOffset)
}

const SHADOW_STYLE = `
  .${RESULT_CLASS} { color: var(--lr-text-result); }
  :host(.has-error) .ML__content { text-decoration: underline wavy var(--lr-text-error); text-underline-offset: 6px; }
`

export interface EditorHooks {
  onChange(): void
  onVariables(vars: Variable[]): void
  onTyping(): void
  errorText(o: Outcome): string
}

export class DocEditor {
  root: HTMLElement
  private hooks: EditorHooks
  private opts: EngineOptions
  lastField: MathfieldElement | null = null

  constructor(root: HTMLElement, hooks: EditorHooks, opts: EngineOptions) {
    this.root = root
    this.hooks = hooks
    this.opts = opts
    MathfieldElement.decimalSeparator = opts.lang === 'da' ? ',' : '.'
    root.contentEditable = 'true'
    root.spellcheck = false
    document.execCommand('defaultParagraphSeparator', false, 'p')
    root.addEventListener('keydown', this.onRootKey)
    root.addEventListener('input', this.onRootInput)
  }

  destroy() {
    this.root.removeEventListener('keydown', this.onRootKey)
    this.root.removeEventListener('input', this.onRootInput)
  }

  setOptions(opts: EngineOptions) {
    const langChanged = opts.lang !== this.opts.lang
    this.opts = opts
    MathfieldElement.decimalSeparator = opts.lang === 'da' ? ',' : '.'
    if (langChanged) {
      // Danish uses a decimal comma: 2.5 ⇄ 2{,}5 in every field.
      for (const mf of Array.from(this.root.querySelectorAll('math-field')) as MathfieldElement[]) {
        const v = opts.lang === 'da' ? mf.value.replace(/(\d)\.(\d)/g, '$1{,}$2') : mf.value.replace(/(\d)\{,\}(\d)/g, '$1.$2')
        if (v !== mf.value) {
          mf.value = v
          if (mf.dataset.out) mf.dataset.out = v
        }
      }
    }
    this.recompute(false)
  }

  // ---------- model <-> DOM ----------

  load(blocks: Block[]) {
    this.root.replaceChildren(
      ...blocks.map((b) => {
        const el = document.createElement(b.type)
        for (const i of b.inlines) el.append(i.t === 'text' ? document.createTextNode(i.s) : this.makeEquation(i.latex))
        if (!el.childNodes.length) el.append(document.createElement('br'))
        return el
      }),
    )
    if (!this.root.childNodes.length) this.root.append(this.emptyParagraph())
    this.refreshDisplayClasses()
    this.recompute(false)
  }

  save(): Block[] {
    const blocks: Block[] = []
    for (const node of Array.from(this.root.children)) {
      const tag = node.tagName.toLowerCase()
      const type = tag === 'h1' || tag === 'h2' ? tag : 'p'
      const inlines: Inline[] = []
      const walk = (n: Node) => {
        if (n.nodeType === Node.TEXT_NODE) {
          const s = (n.textContent ?? '').replace(/\u200B/g, '')
          const last = inlines[inlines.length - 1]
          if (last && last.t === 'text') last.s += s
          else if (s) inlines.push({ t: 'text', s })
        } else if (n instanceof HTMLElement && n.classList.contains('eq')) {
          const mf = n.querySelector('math-field') as MathfieldElement | null
          if (mf) inlines.push({ t: 'eq', latex: mf.value })
        } else if (n instanceof HTMLElement && n.tagName !== 'BR') {
          n.childNodes.forEach(walk)
        }
      }
      node.childNodes.forEach(walk)
      blocks.push({ type, inlines })
    }
    return blocks
  }

  private emptyParagraph() {
    const p = document.createElement('p')
    p.append(document.createElement('br'))
    return p
  }

  private makeEquation(latex = ''): HTMLElement {
    const wrap = document.createElement('span')
    wrap.className = 'eq'
    wrap.contentEditable = 'false'
    const mf = new MathfieldElement()
    mf.mathVirtualKeyboardPolicy = 'manual'
    mf.smartFence = true
    mf.smartSuperscript = false // Word: an exponent ends at an operator or space
    mf.value = latex
    if (latex.includes(RESULT_CLASS)) mf.dataset.calc = '1'
    mf.addEventListener('mount', () => {
      const shortcuts = { ...mf.inlineShortcuts, ...SHORTCUTS }
      delete shortcuts.sqrt // so that "sqrt(" can match
      mf.inlineShortcuts = shortcuts
      mf.menuItems = []
      const style = document.createElement('style')
      style.textContent = SHADOW_STYLE
      mf.shadowRoot?.append(style)
    })
    mf.addEventListener('keydown', (e) => this.onFieldKey(e, mf, wrap), { capture: true })
    mf.addEventListener('move-out', (e) => {
      e.preventDefault()
      this.exitField(wrap, (e as CustomEvent).detail.direction === 'backward' ? 'before' : 'after')
    })
    mf.addEventListener('focusin', () => {
      this.lastField = mf
      wrap.classList.add('focused')
      // Edit the input only; the answer comes back on Enter or when leaving.
      hideResult(mf)
    })
    mf.addEventListener('focusout', () => {
      wrap.classList.remove('focused')
      if (mf.dataset.calc && mf.value !== mf.dataset.out) this.recompute()
    })
    mf.addEventListener('input', () => {
      this.hooks.onTyping()
      this.hooks.onChange()
    })
    // The surrounding contenteditable swallows clicks; hand focus to the field.
    wrap.addEventListener('pointerup', () => {
      if (document.activeElement !== mf) mf.focus()
    })
    wrap.append(mf)
    return wrap
  }

  // ---------- equations ----------

  /** Inserts a new equation at the caret (Word: Alt+=). */
  insertEquation(latex = ''): MathfieldElement {
    const sel = window.getSelection()
    let range = sel && sel.rangeCount ? sel.getRangeAt(0) : null
    if (!range || !this.root.contains(range.startContainer)) {
      const p = this.emptyParagraph()
      this.root.append(p)
      range = document.createRange()
      range.setStart(p, 0)
    }
    range.deleteContents()
    const block = this.blockOf(range.startContainer)
    // An empty paragraph keeps a <br> placeholder; drop it so the equation sits alone.
    if (block && block.textContent === '' && !block.querySelector('.eq')) block.replaceChildren()
    const eq = this.makeEquation(latex)
    range.insertNode(eq)
    this.refreshDisplayClasses()
    const mf = eq.querySelector('math-field') as MathfieldElement
    requestAnimationFrame(() => mf.focus())
    this.hooks.onChange()
    return mf
  }

  /** Inserts LaTeX into the focused/last field, or a new equation. */
  insertIntoField(latex: string) {
    const mf = this.lastField && this.root.contains(this.lastField) ? this.lastField : this.insertEquation()
    requestAnimationFrame(() => {
      mf.focus()
      mf.executeCommand(['insert', latex, { selectionMode: 'placeholder' }])
    })
  }

  recompute(notify = true) {
    const fields = Array.from(this.root.querySelectorAll('math-field')) as MathfieldElement[]
    const inputs = fields.map((mf) => inputOf(mf.value))
    const { outcomes, variables } = runDocument(inputs, this.opts)
    fields.forEach((mf, i) => {
      // Only fields that have been calculated once (or came with a result) show answers.
      if (!mf.dataset.calc) return
      const o = outcomes[i]
      const value = o.result ? `${inputs[i]}\\class{${RESULT_CLASS}}{${o.result}}` : inputs[i]
      if (mf.value !== value) mf.value = value
      mf.dataset.out = value
      mf.classList.toggle('has-error', o.kind === 'error')
      mf.title = o.kind === 'error' ? this.hooks.errorText(o) : ''
    })
    this.hooks.onVariables(variables)
    if (notify) this.hooks.onChange()
  }

  /** Marks every field as calculated (used after importing a document). */
  calculateAll() {
    this.root.querySelectorAll('math-field').forEach((mf) => ((mf as MathfieldElement).dataset.calc = '1'))
    this.recompute()
  }

  private onFieldKey(e: KeyboardEvent, mf: MathfieldElement, wrap: HTMLElement) {
    if ((e.key.length === 1 || e.key === 'Backspace' || e.key === 'Delete') && !e.ctrlKey && !e.metaKey) hideResult(mf)
    if (!e.ctrlKey && !e.metaKey && !e.altKey && (buildUp(mf, e.key) || e.key === ' ')) {
      // Space only builds up (like Word); it never inserts anything itself.
      e.preventDefault()
      e.stopPropagation()
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      e.stopPropagation()
      if (mf.dataset.calc && mf.value === mf.dataset.out) {
        // Second Enter: leave the field, like pressing Enter after a Word equation.
        this.exitField(wrap, 'newline')
      } else {
        mf.dataset.calc = '1'
        this.recompute()
        mf.position = mf.lastOffset
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      this.exitField(wrap, 'after')
    } else if (e.key === 'Backspace' && mf.value === '') {
      e.preventDefault()
      this.exitField(wrap, 'before')
      wrap.remove()
      this.refreshDisplayClasses()
      this.recompute()
    }
  }

  private exitField(wrap: HTMLElement, where: 'before' | 'after' | 'newline') {
    const block = this.blockOf(wrap)
    const sel = window.getSelection()!
    const range = document.createRange()
    if (where === 'newline' && block) {
      const p = this.emptyParagraph()
      block.after(p)
      range.setStart(p, 0)
    } else {
      // Keep a text node next to the equation so the caret has somewhere to go.
      const sib = where === 'after' ? wrap.nextSibling : wrap.previousSibling
      let text: Text
      if (sib && sib.nodeType === Node.TEXT_NODE) text = sib as Text
      else {
        text = document.createTextNode('​')
        if (where === 'after') wrap.after(text)
        else wrap.before(text)
      }
      range.setStart(text, where === 'after' ? Math.min(1, text.length) : text.length)
    }
    range.collapse(true)
    this.root.focus()
    sel.removeAllRanges()
    sel.addRange(range)
  }

  // ---------- page ----------

  private blockOf(n: Node | null): HTMLElement | null {
    while (n && n.parentNode !== this.root) n = n.parentNode
    return n as HTMLElement | null
  }

  private onRootKey = (e: KeyboardEvent) => {
    const inField = (e.target as HTMLElement).closest?.('.eq')
    if (e.altKey && (e.key === 'm' || e.key === 'M' || e.key === 'µ' || e.key === '=')) {
      e.preventDefault()
      this.insertEquation()
      return
    }
    // Arrow into an adjacent equation.
    if (!inField && (e.key === 'ArrowRight' || e.key === 'ArrowLeft') && !e.shiftKey) {
      const sel = window.getSelection()
      if (!sel || !sel.isCollapsed) return
      const { focusNode, focusOffset } = sel
      if (!focusNode) return
      const forward = e.key === 'ArrowRight'
      let neighbour: Node | null = null
      if (focusNode.nodeType === Node.TEXT_NODE) {
        const t = focusNode.textContent ?? ''
        const atEdge = forward ? t.slice(focusOffset).replace(/​/g, '') === '' : t.slice(0, focusOffset).replace(/​/g, '') === ''
        if (atEdge) neighbour = forward ? focusNode.nextSibling : focusNode.previousSibling
      } else {
        neighbour = focusNode.childNodes[forward ? focusOffset : focusOffset - 1] ?? null
      }
      if (neighbour instanceof HTMLElement && neighbour.classList.contains('eq')) {
        e.preventDefault()
        const mf = neighbour.querySelector('math-field') as MathfieldElement
        mf.focus()
        mf.position = forward ? 0 : mf.lastOffset
      }
    }
  }

  private onRootInput = () => {
    this.hooks.onTyping()
    // Markdown-style headings: "# " and "## " at the start of a paragraph.
    const sel = window.getSelection()
    const block = sel?.focusNode ? this.blockOf(sel.focusNode) : null
    if (block && block.tagName === 'P') {
      const m = (block.textContent ?? '').match(/^(#{1,2})[\s ]/)
      if (m && block.firstChild?.nodeType === Node.TEXT_NODE) {
        const h = document.createElement(m[1].length === 1 ? 'h1' : 'h2')
        const first = block.firstChild as Text
        first.textContent = (first.textContent ?? '').slice(m[0].length)
        h.append(...Array.from(block.childNodes))
        if (!h.textContent) h.append(document.createElement('br'))
        block.replaceWith(h)
        const r = document.createRange()
        r.setStart(h, 0)
        sel!.removeAllRanges()
        sel!.addRange(r)
      }
    }
    if (!this.root.firstElementChild) this.root.append(this.emptyParagraph())
    this.refreshDisplayClasses()
    this.hooks.onChange()
  }

  refreshDisplayClasses() {
    for (const el of Array.from(this.root.children)) {
      const inlines: Inline[] = []
      el.childNodes.forEach((n) => {
        if (n instanceof HTMLElement && n.classList.contains('eq')) inlines.push({ t: 'eq', latex: '' })
        else inlines.push({ t: 'text', s: (n.textContent ?? '').replace(/​/g, '') })
      })
      el.classList.toggle('display', isDisplay({ type: 'p', inlines }) && el.tagName === 'P')
    }
  }
}
