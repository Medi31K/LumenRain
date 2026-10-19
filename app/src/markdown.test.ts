import { describe, expect, it } from 'vitest'
import { fromMarkdown, toMarkdown, type Block } from './markdown'

const doc: Block[] = [
  { type: 'h1', inlines: [{ t: 'text', s: 'Physics' }] },
  { type: 'p', inlines: [{ t: 'text', s: 'A ball with mass ' }, { t: 'eq', latex: 'm=2.5' }, { t: 'text', s: ' kg costs $5.' }] },
  { type: 'p', inlines: [{ t: 'eq', latex: 'x^2-4=0\\class{lr-res}{\\quad\\Rightarrow\\quad x=2}' }] },
]

describe('toMarkdown', () => {
  it('uses $ for inline and $$ for display math, and drops result markup', () => {
    expect(toMarkdown(doc)).toBe(
      '# Physics\n\nA ball with mass $m=2.5$ kg costs \\$5.\n\n$$\nx^2-4=0\\quad\\Rightarrow\\quad x=2\n$$',
    )
  })
})

describe('fromMarkdown', () => {
  it('round-trips', () => {
    const back = fromMarkdown(toMarkdown(doc))
    expect(back[0]).toMatchObject(doc[0])
    expect(back[1]).toMatchObject(doc[1])
    expect(back[2].inlines).toEqual([{ t: 'eq', latex: 'x^2-4=0\\quad\\Rightarrow\\quad x=2' }])
  })
  it('accepts single-line $$ blocks', () => {
    expect(fromMarkdown('$$a+b$$')).toMatchObject([{ type: 'p', inlines: [{ t: 'eq', latex: 'a+b' }] }])
  })
})

import { parseDocument, toMarkdown as toMd } from './markdown'
import { applyTemplate, ROOT_NOTE, today } from './templates'

describe('Obsidian notes', () => {
  it('round-trips the ROOT - NOTE template exactly', () => {
    const doc = parseDocument(ROOT_NOTE.markdown)
    expect(doc.props).toEqual([
      { key: 'date', value: '' },
      { key: 'tags', value: '' },
      { key: 'status', value: '' },
    ])
    expect(doc.blocks.map((b) => b.type)).toEqual(['hr', 'p', 'li', 'p', 'li', 'hr', 'h1', 'p', 'li', 'hr'])
    expect(toMd(doc.blocks, doc.props) + '\n').toBe(ROOT_NOTE.markdown)
  })

  it('writes list properties the way Obsidian does', () => {
    const md = toMd([], [
      { key: 'date', value: '2026-10-19' },
      { key: 'tags', value: ['physics', 'energy'] },
      { key: 'status', value: 'draft' },
    ])
    expect(md).toBe('---\ndate: 2026-10-19\ntags:\n  - physics\n  - energy\nstatus: draft\n---')
    expect(parseDocument(md).props?.[1]).toEqual({ key: 'tags', value: ['physics', 'energy'] })
  })

  it('applies the template around existing content', () => {
    const current = parseDocument('# Kinetic energy\n\nSome text $m=2$\n\n$$\nE=mc^2\n$$')
    const doc = applyTemplate(ROOT_NOTE, current, 'Kinetic energy')
    expect(doc.props?.[0]).toEqual({ key: 'date', value: today() })
    const md = toMd(doc.blocks, doc.props)
    expect(md).toContain('---\n# Kinetic energy\n\nTerms & Keywords:\n- \n---\n\nSome text $m=2$\n\n$$\nE=mc^2\n$$')
    expect(md.match(/^# /gm)?.length).toBe(1)
  })
})

import { splitPastedTemplate } from './templates'

describe('pasting a template from Obsidian', () => {
  it('takes the note title from the first line', () => {
    const pasted = 'ROOT - NOTE\n' + ROOT_NOTE.markdown
    const { name, markdown } = splitPastedTemplate(pasted)
    expect(name).toBe('ROOT - NOTE')
    expect(markdown).toBe(ROOT_NOTE.markdown)
  })
})
