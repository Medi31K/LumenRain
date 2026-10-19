import { parseDocument, type Block, type Doc, type Inline, type Property } from './markdown'

export interface Template {
  id: string
  name: string
  /** Obsidian Markdown, may contain {{Title}} / {{date}} placeholders. */
  markdown: string
}

export const ROOT_NOTE: Template = {
  id: 'root-note',
  name: 'ROOT - NOTE',
  // Built line by line so the "- " list stubs keep their trailing space.
  markdown: [
    '---',
    'date:',
    'tags:',
    'status:',
    '---',
    '---',
    '',
    'External Sources',
    '- ',
    '',
    'Internal Sources',
    '- ',
    '',
    '---',
    '# {{Title}}',
    '',
    'Terms & Keywords:',
    '- ',
    '---',
    '',
  ].join('\n'),
}

export const today = () => {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function fill(s: string, vars: Record<string, string>): string {
  return s.replace(/\{\{\s*(\w+)\s*\}\}/g, (m, k: string) => vars[k.toLowerCase()] ?? m)
}

function fillInlines(inlines: Inline[], vars: Record<string, string>): Inline[] {
  return inlines.map((i) => (i.t === 'text' ? { t: 'text', s: fill(i.s, vars) } : i))
}

const isBlankBlock = (b: Block) => b.type === 'p' && b.inlines.every((i) => i.t === 'text' && i.s.trim() === '')

/** Title of a note: its first heading 1, if any. */
export function titleOf(blocks: Block[]): string {
  const h1 = blocks.find((b) => b.type === 'h1')
  return h1 ? h1.inlines.map((i) => (i.t === 'text' ? i.s : '')).join('').trim() : ''
}

/**
 * Builds a note from a template. The template's structure comes first and the
 * existing content (minus its own title heading) follows below it.
 */
export function applyTemplate(t: Template, current: Doc, title: string): Doc {
  const vars = { title, date: today() }
  const tpl = parseDocument(t.markdown)

  let props: Property[] | null = null
  if (tpl.props || current.props) {
    const merged = new Map<string, Property>()
    for (const p of tpl.props ?? []) {
      const value = Array.isArray(p.value) ? p.value.map((v) => fill(v, vars)) : fill(p.value, vars)
      merged.set(p.key, { key: p.key, value })
    }
    for (const p of current.props ?? []) {
      const hasValue = Array.isArray(p.value) ? p.value.length > 0 : p.value.trim() !== ''
      if (hasValue || !merged.has(p.key)) merged.set(p.key, p)
    }
    // A fresh note gets today's date, like Obsidian's {{date}}.
    const date = merged.get('date')
    if (date && !Array.isArray(date.value) && date.value === '') date.value = vars.date
    props = [...merged.values()]
  }

  const tplBlocks = tpl.blocks.map((b) => ({ ...b, inlines: fillInlines(b.inlines, vars) }))
  // Drop the note's own title heading: the template provides it.
  let body = current.blocks
  const h1 = body.findIndex((b) => b.type === 'h1')
  if (h1 >= 0 && tplBlocks.some((b) => b.type === 'h1')) body = body.filter((_, i) => i !== h1)
  body = body.filter((b, i) => !(isBlankBlock(b) && i === 0))
  if (!body.length || !isBlankBlock(body[body.length - 1])) body = [...body, { type: 'p', inlines: [] }]
  return { props, blocks: [...tplBlocks, ...body] }
}

/** Accepts a template pasted straight from Obsidian, incl. its note title on the first line. */
export function splitPastedTemplate(text: string): { name?: string; markdown: string } {
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  if (lines[0]?.trim() && lines[0].trim() !== '---' && lines[1]?.trim() === '---') {
    return { name: lines[0].trim(), markdown: lines.slice(1).join('\n') }
  }
  return { markdown: text }
}
