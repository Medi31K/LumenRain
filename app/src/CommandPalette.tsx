import { useEffect, useMemo, useRef, useState } from 'react'

// Ctrl+P: one search box for commands, symbols and notes (like Obsidian's palette).

export interface PaletteItem {
  id: string
  group: string
  label: string
  /** Extra words that should match (shortcut text, LaTeX name …). */
  keywords?: string
  hint?: string
  /** Rendered preview (e.g. a symbol). */
  icon?: React.ReactNode
  run(): void
}

/** Subsequence match with a score: consecutive and word-start hits rank higher. */
function fuzzyScore(query: string, text: string): number {
  const q = query.toLowerCase().trim()
  if (!q) return 1
  const t = text.toLowerCase()
  const direct = t.indexOf(q)
  if (direct >= 0) return 1000 - direct - (direct > 0 && /\w/.test(t[direct - 1]) ? 200 : 0)
  let score = 0
  let ti = 0
  let streak = 0
  for (const ch of q) {
    const found = t.indexOf(ch, ti)
    if (found < 0) return -1
    streak = found === ti ? streak + 1 : 0
    score += 10 + streak * 5 - (found - ti)
    ti = found + 1
  }
  return score
}

export function CommandPalette({ items, placeholder, empty, onClose }: { items: PaletteItem[]; placeholder: string; empty: string; onClose(): void }) {
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  const results = useMemo(() => {
    const scored = items
      .map((it) => ({ it, s: Math.max(fuzzyScore(query, it.label), fuzzyScore(query, it.keywords ?? '') - 50) }))
      .filter((r) => r.s >= 0)
    if (query.trim()) scored.sort((a, b) => b.s - a.s)
    return scored.slice(0, 60).map((r) => r.it)
  }, [items, query])

  useEffect(() => {
    listRef.current?.querySelector('.on')?.scrollIntoView({ block: 'nearest' })
  }, [index])

  const choose = (it: PaletteItem | undefined) => {
    if (!it) return
    onClose()
    // Let the palette close (and focus return) before running the command.
    requestAnimationFrame(() => it.run())
  }

  return (
    <div className="dialog-backdrop palette-backdrop" onMouseDown={onClose}>
      <div className="palette" role="dialog" aria-label={placeholder} onMouseDown={(e) => e.stopPropagation()}>
        <input
          autoFocus
          value={query}
          placeholder={placeholder}
          onChange={(e) => {
            setQuery(e.target.value)
            setIndex(0)
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setIndex((i) => Math.min(i + 1, results.length - 1))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setIndex((i) => Math.max(i - 1, 0))
            } else if (e.key === 'Enter') {
              e.preventDefault()
              choose(results[index])
            } else if (e.key === 'Escape') {
              e.preventDefault()
              onClose()
            }
          }}
        />
        <div className="palette-list" ref={listRef} role="listbox">
          {results.length === 0 && <p className="muted palette-empty">{empty}</p>}
          {results.map((it, i) => (
            <button
              key={it.id}
              role="option"
              aria-selected={i === index}
              className={`palette-item ${i === index ? 'on' : ''}`}
              onMouseEnter={() => setIndex(i)}
              onClick={() => choose(it)}
            >
              <span className="palette-icon">{it.icon}</span>
              <span className="palette-label">{it.label}</span>
              <span className="palette-group">{it.group}</span>
              {it.hint && <kbd>{it.hint}</kbd>}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
