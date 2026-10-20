import { useEffect, useMemo, useRef, useState } from 'react'
import { convertLatexToMarkup } from 'mathlive'
import { Background } from './Background'
import { Splash } from './Splash'
import { saveMarkdownFile } from './desktop'
import { DocEditor } from './editor'
import type { EngineOptions, Lang, ResultMode, Variable } from './engine'
import { commandFor, DEFAULT_HOTKEYS, formatHotkey, type Command, type Hotkeys } from './hotkeys'
import { sampleDoc, strings } from './i18n'
import { parseDocument, toMarkdown, type Block, type Doc, type Property } from './markdown'
import { HotkeysDialog, Properties, TabBar, TemplatesDialog, type NoteTab } from './NotePanel'
import { applyTemplate, migrateTemplates, ROOT_NOTE, titleOf, type Template } from './templates'

type ThemePref = 'day' | 'night' | 'system'

interface Settings {
  theme: ThemePref
  lang: Lang
  mode: ResultMode
  digits: number
  motion: boolean
  templates: Template[]
  defaultTemplate: string | null
  hotkeys: Hotkeys
}

const SETTINGS_KEY = 'lumenrain.settings'
const LEGACY_DOC_KEY = 'lumenrain.doc'
const NOTES_KEY = 'lumenrain.notes'
const noteKey = (id: string) => `lumenrain.note.${id}`

interface NotesIndex {
  tabs: NoteTab[]
  active: string
}

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

function removeKey(key: string) {
  try {
    localStorage.removeItem(key)
  } catch {
    /* ignore */
  }
}

const newId = () => `n${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

const defaultSettings: Settings = {
  theme: 'night',
  lang: navigator.language.startsWith('da') ? 'da' : 'en',
  mode: 'auto',
  digits: 6,
  motion: true,
  templates: [ROOT_NOTE],
  defaultTemplate: null,
  hotkeys: DEFAULT_HOTKEYS,
}

function loadSettings(): Settings {
  const saved = readJson<Partial<Settings>>(SETTINGS_KEY) ?? {}
  return {
    ...defaultSettings,
    ...saved,
    templates: migrateTemplates(saved.templates ?? defaultSettings.templates),
    hotkeys: { ...DEFAULT_HOTKEYS, ...saved.hotkeys },
  }
}

import { OPERATOR_GROUPS } from './operators'
import { CommandPalette, type PaletteItem } from './CommandPalette'
import { COMMANDS } from './hotkeys'

function Tex({ latex }: { latex: string }) {
  const html = useMemo(() => convertLatexToMarkup(latex.replace(/#\?/g, '\\placeholder{}')), [latex])
  return <span className="math" dangerouslySetInnerHTML={{ __html: html }} />
}

type Panel = null | 'palette' | 'shortcuts' | 'settings' | 'symbols' | 'export' | 'templates' | 'hotkeys'

export default function App() {
  const [settings, setSettings] = useState<Settings>(loadSettings)
  const [systemDark, setSystemDark] = useState(() => matchMedia('(prefers-color-scheme: dark)').matches)
  const [variables, setVariables] = useState<Variable[]>([])
  const [panel, setPanel] = useState<Panel>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [symGroup, setSymGroup] = useState<(typeof OPERATOR_GROUPS)[number]['id']>('calculus')
  const [props, setPropsState] = useState<Property[] | null>(null)
  const [tabs, setTabs] = useState<NoteTab[]>([])
  const [activeId, setActiveId] = useState('')
  const [source, setSource] = useState<string | null>(null)
  const [typing, setTyping] = useState(false)
  const [ready, setReady] = useState(false)
  const [copied, setCopied] = useState(false)
  const [importText, setImportText] = useState('')
  const [markdown, setMarkdown] = useState('')
  const pageRef = useRef<HTMLDivElement>(null)
  const titleRef = useRef<HTMLInputElement>(null)
  const editorRef = useRef<DocEditor | null>(null)
  const propsRef = useRef<Property[] | null>(null)
  const activeRef = useRef('')
  const typingTimer = useRef<number | undefined>(undefined)
  const t = strings[settings.lang]
  const langRef = useRef(settings.lang)
  langRef.current = settings.lang

  const theme = settings.theme === 'system' ? (systemDark ? 'night' : 'day') : settings.theme
  const engineOpts: EngineOptions = useMemo(
    () => ({ mode: settings.mode, digits: settings.digits, lang: settings.lang }),
    [settings.mode, settings.digits, settings.lang],
  )
  const activeTitle = tabs.find((x) => x.id === activeId)?.title ?? ''

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

  useEffect(() => {
    editorRef.current?.refreshGraphs() // graph colours follow the theme
  }, [theme])

  useEffect(() => {
    if (activeId) writeJson(NOTES_KEY, { tabs, active: activeId } satisfies NotesIndex)
  }, [tabs, activeId])

  const update = (patch: Partial<Settings>) => setSettings((s) => ({ ...s, ...patch }))

  // ---------- notes ----------

  const persist = () => {
    if (editorRef.current && activeRef.current) writeJson(noteKey(activeRef.current), { props: propsRef.current, blocks: editorRef.current.save() })
  }
  const showDoc = (doc: Doc, calculate = false) => {
    const ed = editorRef.current
    if (!ed) return
    propsRef.current = doc.props
    setPropsState(doc.props)
    ed.load(doc.blocks.length ? doc.blocks : [{ type: 'p', inlines: [] }])
    if (calculate) ed.calculateAll()
  }
  const currentDoc = (): Doc => ({ props: propsRef.current, blocks: editorRef.current?.save() ?? [] })
  const noteMarkdown = () => toMarkdown(editorRef.current?.exportBlocks() ?? [], propsRef.current)
  const openNote = (id: string) => {
    persist()
    activeRef.current = id
    setActiveId(id)
    setSource(null)
    showDoc(readJson<Doc>(noteKey(id)) ?? { props: null, blocks: [] })
  }

  // Create the editor once; it owns the page DOM from here on.
  useEffect(() => {
    const ed = new DocEditor(
      pageRef.current!,
      {
        onChange: () => {
          if (activeRef.current) writeJson(noteKey(activeRef.current), { props: propsRef.current, blocks: ed.save() })
        },
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

    let index = readJson<NotesIndex>(NOTES_KEY)
    if (!index || !index.tabs.length) {
      // First run (or upgrade from the single-note version).
      const legacy = readJson<Doc | Block[]>(LEGACY_DOC_KEY)
      const id = newId()
      let doc: Doc
      let fresh = false
      if (legacy && (Array.isArray(legacy) ? legacy.length : legacy.blocks?.length)) {
        doc = Array.isArray(legacy) ? { props: null, blocks: legacy } : legacy
      } else {
        doc = parseDocument(sampleDoc[engineOpts.lang])
        fresh = true
      }
      writeJson(noteKey(id), doc)
      removeKey(LEGACY_DOC_KEY)
      index = { tabs: [{ id, title: titleOf(doc.blocks) || strings[engineOpts.lang].untitled }], active: id }
      writeJson(NOTES_KEY, index) // right away, so a second mount reuses this note
      setTabs(index.tabs)
      activeRef.current = id
      setActiveId(id)
      showDoc(doc, fresh)
    } else {
      setTabs(index.tabs)
      const active = index.tabs.some((x) => x.id === index!.active) ? index.active : index.tabs[0].id
      activeRef.current = active
      setActiveId(active)
      showDoc(readJson<Doc>(noteKey(active)) ?? { props: null, blocks: [] })
    }
    // Ready once the math fonts and engine are warm (the first recompute happened above).
    document.fonts.ready.then(() => setReady(true))
    return () => ed.destroy()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    editorRef.current?.setOptions(engineOpts)
  }, [engineOpts])

  const setProps = (p: Property[] | null) => {
    propsRef.current = p
    setPropsState(p)
    persist()
  }

  const templateById = (id: string | null) => settings.templates.find((x) => x.id === id) ?? null

  const newNote = (templateId: string | null) => {
    persist()
    const id = newId()
    const title = t.untitled
    const tpl = templateById(templateId)
    const doc: Doc = tpl ? applyTemplate(tpl, { props: null, blocks: [] }, title) : { props: null, blocks: [{ type: 'p', inlines: [] }] }
    writeJson(noteKey(id), doc)
    const after = activeRef.current
    setTabs((list) => {
      const next = [...list]
      next.splice(next.findIndex((x) => x.id === after) + 1, 0, { id, title })
      return next
    })
    activeRef.current = id
    setActiveId(id)
    setSource(null)
    showDoc(doc, true)
    setMenuOpen(false)
    requestAnimationFrame(() => titleRef.current?.select())
  }

  const closeNote = (id: string) => {
    removeKey(noteKey(id))
    const rest = tabs.filter((x) => x.id !== id)
    setTabs(rest)
    if (id !== activeRef.current) return
    if (rest.length) {
      const at = Math.max(0, tabs.findIndex((x) => x.id === id) - 1)
      activeRef.current = ''
      openNote(rest[Math.min(at, rest.length - 1)].id)
    } else {
      activeRef.current = ''
      newNote(null)
    }
  }

  const applyToCurrent = (templateId: string) => {
    const tpl = templateById(templateId)
    if (tpl) {
      showDoc(applyTemplate(tpl, currentDoc(), activeTitle || t.untitled), true)
      persist()
    }
    setMenuOpen(false)
  }

  const renameNote = (title: string) => {
    editorRef.current?.renameHeadings(activeTitle, title)
    setTabs((list) => list.map((x) => (x.id === activeId ? { ...x, title } : x)))
  }

  // ---------- source mode ----------

  const toggleSource = () => {
    if (source === null) {
      setSource(noteMarkdown())
    } else {
      showDoc(parseDocument(source), true)
      persist()
      setSource(null)
    }
  }

  // ---------- export / import ----------

  const openExport = () => {
    setMarkdown(noteMarkdown())
    setCopied(false)
    setPanel('export')
  }

  const copyMarkdown = async () => {
    await navigator.clipboard.writeText(noteMarkdown())
    setCopied(true)
  }

  const saveMarkdown = () => saveMarkdownFile(`${(activeTitle || 'Lumenrain').replace(/[\\/:*?"<>|]/g, '')}.md`, markdown)

  const doImport = () => {
    if (!importText.trim()) return
    showDoc(parseDocument(importText), true)
    persist()
    setImportText('')
    setPanel(null)
  }

  // ---------- hotkeys ----------

  const run = (cmd: Command) => {
    const ed = editorRef.current
    const inSource = source !== null
    const block = (type: Block['type']) => !inSource && ed?.toggleBlock(type)
    switch (cmd) {
      case 'heading1':
      case 'heading2':
      case 'heading3':
      case 'heading4':
      case 'heading5':
      case 'heading6':
        return block(`h${cmd.slice(-1)}` as Block['type'])
      case 'bulletList':
        return block('li')
      case 'numberedList':
        return block('oli')
      case 'equation':
        return !inSource && ed?.insertEquation('', true)
      case 'inlineEquation':
        return !inSource && ed?.insertEquation('', false)
      case 'insertTemplate':
        return setMenuOpen(true)
      case 'toggleSource':
        return toggleSource()
      case 'newNote':
        return newNote(settings.defaultTemplate)
      case 'copyMarkdown':
        return navigator.clipboard.writeText(noteMarkdown())
      case 'insertGraph':
        return !inSource && ed?.insertGraph()
      case 'commandPalette':
        return setPanel('palette')
    }
  }
  const runRef = useRef(run)
  runRef.current = run
  const hotkeysRef = useRef(settings.hotkeys)
  hotkeysRef.current = settings.hotkeys
  const panelRef = useRef(panel)
  panelRef.current = panel

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (panelRef.current === 'hotkeys') return // recording new shortcuts
      if (e.key === 'Escape') {
        setPanel(null)
        setMenuOpen(false)
        return
      }
      const cmd = commandFor(hotkeysRef.current, e)
      if (!cmd) return
      const target = e.target as HTMLElement
      const inForm = target.closest?.('input, select, textarea:not(.source)') !== null
      if (inForm && cmd !== 'toggleSource' && cmd !== 'newNote') return
      e.preventDefault()
      e.stopPropagation()
      runRef.current(cmd)
    }
    window.addEventListener('keydown', onKey, true) // capture: before MathLive sees it
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])

  const insert = (latex: string) => editorRef.current?.insertIntoField(latex)
  const keepFocus = (e: React.MouseEvent) => e.preventDefault()
  const nextMode: Record<ResultMode, ResultMode> = { auto: 'exact', exact: 'decimal', decimal: 'auto' }
  const modeLabel = { auto: t.modeAuto, exact: t.modeExact, decimal: t.modeDecimal }[settings.mode]
  const hk = (cmd: Command) => settings.hotkeys[cmd]?.[0] && formatHotkey(settings.hotkeys[cmd][0])

  return (
    <div className={`app ${settings.motion ? 'motion' : ''} ${typing ? 'typing' : ''}`}>
      <Background />
      <Splash ready={ready} />

      <header className="toolbar" onMouseDown={keepFocus}>
        <span className="brand" role="img" aria-label="Lumenrain">
          <span className="brand-letters" />
          <span className="brand-drop" />
        </span>
        <div className="anchor">
          <button className={`btn primary ${panel === 'shortcuts' ? 'on' : ''}`} onClick={() => setPanel(panel === 'shortcuts' ? null : 'shortcuts')}>
            {t.shortcutsBtn}
          </button>
          {panel === 'shortcuts' && (
            <div className="popover shortcuts">
              <table>
                <tbody>
                  {[
                    [hk('equation'), t.sc.equation],
                    [hk('inlineEquation'), t.sc.inline],
                    ['Enter', t.sc.calc],
                    ['Enter ×2', t.sc.leave],
                    ['/', t.sc.fraction],
                    ['^  _', t.sc.power],
                    ['sqrt(', t.sc.root],
                    ['ddx  pdx  int  lim  sum', t.sc.calculus],
                    ['alpha  pi  omega …', t.sc.greek],
                    ['\\', t.sc.commands],
                    ['Ctrl+Z / Ctrl+Y', t.sc.undo],
                    [hk('heading1')?.replace('1', '1–6'), t.sc.headings],
                    ['- / 1. / ---', t.sc.lists],
                    [hk('toggleSource'), t.sc.source],
                    [hk('insertGraph'), t.sc.graph],
                    [hk('commandPalette'), t.sc.palette],
                  ].map(([k, d]) => (
                    <tr key={d}>
                      <td>
                        <kbd>{k}</kbd>
                      </td>
                      <td>{d}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="anchor">
          <button className={`btn ${panel === 'symbols' ? 'on' : ''}`} onClick={() => setPanel(panel === 'symbols' ? null : 'symbols')}>
            ∂ ∫ α
          </button>
          {panel === 'symbols' && (
            <div className="popover symbols">
              <div className="segmented">
                {OPERATOR_GROUPS.map((g) => (
                  <button key={g.id} className={symGroup === g.id ? 'on' : ''} onClick={() => setSymGroup(g.id)}>
                    {t.groups[g.id]}
                  </button>
                ))}
              </div>
              <div className="sym-grid">
                {OPERATOR_GROUPS.find((g) => g.id === symGroup)!.items.map((o) => (
                  <button key={o.latex} className="sym" onClick={() => insert(o.latex)} title={o.typed ? `${t.typeHint}: ${o.typed}` : undefined}>
                    <Tex latex={(o.preview ?? o.latex).replace(/#@/g, 'x')} />
                    {o.typed && <span className="sym-typed">{o.typed}</span>}
                  </button>
                ))}
              </div>
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
        <button className={`btn ghost ${source !== null ? 'on' : ''}`} onClick={toggleSource} title={`${t.sourceMode} (${hk('toggleSource') ?? ''})`}>
          {'</>'}
        </button>
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
              <button className="btn" onClick={() => setPanel('hotkeys')}>
                {t.hotkeys}…
              </button>
              <button className="btn" onClick={() => setPanel('templates')}>
                {t.manageTemplates}…
              </button>
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
        <TabBar
          t={t}
          tabs={tabs}
          activeId={activeId}
          templates={settings.templates}
          defaultTemplate={settings.defaultTemplate}
          menuOpen={menuOpen}
          setMenuOpen={setMenuOpen}
          onSelect={openNote}
          onClose={closeNote}
          onNew={newNote}
          onApply={applyToCurrent}
          onManageTemplates={() => {
            setMenuOpen(false)
            setPanel('templates')
          }}
        />
        <article className="sheet">
          <input
            ref={titleRef}
            className="note-title"
            value={activeTitle}
            placeholder={t.untitled}
            aria-label={t.noteTitle}
            onChange={(e) => renameNote(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === 'ArrowDown') {
                e.preventDefault()
                pageRef.current?.focus()
              }
            }}
          />
          {props && source === null && <Properties props={props} onChange={setProps} t={t} />}
          {source !== null && (
            <textarea className="source" value={source} onChange={(e) => setSource(e.target.value)} spellCheck={false} aria-label={t.sourceMode} autoFocus />
          )}
          <div ref={pageRef} className="page" hidden={source !== null} />
        </article>
      </main>

      {panel === 'templates' && (
        <TemplatesDialog
          t={t}
          templates={settings.templates}
          defaultTemplate={settings.defaultTemplate}
          onTemplatesChange={(templates) => update({ templates })}
          onDefaultChange={(defaultTemplate) => update({ defaultTemplate })}
          onClose={() => setPanel(null)}
        />
      )}

      {panel === 'palette' && (
        <CommandPalette
          placeholder={t.palette.placeholder}
          empty={t.palette.empty}
          onClose={() => setPanel(null)}
          items={[
            ...COMMANDS.filter((c) => c !== 'commandPalette').map(
              (c): PaletteItem => ({ id: `cmd-${c}`, group: t.palette.commands, label: t.commands[c], hint: hk(c) || undefined, run: () => run(c) }),
            ),
            { id: 'theme', group: t.palette.commands, label: t.palette.toggleTheme, run: () => update({ theme: theme === 'day' ? 'night' : 'day' }) },
            { id: 'lang', group: t.palette.commands, label: t.palette.switchLang, run: () => update({ lang: settings.lang === 'en' ? 'da' : 'en' }) },
            { id: 'export', group: t.palette.commands, label: t.palette.exportObsidian, run: openExport },
            { id: 'hotkeys', group: t.palette.commands, label: t.palette.openHotkeys, run: () => setPanel('hotkeys') },
            { id: 'templates', group: t.palette.commands, label: t.palette.openTemplates, run: () => setPanel('templates') },
            ...tabs
              .filter((x) => x.id !== activeId)
              .map((x): PaletteItem => ({ id: `note-${x.id}`, group: t.palette.notes, label: `${t.palette.openNote}: ${x.title || t.untitled}`, keywords: x.title, run: () => openNote(x.id) })),
            ...OPERATOR_GROUPS.flatMap((g) =>
              g.items.map(
                (o): PaletteItem => ({
                  id: `sym-${g.id}-${o.latex}`,
                  group: t.groups[g.id],
                  label: `${t.palette.insertSymbol} ${o.typed ?? ''}`.trim(),
                  keywords: `${o.typed ?? ''} ${o.latex.replace(/[\\{}#?@^_]/g, ' ')}`,
                  icon: <Tex latex={(o.preview ?? o.latex).replace(/#@/g, 'x')} />,
                  run: () => insert(o.latex),
                }),
              ),
            ),
          ]}
        />
      )}

      {panel === 'hotkeys' && (
        <HotkeysDialog
          t={t}
          hotkeys={settings.hotkeys}
          onChange={(hotkeys) => update({ hotkeys })}
          onReset={() => update({ hotkeys: DEFAULT_HOTKEYS })}
          onClose={() => setPanel(null)}
        />
      )}

      {panel === 'export' && (
        <div className="dialog-backdrop" onMouseDown={() => setPanel(null)}>
          <div className="dialog" role="dialog" aria-label={t.exportTitle} onMouseDown={(e) => e.stopPropagation()}>
            <h2>{t.exportTitle}</h2>
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
