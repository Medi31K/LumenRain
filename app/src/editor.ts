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

/** Offset where the user's input ends; anything after it is the read-only answer. */
function inputEnd(mf: MathfieldElement): number {
  const tail = mf.value.includes(RESULT_CLASS) ? Number(mf.dataset.tail ?? 0) : 0
  return mf.lastOffset - tail
}

/** Screen position of the caret inside a math field. */
function fieldCaretRect(mf: MathfieldElement): DOMRect {
  const caret = mf.shadowRoot?.querySelector('.ML__caret, .ML__text-caret, .ML__latex-caret') as HTMLElement | null
  return caret?.getBoundingClientRect() ?? mf.getBoundingClientRect()
}

function setDecimalSeparator(lang: string) {
  const sep = lang === 'da' ? ',' : '.'
  if (MathfieldElement.decimalSeparator !== sep) MathfieldElement.decimalSeparator = sep
}

const SHADOW_STYLE = `
  .${RESULT_CLASS} { color: var(--lr-text-result); transition: opacity .15s; }
  :host(.stale) .${RESULT_CLASS} { opacity: .35; }
  :host(.has-error) .ML__content { text-decoration: underline wavy var(--lr-text-error); text-underline-offset: 6px; }
`

function blockType(el: HTMLElement): Block['type'] {
  const tag = el.tagName.toLowerCase()
  if (tag === 'hr') return 'hr'
  if (el.classList.contains('li')) return 'li'
  return tag === 'h1' || tag === 'h2' || tag === 'h3' ? tag : 'p'
}

/** Visible text of a block (ignores caret anchors). */
const blockText = (el: Element) => (el.textContent ?? '').replace(/\u200B/g, '')

/** True when the collapsed caret sits at the very start of `block`. */
function caretAtBlockStart(block: HTMLElement): boolean {
  const sel = window.getSelection()
  if (!sel || !sel.isCollapsed || !sel.rangeCount) return false
  const r = document.createRange()
  r.setStart(block, 0)
  r.setEnd(sel.focusNode!, sel.focusOffset)
  return r.toString().replace(/\u200B/g, '') === '' && !r.cloneContents().querySelector?.('.eq')
}

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
  /** Horizontal "goal column" kept across consecutive ↑/↓, like Word. */
  private goalX: number | null = null

  constructor(root: HTMLElement, hooks: EditorHooks, opts: EngineOptions) {
    this.root = root
    this.hooks = hooks
    this.opts = opts
    setDecimalSeparator(opts.lang)
    root.contentEditable = 'true'
    root.spellcheck = false
    document.execCommand('defaultParagraphSeparator', false, 'p')
    root.addEventListener('keydown', this.onRootKey)
    root.addEventListener('input', this.onRootInput)
    root.addEventListener('pointerdown', this.resetGoal)
  }

  private resetGoal = () => {
    this.goalX = null
  }

  destroy() {
    this.root.removeEventListener('keydown', this.onRootKey)
    this.root.removeEventListener('input', this.onRootInput)
    this.root.removeEventListener('pointerdown', this.resetGoal)
  }

  setOptions(opts: EngineOptions) {
    const langChanged = opts.lang !== this.opts.lang
    this.opts = opts
    setDecimalSeparator(opts.lang)
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
        const el = this.makeBlock(b.type)
        if (b.tight !== undefined) el.dataset.tight = b.tight ? '1' : '0'
        if (b.type === 'hr') return el
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
    for (const node of Array.from(this.root.children) as HTMLElement[]) {
      const type = blockType(node)
      const tight = node.dataset.tight === undefined ? undefined : node.dataset.tight === '1'
      if (type === 'hr') {
        blocks.push({ type, inlines: [], tight })
        continue
      }
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
      blocks.push({ type, inlines, tight })
    }
    return blocks
  }

  private makeBlock(type: Block['type']): HTMLElement {
    if (type === 'li') {
      const el = document.createElement('div')
      el.className = 'li'
      return el
    }
    if (type === 'hr') {
      const hr = document.createElement('hr')
      hr.contentEditable = 'false'
      return hr
    }
    return document.createElement(type)
  }

  /** Replaces a block element with one of another type, keeping its content and the caret. */
  private convertBlock(block: HTMLElement, type: Block['type'], stripPrefix = 0): HTMLElement {
    const el = this.makeBlock(type)
    if (stripPrefix && block.firstChild?.nodeType === Node.TEXT_NODE) {
      const first = block.firstChild as Text
      first.textContent = (first.textContent ?? '').slice(stripPrefix)
    }
    el.append(...Array.from(block.childNodes))
    if (!el.textContent && !el.querySelector('.eq')) el.replaceChildren(document.createElement('br'))
    block.replaceWith(el)
    const r = document.createRange()
    r.setStart(el, 0)
    const sel = window.getSelection()!
    sel.removeAllRanges()
    sel.addRange(r)
    return el
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
      const dir = (e as CustomEvent).detail.direction as string
      if (dir === 'upward' || dir === 'downward') this.moveVertical(fieldCaretRect(mf), dir === 'upward' ? -1 : 1)
      else this.exitField(wrap, dir === 'backward' ? 'before' : 'after')
    })
    // The answer is a read-only tail: keep the caret inside the input part.
    mf.addEventListener('selection-change', () => {
      const end = inputEnd(mf)
      if (mf.selectionIsCollapsed && mf.position > end) mf.position = end
    })
    mf.addEventListener('focusin', () => {
      this.lastField = mf
      wrap.classList.add('focused')
    })
    mf.addEventListener('focusout', () => {
      wrap.classList.remove('focused')
      if (mf.dataset.calc && mf.value !== mf.dataset.out) this.recompute()
    })
    mf.addEventListener('input', () => {
      if (mf.value !== mf.dataset.out && mf.value.includes(RESULT_CLASS)) mf.classList.add('stale')
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
      if (mf.value !== value || (o.result && !mf.dataset.tail)) {
        const pos = mf.position
        mf.value = inputs[i]
        const end = mf.lastOffset
        mf.value = value
        mf.dataset.tail = String(mf.lastOffset - end) // length of the answer, in caret offsets
        mf.position = Math.min(pos, inputEnd(mf))
      }
      mf.dataset.out = value
      mf.classList.remove('stale')
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
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') this.goalX = null
    const plain = !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey
    if (plain && e.key === 'ArrowRight' && mf.selectionIsCollapsed && mf.position >= inputEnd(mf)) {
      // Step over the answer straight out of the equation.
      e.preventDefault()
      e.stopPropagation()
      this.exitField(wrap, 'after')
      return
    }
    if (plain && e.key === 'Delete' && mf.position >= inputEnd(mf)) {
      e.preventDefault()
      e.stopPropagation()
      return
    }
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
        mf.position = inputEnd(mf)
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      this.exitField(wrap, 'after')
    } else if (e.key === 'Backspace' && inputOf(mf.value) === '') {
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
        text = document.createTextNode('\u200B')
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

  // ---------- vertical caret movement ----------

  /** Puts the caret into an equation at the point closest to (x, y). */
  private focusFieldAt(mf: MathfieldElement, x: number, y: number) {
    mf.focus()
    const r = mf.getBoundingClientRect()
    const offset = mf.getOffsetFromPoint(Math.min(Math.max(x, r.left + 1), r.right - 1), Math.min(Math.max(y, r.top + 1), r.bottom - 1))
    mf.position = Math.min(offset, inputEnd(mf))
  }

  /**
   * Moves the caret one visual line up (dir = -1) or down (dir = 1) from `from`,
   * landing in text or inside an equation at the same horizontal position.
   */
  moveVertical(from: DOMRect, dir: -1 | 1) {
    const x = (this.goalX ??= from.left)
    const rootRect = this.root.getBoundingClientRect()
    const startY = dir < 0 ? from.top : from.bottom
    for (let step = 1; step <= 40; step++) {
      const y = startY + dir * step * 4
      if (y < rootRect.top || y > rootRect.bottom) return
      const hit = document.elementFromPoint(Math.max(x, rootRect.left + 1), y) as HTMLElement | null
      if (!hit || !this.root.contains(hit) || hit === this.root) continue
      const eq = hit.closest('.eq') as HTMLElement | null
      const block = this.blockOf(hit)
      const displayEq = block?.classList.contains('display') ? (block.querySelector('.eq') as HTMLElement | null) : null
      const target = eq ?? displayEq
      if (target) {
        if (target.contains(document.activeElement)) continue // still inside the equation we're leaving
        this.focusFieldAt(target.querySelector('math-field') as MathfieldElement, x, y)
        return
      }
      const range = document.caretRangeFromPoint?.(Math.max(x, rootRect.left + 1), y)
      if (!range || !this.root.contains(range.startContainer)) continue
      // Only accept a caret that really sits on another line.
      const r = range.getClientRects()[0] ?? (range.startContainer as Element).getBoundingClientRect?.()
      if (r && (dir > 0 ? r.top < from.bottom - 2 : r.bottom > from.top + 2)) continue
      const sel = window.getSelection()!
      this.root.focus({ preventScroll: true })
      sel.removeAllRanges()
      sel.addRange(range)
      return
    }
  }

  /** Caret rectangle in the text (falls back to the block for empty lines). */
  private textCaretRect(): DOMRect | null {
    const sel = window.getSelection()
    if (!sel || !sel.rangeCount) return null
    const range = sel.getRangeAt(0)
    const rects = range.getClientRects()
    if (rects.length) return rects[rects.length - 1]
    const node = range.startContainer
    const el = (node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement) as HTMLElement | null
    const r = el?.getBoundingClientRect()
    if (!r) return null
    const lh = parseFloat(getComputedStyle(el!).lineHeight) || 24
    return new DOMRect(r.left, r.top, 0, Math.min(r.height, lh))
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
    if (!inField && (e.key === 'Enter' || e.key === 'Backspace') && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const sel = window.getSelection()
      const block = sel?.focusNode ? this.blockOf(sel.focusNode) : null
      if (block && this.root.contains(block)) {
        const type = blockType(block)
        const empty = blockText(block) === '' && !block.querySelector('.eq')
        if (e.key === 'Enter' && type === 'li' && empty) {
          // Enter on an empty bullet ends the list (Obsidian/Word).
          e.preventDefault()
          this.convertBlock(block, 'p')
          this.afterStructureChange()
          return
        }
        if (e.key === 'Enter' && type === 'p' && /^(-{3,}|\*{3,}|_{3,})$/.test(blockText(block).trim())) {
          // "---" + Enter draws a line.
          e.preventDefault()
          const hr = this.makeBlock('hr')
          const p = this.emptyParagraph()
          block.replaceWith(hr)
          hr.after(p)
          const r = document.createRange()
          r.setStart(p, 0)
          sel!.removeAllRanges()
          sel!.addRange(r)
          this.afterStructureChange()
          return
        }
        if (e.key === 'Backspace' && type !== 'p' && caretAtBlockStart(block)) {
          // Backspace at the start of a bullet/heading turns it back into text.
          e.preventDefault()
          this.convertBlock(block, 'p')
          this.afterStructureChange()
          return
        }
      }
    }
    if (!inField && (e.key === 'ArrowUp' || e.key === 'ArrowDown') && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const rect = this.textCaretRect()
      if (rect) {
        e.preventDefault()
        this.moveVertical(rect, e.key === 'ArrowUp' ? -1 : 1)
      }
      return
    }
    if (!inField) this.goalX = null
    // ← → : step over invisible caret anchors and into adjacent equations.
    if (!inField && (e.key === 'ArrowRight' || e.key === 'ArrowLeft') && !e.shiftKey) {
      const sel = window.getSelection()
      if (!sel || !sel.isCollapsed || !sel.focusNode) return
      const forward = e.key === 'ArrowRight'
      let { focusNode, focusOffset } = sel
      if (focusNode.nodeType === Node.TEXT_NODE) {
        const t = focusNode.textContent ?? ''
        while (forward ? t[focusOffset] === '\u200B' : t[focusOffset - 1] === '\u200B') focusOffset += forward ? 1 : -1
        if (focusOffset !== sel.focusOffset) sel.collapse(focusNode, focusOffset)
      }
      let neighbour: Node | null = null
      if (focusNode.nodeType === Node.TEXT_NODE) {
        const len = focusNode.textContent?.length ?? 0
        if (forward ? focusOffset >= len : focusOffset <= 0) neighbour = forward ? focusNode.nextSibling : focusNode.previousSibling
      } else {
        neighbour = focusNode.childNodes[forward ? focusOffset : focusOffset - 1] ?? null
      }
      // Skip empty / anchor-only text nodes between the caret and an equation.
      while (neighbour && neighbour.nodeType === Node.TEXT_NODE && (neighbour.textContent ?? '').replace(/\u200B/g, '') === '')
        neighbour = forward ? neighbour.nextSibling : neighbour.previousSibling
      if (neighbour instanceof HTMLElement && neighbour.classList.contains('eq')) {
        e.preventDefault()
        const mf = neighbour.querySelector('math-field') as MathfieldElement
        mf.focus()
        mf.position = forward ? 0 : inputEnd(mf)
      }
    }
  }

  private onRootInput = () => {
    this.hooks.onTyping()
    // Markdown-style shortcuts at the start of a paragraph: "# ", "## ", "### ", "- ".
    const sel = window.getSelection()
    const block = sel?.focusNode ? this.blockOf(sel.focusNode) : null
    if (block && block.tagName === 'P' && block.firstChild?.nodeType === Node.TEXT_NODE) {
      const m = (block.firstChild.textContent ?? '').match(/^(#{1,3}|[-*])[\s\u00A0]/)
      if (m) {
        const type = m[1] === '-' || m[1] === '*' ? 'li' : (['h1', 'h2', 'h3'] as const)[m[1].length - 1]
        this.convertBlock(block, type, m[0].length)
      }
    }
    if (!this.root.firstElementChild) this.root.append(this.emptyParagraph())
    this.refreshDisplayClasses()
    this.hooks.onChange()
  }

  private afterStructureChange() {
    this.refreshDisplayClasses()
    this.hooks.onChange()
  }

  refreshDisplayClasses() {
    for (const el of Array.from(this.root.children)) {
      const inlines: Inline[] = []
      el.childNodes.forEach((n) => {
        if (n instanceof HTMLElement && n.classList.contains('eq')) inlines.push({ t: 'eq', latex: '' })
        else inlines.push({ t: 'text', s: (n.textContent ?? '').replace(/\u200B/g, '') })
      })
      el.classList.toggle('display', isDisplay({ type: 'p', inlines }) && el.tagName === 'P')
    }
  }
}
