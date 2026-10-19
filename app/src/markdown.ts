import { unwrapResult } from './engine'

export type Inline = { t: 'text'; s: string } | { t: 'eq'; latex: string }
export interface Block {
  type: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'p' | 'li' | 'oli' | 'hr'
  inlines: Inline[]
  /** No blank line before this block in the Markdown (keeps templates byte-exact). */
  tight?: boolean
}

/** An Obsidian property (YAML frontmatter entry). Lists are kept as arrays. */
export interface Property {
  key: string
  value: string | string[]
}

export interface Doc {
  /** null = the note has no Properties block. */
  props: Property[] | null
  blocks: Block[]
}

/** A paragraph that holds nothing but one equation is a display equation ($$). */
export function isDisplay(b: Block): boolean {
  const meaningful = b.inlines.filter((i) => i.t === 'eq' || i.s.trim() !== '')
  return b.type === 'p' && meaningful.length === 1 && meaningful[0].t === 'eq'
}

const escapeText = (s: string) => s.replace(/\$/g, '\\$')
const mathOf = (latex: string) => unwrapResult(latex, true)

// ---------- frontmatter ----------

function yamlScalar(v: string): string {
  return /^[\s]|[\s]$|^[-?:,[\]{}#&*!|>'"%@`]|: | #/.test(v) ? JSON.stringify(v) : v
}

export function propsToYaml(props: Property[]): string {
  const lines = props.map((p) => {
    if (Array.isArray(p.value)) {
      const items = p.value.filter((v) => v.trim() !== '')
      return items.length ? `${p.key}:\n${items.map((v) => `  - ${yamlScalar(v)}`).join('\n')}` : `${p.key}:`
    }
    return p.value.trim() === '' ? `${p.key}:` : `${p.key}: ${yamlScalar(p.value)}`
  })
  return `---\n${lines.join('\n')}\n---`
}

const unquote = (s: string) => {
  const t = s.trim()
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) return t.slice(1, -1)
  return t
}

/** Parses the small YAML subset Obsidian writes for properties. */
export function parseYaml(lines: string[]): Property[] {
  const props: Property[] = []
  for (const line of lines) {
    const item = line.match(/^\s+-\s?(.*)$/)
    if (item && props.length) {
      const last = props[props.length - 1]
      if (!Array.isArray(last.value)) last.value = last.value ? [last.value] : []
      last.value.push(unquote(item[1]))
      continue
    }
    const kv = line.match(/^([^:#][^:]*):\s*(.*)$/)
    if (!kv) continue
    const raw = kv[2].trim()
    if (raw.startsWith('[') && raw.endsWith(']')) {
      props.push({ key: kv[1].trim(), value: raw.slice(1, -1).split(',').map(unquote).filter(Boolean) })
    } else {
      props.push({ key: kv[1].trim(), value: unquote(raw) })
    }
  }
  return props
}

// ---------- blocks ----------

function inlineMarkdown(b: Block): string {
  return b.inlines.map((i) => (i.t === 'eq' ? `$${mathOf(i.latex)}$` : escapeText(i.s))).join('')
}

const HEADINGS = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']
const isList = (t: Block['type']) => t === 'li' || t === 'oli'

function blockMarkdown(b: Block, number: number): string {
  if (b.type === 'hr') return '---'
  if (isDisplay(b)) {
    const eq = b.inlines.find((i) => i.t === 'eq') as { latex: string }
    return `$$\n${mathOf(eq.latex)}\n$$`
  }
  const body = inlineMarkdown(b)
  if (HEADINGS.includes(b.type)) return `${'#'.repeat(Number(b.type[1]))} ${body}`
  if (b.type === 'li') return `- ${body}`
  if (b.type === 'oli') return `${number}. ${body}`
  return body
}

const HEADING_OR_RULE = ['hr', ...HEADINGS]

/** Whether two blocks may sit on consecutive lines without changing their meaning. */
function tightBetween(prev: Block, b: Block): boolean {
  if (isDisplay(b) || isDisplay(prev)) return false
  if (b.type === 'hr' && prev.type === 'p') return false // would turn the text into a heading
  const safe = isList(b.type) ? prev.type !== 'hr' || b.tight === true : HEADING_OR_RULE.includes(b.type) || HEADING_OR_RULE.includes(prev.type)
  if (!safe) return false
  return b.tight ?? (isList(b.type) && (isList(prev.type) || prev.type === 'p'))
}

/**
 * Serialises a note for Obsidian: Properties as frontmatter, inline math `$…$`,
 * display math `$$…$$`, and lists kept tight under the line that introduces them.
 */
export function toMarkdown(blocks: Block[], props: Property[] | null = null): string {
  // A note may not *start* with "---" or Obsidian reads it as Properties.
  let out = props ? `${propsToYaml(props)}\n` : blocks[0]?.type === 'hr' ? '\n' : ''
  let number = 0
  blocks.forEach((b, i) => {
    const prev = blocks[i - 1]
    if (prev) out += tightBetween(prev, b) ? '\n' : '\n\n'
    else if (props && !b.tight) out += '\n'
    number = b.type === 'oli' ? (prev?.type === 'oli' ? number + 1 : 1) : 0
    out += blockMarkdown(b, number)
  })
  return out.replace(/\n+$/, '')
}

function parseInlines(line: string): Inline[] {
  const out: Inline[] = []
  let text = ''
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '\\' && line[i + 1] === '$') {
      text += '$'
      i++
    } else if (c === '$') {
      const end = line.indexOf('$', i + 1)
      if (end < 0) {
        text += c
        continue
      }
      if (text) out.push({ t: 'text', s: text })
      text = ''
      out.push({ t: 'eq', latex: line.slice(i + 1, end).trim() })
      i = end
    } else {
      text += c
    }
  }
  if (text) out.push({ t: 'text', s: text })
  return out
}

export function parseDocument(md: string): Doc {
  const lines = md.replace(/\r\n/g, '\n').split('\n')
  let start = 0
  let props: Property[] | null = null
  if (lines[0]?.trim() === '---') {
    const end = lines.findIndex((l, i) => i > 0 && l.trim() === '---')
    const yamlish = (l: string) => /^\s*$|^[^\s:#][^:]*:(\s.*)?$|^\s+-(\s.*)?$/.test(l)
    if (end > 0 && lines.slice(1, end).every(yamlish)) {
      props = parseYaml(lines.slice(1, end))
      start = end + 1
    }
  }

  const blocks: Block[] = []
  let para: string[] = []
  let paraTight = false
  let blank = false
  const push = (b: Block) => {
    b.tight = !blank && (blocks.length > 0 || props !== null)
    blank = false
    blocks.push(b)
  }
  const flush = () => {
    if (para.length) {
      blank = !paraTight
      push({ type: 'p', inlines: parseInlines(para.join(' ')) })
    }
    para = []
  }
  for (let i = start; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()
    if (trimmed.startsWith('$$')) {
      flush()
      let body = trimmed.slice(2)
      if (body.endsWith('$$') && body.length >= 2) {
        body = body.slice(0, -2)
      } else {
        const parts = [body]
        while (++i < lines.length && !lines[i].trim().endsWith('$$')) parts.push(lines[i])
        if (i < lines.length) parts.push(lines[i].trim().slice(0, -2))
        body = parts.join(' ')
      }
      push({ type: 'p', inlines: [{ t: 'eq', latex: body.trim() }] })
    } else if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      flush()
      push({ type: 'hr', inlines: [] })
    } else if (/^#{1,6}\s/.test(trimmed)) {
      flush()
      const level = trimmed.match(/^#+/)![0].length
      push({ type: `h${level}` as Block['type'], inlines: parseInlines(trimmed.replace(/^#+\s*/, '')) })
    } else if (/^\d+[.)](\s|$)/.test(trimmed)) {
      flush()
      push({ type: 'oli', inlines: parseInlines(trimmed.replace(/^\d+[.)]\s?/, '')) })
    } else if (/^[-*+](\s|$)/.test(trimmed)) {
      flush()
      push({ type: 'li', inlines: parseInlines(trimmed.replace(/^[-*+]\s?/, '')) })
    } else if (trimmed === '') {
      flush()
      blank = true
    } else {
      if (!para.length) paraTight = !blank && (blocks.length > 0 || props !== null)
      para.push(trimmed)
    }
  }
  flush()
  return { props, blocks }
}

export function fromMarkdown(md: string): Block[] {
  return parseDocument(md).blocks
}
