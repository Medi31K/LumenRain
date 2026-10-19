import { useState } from 'react'
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

// ---------- Note / template dialog ----------

interface NotePanelProps {
  t: Strings
  templates: Template[]
  defaultTemplate: string | null
  currentTitle: string
  onNew(templateId: string | null, title: string): void
  onApply(templateId: string, title: string): void
  onTemplatesChange(templates: Template[]): void
  onDefaultChange(id: string | null): void
  onClose(): void
}

export function NotePanel(p: NotePanelProps) {
  const { t } = p
  const [title, setTitle] = useState(p.currentTitle)
  const [templateId, setTemplateId] = useState<string>(p.defaultTemplate ?? p.templates[0]?.id ?? '')
  const [editing, setEditing] = useState<string | null>(null)
  const [confirmNew, setConfirmNew] = useState(false)

  const update = (id: string, patch: Partial<Template>) => p.onTemplatesChange(p.templates.map((x) => (x.id === id ? { ...x, ...patch } : x)))
  const addTemplate = () => {
    const id = `tpl-${Date.now().toString(36)}`
    p.onTemplatesChange([...p.templates, { id, name: t.newTemplate, markdown: '---\ndate:\ntags:\n---\n# {{Title}}\n' }])
    setEditing(id)
  }

  return (
    <div className="dialog-backdrop" onMouseDown={p.onClose}>
      <div className="dialog note-dialog" role="dialog" aria-label={t.note} onMouseDown={(e) => e.stopPropagation()}>
        <h2>{t.note}</h2>

        <label className="field">
          <span>{t.title}</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t.untitled} autoFocus />
        </label>
        <label className="field">
          <span>{t.template}</span>
          <select value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
            <option value="">{t.blank}</option>
            {p.templates.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
        </label>

        <div className="row">
          {confirmNew ? (
            <>
              <span className="muted">{t.replaceWarning}</span>
              <span className="grow" />
              <button className="btn ghost" onClick={() => setConfirmNew(false)}>
                {t.cancel}
              </button>
              <button className="btn primary" onClick={() => p.onNew(templateId || null, title.trim() || t.untitled)}>
                {t.newNote}
              </button>
            </>
          ) : (
            <>
              <button className="btn primary" onClick={() => setConfirmNew(true)}>
                {t.newNote}
              </button>
              <button className="btn" disabled={!templateId} onClick={() => p.onApply(templateId, title.trim() || t.untitled)}>
                {t.applyTemplate}
              </button>
              <span className="grow" />
              <button className="btn ghost" onClick={p.onClose}>
                {t.close}
              </button>
            </>
          )}
        </div>

        <h3>{t.manageTemplates}</h3>
        <p className="muted">{t.templateHint}</p>
        <ul className="templates">
          {p.templates.map((x) => (
            <li key={x.id}>
              <div className="row">
                <input
                  className="tpl-name"
                  value={x.name}
                  onChange={(e) => update(x.id, { name: e.target.value })}
                  aria-label={t.templateName}
                />
                <label className="check" title={t.useForNew}>
                  <input
                    type="radio"
                    name="default-template"
                    checked={p.defaultTemplate === x.id}
                    onChange={() => p.onDefaultChange(x.id)}
                  />
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
                    if (templateId === x.id) setTemplateId('')
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
        </div>
      </div>
    </div>
  )
}
