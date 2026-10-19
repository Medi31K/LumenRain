import { useEffect, useRef, useState } from 'react'
import { COMMANDS, eventKey, eventModifiers, formatHotkey, importObsidianHotkeys, type Command, type Hotkeys } from './hotkeys'
import type { Strings } from './i18n'
import type { Property } from './markdown'
import { splitPastedTemplate, type Template } from './templates'

// ---------- Properties (Obsidian frontmatter) ----------

const ICONS: Record<string, string> = { date: '📅', tags: '🏷', status: '☰', aliases: '↪', created: '📅', updated: '📅' }

export function Properties({ props, onChange, t }: { props: Property[]; onChange(p: Property[]): void; t: Strings }) {
  const set = (i: number, patch: Partial<Property>) => onChange(props.map((p, j) => (j === i ? { ...p, ...patch } : p)))
  const remove = (i: number) => onChange(props.filter((_, j) => j !== i))
  return (
    <section className="properties" aria-label={t.properties}>
      <h4>{t.properties}</h4>
      {props.map((p, i) => {
        const isList = Array.isArray(p.value) || p.key === 'tags' || p.key === 'aliases'
        const text = Array.isArray(p.value) ? p.value.join(', ') : p.value
        return (
          <div className="prop" key={i}>
            <span className="prop-icon" aria-hidden>
              {ICONS[p.key] ?? '≡'}
            </span>
            <input
              className="prop-key"
              value={p.key}
              placeholder={t.propertyName}
              onChange={(e) => set(i, { key: e.target.value })}
              aria-label={t.propertyName}
            />
            <input
              className="prop-value"
              type={p.key === 'date' ? 'date' : 'text'}
              value={text}
              placeholder={isList ? t.listHint : t.empty}
              onChange={(e) =>
                set(i, { value: isList ? e.target.value.split(',').map((v) => v.trimStart()) : e.target.value })
              }
              onBlur={(e) => isList && set(i, { value: e.target.value.split(',').map((v) => v.trim()).filter(Boolean) })}
              aria-label={p.key}
            />
            <button className="prop-remove" onClick={() => remove(i)} aria-label={`${t.remove} ${p.key}`} title={t.remove}>
              ×
            </button>
          </div>
        )
      })}
      <button className="prop-add" onClick={() => onChange([...props, { key: '', value: '' }])}>
        + {t.addProperty}
      </button>
    </section>
  )
}

// ---------- Tabs: pinned "+" with the note menu, one tab per note ----------

export interface NoteTab {
  id: string
  title: string
}

interface TabBarProps {
  t: Strings
  tabs: NoteTab[]
  activeId: string
  templates: Template[]
  defaultTemplate: string | null
  menuOpen: boolean
  setMenuOpen(open: boolean): void
  onSelect(id: string): void
  onClose(id: string): void
  onNew(templateId: string | null): void
  onApply(templateId: string): void
  onManageTemplates(): void
}

export function TabBar(p: TabBarProps) {
  const { t } = p
  const [confirmClose, setConfirmClose] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!p.menuOpen) return
    const close = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) p.setMenuOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [p.menuOpen, p])

  const def = p.templates.find((x) => x.id === p.defaultTemplate)
  return (
    <nav className="tabbar" aria-label={t.notes}>
      <div className="anchor" ref={menuRef}>
        <button
          className={`tab-plus ${p.menuOpen ? 'on' : ''}`}
          onClick={() => p.setMenuOpen(!p.menuOpen)}
          aria-label={t.noteMenu}
          title={t.noteMenu}
        >
          {/* Water rising in a capillary: the surface climbs the walls (Young–Laplace meniscus). */}
          <svg className="meniscus" viewBox="0 0 40 40" aria-hidden="true">
            <path className="water" d="M0 60 L0 22 C0 30 8 30 20 30 C32 30 40 30 40 22 L40 60 Z" />
          </svg>
          <span className="plus-sign">+</span>
        </button>
        {p.menuOpen && (
          <div className="popover tab-menu" role="menu">
            <button role="menuitem" onClick={() => p.onNew(def ? def.id : null)}>
              {t.newNote}
              {def && <span className="muted"> · {def.name}</span>}
            </button>
            {def && (
              <button role="menuitem" onClick={() => p.onNew(null)}>
                {t.newBlankNote}
              </button>
            )}
            {p.templates
              .filter((x) => x.id !== def?.id)
              .map((x) => (
                <button role="menuitem" key={x.id} onClick={() => p.onNew(x.id)}>
                  {t.newNoteFrom} <b>{x.name}</b>
                </button>
              ))}
            {p.templates.length > 0 && <hr />}
            {p.templates.map((x) => (
              <button role="menuitem" key={`apply-${x.id}`} onClick={() => p.onApply(x.id)}>
                {t.applyTemplate} <b>{x.name}</b>
              </button>
            ))}
            <hr />
            <button role="menuitem" onClick={p.onManageTemplates}>
              {t.manageTemplates}…
            </button>
          </div>
        )}
      </div>
      <div className="tabs" role="tablist">
        {p.tabs.map((tab) => (
          <div key={tab.id} className={`tab ${tab.id === p.activeId ? 'active' : ''}`} role="tab" aria-selected={tab.id === p.activeId}>
            <button className="tab-title" onClick={() => p.onSelect(tab.id)} title={tab.title || t.untitled}>
              {tab.title || t.untitled}
            </button>
            <button
              className={`tab-close ${confirmClose === tab.id ? 'confirm' : ''}`}
              onClick={() => {
                if (confirmClose === tab.id) {
                  setConfirmClose(null)
                  p.onClose(tab.id)
                } else setConfirmClose(tab.id)
              }}
              onMouseLeave={() => confirmClose === tab.id && setConfirmClose(null)}
              aria-label={`${t.closeNote} ${tab.title}`}
              title={confirmClose === tab.id ? t.confirmDelete : t.closeNote}
            >
              {confirmClose === tab.id ? t.deleteQ : '×'}
            </button>
          </div>
        ))}
      </div>
    </nav>
  )
}

// ---------- Templates dialog ----------

interface TemplatesDialogProps {
  t: Strings
  templates: Template[]
  defaultTemplate: string | null
  onTemplatesChange(templates: Template[]): void
  onDefaultChange(id: string | null): void
  onClose(): void
}

export function TemplatesDialog(p: TemplatesDialogProps) {
  const { t } = p
  const [editing, setEditing] = useState<string | null>(null)
  const update = (id: string, patch: Partial<Template>) => p.onTemplatesChange(p.templates.map((x) => (x.id === id ? { ...x, ...patch } : x)))
  const addTemplate = () => {
    const id = `tpl-${Date.now().toString(36)}`
    p.onTemplatesChange([...p.templates, { id, name: t.newTemplate, markdown: '# {{Title}}\n' }])
    setEditing(id)
  }
  return (
    <div className="dialog-backdrop" onMouseDown={p.onClose}>
      <div className="dialog note-dialog" role="dialog" aria-label={t.manageTemplates} onMouseDown={(e) => e.stopPropagation()}>
        <h2>{t.manageTemplates}</h2>
        <ul className="templates">
          {p.templates.map((x) => (
            <li key={x.id}>
              <div className="row">
                <input className="tpl-name" value={x.name} onChange={(e) => update(x.id, { name: e.target.value })} aria-label={t.templateName} />
                <label className="check">
                  <input type="radio" name="default-template" checked={p.defaultTemplate === x.id} onChange={() => p.onDefaultChange(x.id)} />
                  {t.useForNew}
                </label>
                <span className="grow" />
                <button className="btn ghost" onClick={() => setEditing(editing === x.id ? null : x.id)}>
                  {editing === x.id ? t.done : t.edit}
                </button>
                <button
                  className="btn ghost"
                  onClick={() => {
                    p.onTemplatesChange(p.templates.filter((y) => y.id !== x.id))
                    if (p.defaultTemplate === x.id) p.onDefaultChange(null)
                  }}
                >
                  {t.remove}
                </button>
              </div>
              {editing === x.id && (
                <textarea
                  rows={12}
                  value={x.markdown}
                  spellCheck={false}
                  onChange={(e) => {
                    const { name, markdown } = splitPastedTemplate(e.target.value)
                    update(x.id, name ? { name, markdown } : { markdown })
                  }}
                />
              )}
            </li>
          ))}
        </ul>
        <div className="row">
          <button className="btn" onClick={addTemplate}>
            + {t.addTemplate}
          </button>
          {p.defaultTemplate && (
            <button className="btn ghost" onClick={() => p.onDefaultChange(null)}>
              {t.noDefault}
            </button>
          )}
          <span className="grow" />
          <button className="btn ghost" onClick={p.onClose}>
            {t.close}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------- Hotkeys dialog ----------

interface HotkeysDialogProps {
  t: Strings
  hotkeys: Hotkeys
  onChange(h: Hotkeys): void
  onReset(): void
  onClose(): void
}

export function HotkeysDialog(p: HotkeysDialogProps) {
  const { t } = p
  const [recording, setRecording] = useState<Command | null>(null)
  const [status, setStatus] = useState('')

  useEffect(() => {
    if (!recording) return
    const onKey = (e: KeyboardEvent) => {
      if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return
      e.preventDefault()
      e.stopPropagation()
      if (e.key === 'Escape') {
        setRecording(null)
        return
      }
      p.onChange({ ...p.hotkeys, [recording]: [{ modifiers: eventModifiers(e), key: eventKey(e) }] })
      setRecording(null)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [recording, p])

  const importFile = async (file: File) => {
    try {
      const { hotkeys, count } = importObsidianHotkeys(await file.text(), p.hotkeys)
      p.onChange(hotkeys)
      setStatus(t.importedHotkeys.replace('{n}', String(count)))
    } catch {
      setStatus(t.importFailed)
    }
  }

  return (
    <div className="dialog-backdrop" onMouseDown={p.onClose}>
      <div className="dialog note-dialog" role="dialog" aria-label={t.hotkeys} onMouseDown={(e) => e.stopPropagation()}>
        <h2>{t.hotkeys}</h2>
        <div className="hotkeys">
          {COMMANDS.map((cmd) => (
            <div className="hotkey" key={cmd}>
              <span>{t.commands[cmd]}</span>
              <button className={`btn ${recording === cmd ? 'on' : ''}`} onClick={() => setRecording(recording === cmd ? null : cmd)}>
                {recording === cmd ? t.pressKeys : p.hotkeys[cmd]?.length ? p.hotkeys[cmd].map(formatHotkey).join(' / ') : t.noHotkey}
              </button>
              <button
                className="btn ghost icon"
                onClick={() => p.onChange({ ...p.hotkeys, [cmd]: [] })}
                aria-label={`${t.remove} ${t.commands[cmd]}`}
                title={t.remove}
                disabled={!p.hotkeys[cmd]?.length}
              >
                ×
              </button>
            </div>
          ))}
        </div>
        {status && <p className="muted">{status}</p>}
        <div className="row">
          <label className="btn">
            {t.importObsidian}
            <input type="file" accept=".json,application/json" hidden onChange={(e) => e.target.files?.[0] && importFile(e.target.files[0])} />
          </label>
          <button className="btn ghost" onClick={p.onReset}>
            {t.resetHotkeys}
          </button>
          <span className="grow" />
          <button className="btn ghost" onClick={p.onClose}>
            {t.close}
          </button>
        </div>
      </div>
    </div>
  )
}
