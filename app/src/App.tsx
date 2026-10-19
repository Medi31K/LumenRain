import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { convertLatexToMarkup } from 'mathlive'
import { Background } from './Background'
import { DocEditor } from './editor'
import type { EngineOptions, Lang, ResultMode, Variable } from './engine'
import { sampleDoc, strings } from './i18n'
import { fromMarkdown, parseDocument, toMarkdown, type Block, type Doc, type Property } from './markdown'
import { NotePanel, Properties } from './NotePanel'
import { applyTemplate, ROOT_NOTE, titleOf, type Template } from './templates'

type ThemePref = 'day' | 'night' | 'system'

interface Settings {
  theme: ThemePref
  lang: Lang
  mode: ResultMode
  digits: number
  motion: boolean
  templates: Template[]
  defaultTemplate: string | null
}

const SETTINGS_KEY = 'lumenrain.settings'
const DOC_KEY = 'lumenrain.doc'

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* storage unavailable: nothing to persist */
  }
}

const defaultSettings: Settings = {
  theme: 'system',
  lang: navigator.language.startsWith('da') ? 'da' : 'en',
  mode: 'auto',
  digits: 6,
  motion: true,
  templates: [ROOT_NOTE],
  defaultTemplate: null,
}

const SYMBOLS = ['\\alpha', '\\beta', '\\gamma', '\\Delta', '\\theta', '\\lambda', '\\mu', '\\pi', '\\rho', '\\sigma', '\\omega', '\\infty',
  '\\pm', '\\cdot', '\\le', '\\ge', '\\ne', '\\approx', '\\sum_{#?}^{#?}', '\\int_{#?}^{#?}', '\\lim_{#?}', '\\log', '\\ln', '\\sin', '\\cos', '\\tan']

function Tex({ latex }: { latex: string }) {
  const html = useMemo(() => convertLatexToMarkup(latex.replace(/#\?/g, '\\placeholder{}')), [latex])
  return <span className="math" dangerouslySetInnerHTML={{ __html: html }} />
}

export default function App() {
  const [settings, setSettings] = useState<Settings>(() => ({ ...defaultSettings, ...readJson<Settings>(SETTINGS_KEY) }))
  const [systemDark, setSystemDark] = useState(() => matchMedia('(prefers-color-scheme: dark)').matches)
  const [variables, setVariables] = useState<Variable[]>([])
  const [panel, setPanel] = useState<null | 'settings' | 'symbols' | 'export' | 'note'>(null)
  const [props, setPropsState] = useState<Property[] | null>(null)
  const propsRef = useRef<Property[] | null>(null)
  const [typing, setTyping] = useState(false)
  const [copied, setCopied] = useState(false)
  const [importText, setImportText] = useState('')
  const [markdown, setMarkdown] = useState('')
  const pageRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<DocEditor | null>(null)
  const typingTimer = useRef<number | undefined>(undefined)
  const t = strings[settings.lang]
  const langRef = useRef(settings.lang)
  langRef.current = settings.lang

  const theme = settings.theme === 'system' ? (systemDark ? 'night' : 'day') : settings.theme
  const engineOpts: EngineOptions = useMemo(
    () => ({ mode: settings.mode, digits: settings.digits, lang: settings.lang }),
    [settings.mode, settings.digits, settings.lang],
  )

  useEffect(() => {
    const mq = matchMedia('(prefers-color-scheme: dark)')
    const on = (e: MediaQueryListEvent) => setSystemDark(e.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.documentElement.lang = settings.lang
    writeJson(SETTINGS_KEY, settings)
  }, [theme, settings])

  const update = (patch: Partial<Settings>) => setSettings((s) => ({ ...s, ...patch }))

  // Create the editor once; it owns the page DOM from here on.
  useEffect(() => {
    const ed = new DocEditor(
      pageRef.current!,
      {
        onChange: () => writeJson(DOC_KEY, { props: propsRef.current, blocks: ed.save() }),
        onVariables: setVariables,
        onTyping: () => {
          setTyping(true)
          window.clearTimeout(typingTimer.current)
          typingTimer.current = window.setTimeout(() => setTyping(false), 2000)
        },
        errorText: (o) => (o.error === 'solve' ? strings[langRef.current].errSolve : strings[langRef.current].errParse),
      },
      engineOpts,
    )
    editorRef.current = ed
    const saved = readJson<Doc | Block[]>(DOC_KEY)
    const doc: Doc | null = Array.isArray(saved) ? { props: null, blocks: saved } : saved
    if (doc && doc.blocks?.length) {
      propsRef.current = doc.props
      setPropsState(doc.props)
      ed.load(doc.blocks)
    } else {
      ed.load(fromMarkdown(sampleDoc[engineOpts.lang]))
      ed.calculateAll()
    }
    return () => ed.destroy()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    editorRef.current?.setOptions(engineOpts)
  }, [engineOpts])

  const persist = () => {
    if (editorRef.current) writeJson(DOC_KEY, { props: propsRef.current, blocks: editorRef.current.save() })
  }
  const setProps = (p: Property[] | null) => {
    propsRef.current = p
    setPropsState(p)
    persist()
  }
  const currentDoc = (): Doc => ({ props: propsRef.current, blocks: editorRef.current?.save() ?? [] })
  const noteMarkdown = () => {
    const d = currentDoc()
    return toMarkdown(d.blocks, d.props)
  }
  const loadDoc = (doc: Doc) => {
    if (!editorRef.current) return
    propsRef.current = doc.props
    setPropsState(doc.props)
    editorRef.current.load(doc.blocks)
    editorRef.current.calculateAll()
    persist()
  }
  const templateById = (id: string | null) => settings.templates.find((x) => x.id === id) ?? null

  const newNote = (templateId: string | null, title: string) => {
    const tpl = templateById(templateId)
    const empty: Doc = { props: null, blocks: [{ type: 'h1', inlines: [{ t: 'text', s: title }] }, { type: 'p', inlines: [] }] }
    loadDoc(tpl ? applyTemplate(tpl, { props: null, blocks: [] }, title) : empty)
    setPanel(null)
  }
  const applyToCurrent = (templateId: string, title: string) => {
    const tpl = templateById(templateId)
    if (tpl) loadDoc(applyTemplate(tpl, currentDoc(), title))
    setPanel(null)
  }

  const openExport = useCallback(() => {
    if (!editorRef.current) return
    setMarkdown(noteMarkdown())
    setCopied(false)
    setPanel('export')
  }, [])

  const copyMarkdown = async () => {
    const md = editorRef.current ? noteMarkdown() : markdown
    await navigator.clipboard.writeText(md)
    setCopied(true)
  }

  const saveMarkdown = () => {
    const blob = new Blob([markdown], { type: 'text/markdown' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    const title = titleOf(currentDoc().blocks) || 'Lumenrain'
    a.download = `${title.replace(/[\\/:*?"<>|]/g, '')}.md`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const doImport = () => {
    if (!importText.trim() || !editorRef.current) return
    loadDoc(parseDocument(importText))
    setImportText('')
    setPanel(null)
  }

  // Global shortcut: Ctrl/Cmd+Shift+C copies the document as Markdown.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'c') {
        e.preventDefault()
        if (editorRef.current) navigator.clipboard.writeText(noteMarkdown())
      } else if (e.key === 'Escape') setPanel(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const insert = (latex: string) => editorRef.current?.insertIntoField(latex)
  const keepFocus = (e: React.MouseEvent) => e.preventDefault()
  const nextMode: Record<ResultMode, ResultMode> = { auto: 'exact', exact: 'decimal', decimal: 'auto' }
  const modeLabel = { auto: t.modeAuto, exact: t.modeExact, decimal: t.modeDecimal }[settings.mode]

  return (
    <div className={`app ${settings.motion ? 'motion' : ''} ${typing ? 'typing' : ''}`}>
      <Background />

      <header className="toolbar" onMouseDown={keepFocus}>
        <span className="brand">Lumenrain</span>
        <button className="btn" onClick={() => setPanel('note')} title={t.noteHint}>
          {t.note} ▾
        </button>
        <button className="btn primary" onClick={() => editorRef.current?.insertEquation()} title="Alt+M">
          {t.newEquation}
        </button>
        <button className="btn" onClick={() => insert('\\frac{#@}{#?}')} title="/">
          {t.fraction}
        </button>
        <button className="btn" onClick={() => insert('\\sqrt{#@}')} title="sqrt">
          {t.root}
        </button>
        <button className="btn" onClick={() => insert('#@^{#?}')} title="^">
          {t.power}
        </button>
        <div className="anchor">
          <button className={`btn ${panel === 'symbols' ? 'on' : ''}`} onClick={() => setPanel(panel === 'symbols' ? null : 'symbols')}>
            α β π
          </button>
          {panel === 'symbols' && (
            <div className="popover symbols">
              {SYMBOLS.map((s) => (
                <button key={s} className="sym" onClick={() => insert(s)} title={s.replace(/_\{#\?\}|\^\{#\?\}/g, '')}>
                  <Tex latex={s} />
                </button>
              ))}
            </div>
          )}
        </div>
        <button className="btn" onClick={() => update({ mode: nextMode[settings.mode] })} title={t.modeHint}>
          {modeLabel}
        </button>
        <button className="btn ghost" onClick={openExport}>
          {t.obsidian} <span aria-hidden>⧉</span>
        </button>
        <span className="grow" />
        <div className="segmented" role="group" aria-label={t.language}>
          {(['en', 'da'] as Lang[]).map((l) => (
            <button key={l} className={settings.lang === l ? 'on' : ''} onClick={() => update({ lang: l })}>
              {l.toUpperCase()}
            </button>
          ))}
        </div>
        <button
          className="btn icon"
          onClick={() => update({ theme: theme === 'day' ? 'night' : 'day' })}
          title={theme === 'day' ? t.night : t.day}
          aria-label={theme === 'day' ? t.night : t.day}
        >
          {theme === 'day' ? '☾' : '☼'}
        </button>
        <div className="anchor">
          <button className="btn icon" onClick={() => setPanel(panel === 'settings' ? null : 'settings')} aria-label={t.settings} title={t.settings}>
            ⚙
          </button>
          {panel === 'settings' && (
            <div className="popover settings">
              <h3>{t.settings}</h3>
              <label>{t.theme}</label>
              <div className="segmented">
                {(['day', 'night', 'system'] as ThemePref[]).map((v) => (
                  <button key={v} className={settings.theme === v ? 'on' : ''} onClick={() => update({ theme: v })}>
                    {t[v]}
                  </button>
                ))}
              </div>
              <label>{t.digits}</label>
              <div className="segmented">
                {[3, 4, 6, 8, 10].map((d) => (
                  <button key={d} className={settings.digits === d ? 'on' : ''} onClick={() => update({ digits: d })}>
                    {d}
                  </button>
                ))}
              </div>
              <label className="check">
                <input type="checkbox" checked={settings.motion} onChange={(e) => update({ motion: e.target.checked })} />
                {t.motion}
              </label>
            </div>
          )}
        </div>
      </header>

      <aside className="variables">
        <h4>{t.variables}</h4>
        {variables.length === 0 ? (
          <p className="muted">{t.noVariables}</p>
        ) : (
          variables.map((v, i) => (
            <div key={i} className="var">
              <Tex latex={`${v.name}=${v.latex}`} />
            </div>
          ))
        )}
      </aside>

      <main className="sheet-wrap">
        <article className="sheet">
          {props && <Properties props={props} onChange={setProps} t={t} />}
          <div ref={pageRef} className="page" />
          <p className="hint">{t.shortcuts}</p>
        </article>
      </main>

      {panel === 'note' && (
        <NotePanel
          t={t}
          templates={settings.templates}
          defaultTemplate={settings.defaultTemplate}
          currentTitle={titleOf(currentDoc().blocks)}
          onNew={newNote}
          onApply={applyToCurrent}
          onTemplatesChange={(templates) => update({ templates })}
          onDefaultChange={(defaultTemplate) => update({ defaultTemplate })}
          onClose={() => setPanel(null)}
        />
      )}

      {panel === 'export' && (
        <div className="dialog-backdrop" onMouseDown={() => setPanel(null)}>
          <div className="dialog" role="dialog" aria-label={t.exportTitle} onMouseDown={(e) => e.stopPropagation()}>
            <h2>{t.exportTitle}</h2>
            <p className="muted">{t.exportHint}</p>
            <pre className="md">{markdown}</pre>
            <div className="row">
              <button className="btn primary" onClick={copyMarkdown}>
                {copied ? t.copied : t.copy}
              </button>
              <button className="btn" onClick={saveMarkdown}>
                {t.saveMd}
              </button>
              <span className="grow" />
              <button className="btn ghost" onClick={() => setPanel(null)}>
                {t.close}
              </button>
            </div>
            <h3>{t.importMd}</h3>
            <p className="muted">{t.importHint}</p>
            <textarea value={importText} onChange={(e) => setImportText(e.target.value)} rows={4} placeholder="$$E=mc^2$$" />
            <div className="row">
              <button className="btn" onClick={doImport} disabled={!importText.trim()}>
                {t.importDo}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
