import { unwrapResult } from './engine'

export type Inline = { t: 'text'; s: string } | { t: 'eq'; latex: string }
export interface Block {
  type: 'h1' | 'h2' | 'p'
  inlines: Inline[]
}

/** A paragraph that holds nothing but one equation is a display equation ($$). */
export function isDisplay(b: Block): boolean {
  const meaningful = b.inlines.filter((i) => i.t === 'eq' || i.s.trim() !== '')
  return b.type === 'p' && meaningful.length === 1 && meaningful[0].t === 'eq'
}

const escapeText = (s: string) => s.replace(/\$/g, '\\$')
const mathOf = (latex: string) => unwrapResult(latex, true)

/** Serialises the document for Obsidian: inline math `$…$`, display math `$$…$$`. */
export function toMarkdown(blocks: Block[]): string {
  return blocks
    .map((b) => {
      if (isDisplay(b)) {
        const eq = b.inlines.find((i) => i.t === 'eq') as { latex: string }
        return `$$\n${mathOf(eq.latex)}\n$$`
      }
      const body = b.inlines.map((i) => (i.t === 'eq' ? `$${mathOf(i.latex)}$` : escapeText(i.s))).join('')
      if (b.type === 'h1') return `# ${body}`
      if (b.type === 'h2') return `## ${body}`
      return body
    })
    .filter((s, i, all) => s.trim() !== '' || i < all.length - 1)
    .join('\n\n')
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

export function fromMarkdown(md: string): Block[] {
  const lines = md.replace(/\r\n/g, '\n').split('\n')
  const blocks: Block[] = []
  let para: string[] = []
  const flush = () => {
    if (para.length) blocks.push({ type: 'p', inlines: parseInlines(para.join(' ')) })
    para = []
  }
  for (let i = 0; i < lines.length; i++) {
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
      blocks.push({ type: 'p', inlines: [{ t: 'eq', latex: body.trim() }] })
    } else if (/^#{1,6}\s/.test(trimmed)) {
      flush()
      const level = trimmed.match(/^#+/)![0].length
      blocks.push({ type: level === 1 ? 'h1' : 'h2', inlines: parseInlines(trimmed.replace(/^#+\s*/, '')) })
    } else if (trimmed === '') {
      flush()
    } else {
      para.push(trimmed)
    }
  }
  flush()
  return blocks
}
