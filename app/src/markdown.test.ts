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
    expect(back[0]).toEqual(doc[0])
    expect(back[1]).toEqual(doc[1])
    expect(back[2].inlines).toEqual([{ t: 'eq', latex: 'x^2-4=0\\quad\\Rightarrow\\quad x=2' }])
  })
  it('accepts single-line $$ blocks', () => {
    expect(fromMarkdown('$$a+b$$')).toEqual([{ type: 'p', inlines: [{ t: 'eq', latex: 'a+b' }] }])
  })
})
