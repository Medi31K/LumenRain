// Customisable hotkeys in Obsidian's format ({ modifiers: ['Mod', 'Shift'], key: 'J' }).
// "Mod" is Ctrl on Windows/Linux and ⌘ on macOS, exactly like Obsidian.

export type Command =
  | 'heading1'
  | 'heading2'
  | 'heading3'
  | 'heading4'
  | 'heading5'
  | 'heading6'
  | 'bulletList'
  | 'numberedList'
  | 'equation'
  | 'inlineEquation'
  | 'insertTemplate'
  | 'toggleSource'
  | 'newNote'
  | 'copyMarkdown'
  | 'insertGraph'
  | 'commandPalette'

export interface Hotkey {
  modifiers: string[]
  key: string
}

export type Hotkeys = Record<Command, Hotkey[]>

export const COMMANDS: Command[] = [
  'heading1',
  'heading2',
  'heading3',
  'heading4',
  'heading5',
  'heading6',
  'bulletList',
  'numberedList',
  'equation',
  'inlineEquation',
  'insertTemplate',
  'toggleSource',
  'newNote',
  'copyMarkdown',
  'insertGraph',
  'commandPalette',
]

const k = (key: string, ...modifiers: string[]): Hotkey[] => [{ modifiers, key }]

/** Defaults = the writing shortcuts from the user's Obsidian hotkeys.json. */
export const DEFAULT_HOTKEYS: Hotkeys = {
  heading1: k('1', 'Alt'),
  heading2: k('2', 'Alt'),
  heading3: k('3', 'Alt'),
  heading4: k('4', 'Alt'),
  heading5: k('5', 'Alt'),
  heading6: k('6', 'Alt'),
  bulletList: k('J', 'Mod'),
  numberedList: k('K', 'Mod'),
  equation: k('M', 'Alt'),
  inlineEquation: k('M', 'Alt', 'Shift'),
  insertTemplate: k('G', 'Mod'),
  toggleSource: k('E', 'Mod'),
  newNote: [],
  copyMarkdown: k('C', 'Mod', 'Shift'),
  insertGraph: k('G', 'Alt'),
  commandPalette: k('P', 'Mod'),
}

/** Obsidian command ids → Lumenrain commands (writing commands only). */
const OBSIDIAN: Record<string, Command> = {
  'editor:set-heading-1': 'heading1',
  'editor:set-heading-2': 'heading2',
  'editor:set-heading-3': 'heading3',
  'editor:set-heading-4': 'heading4',
  'editor:set-heading-5': 'heading5',
  'editor:set-heading-6': 'heading6',
  'editor:toggle-bullet-list': 'bulletList',
  'editor:toggle-numbered-list': 'numberedList',
  'mathlive:open-modal': 'equation',
  'mathlive:open-modal-inline': 'inlineEquation',
  'insert-template': 'insertTemplate',
  'editor:toggle-source': 'toggleSource',
}

/** Reads an Obsidian `.obsidian/hotkeys.json`; returns how many commands were taken over. */
export function importObsidianHotkeys(json: string, current: Hotkeys): { hotkeys: Hotkeys; count: number } {
  const data = JSON.parse(json) as Record<string, Hotkey[]>
  const hotkeys = { ...current }
  let count = 0
  for (const [id, keys] of Object.entries(data)) {
    const cmd = OBSIDIAN[id]
    if (!cmd || !Array.isArray(keys) || !keys.length) continue
    hotkeys[cmd] = keys.map((h) => ({ modifiers: [...h.modifiers], key: h.key }))
    count++
  }
  return { hotkeys, count }
}

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)

/** Layout-independent key name: "J", "1", "ArrowUp", " " … */
export function eventKey(e: KeyboardEvent): string {
  if (e.code.startsWith('Key')) return e.code.slice(3)
  if (e.code.startsWith('Digit')) return e.code.slice(5)
  if (e.code === 'Space') return ' '
  return e.key.length === 1 ? e.key.toUpperCase() : e.key
}

export function eventModifiers(e: KeyboardEvent): string[] {
  const mods: string[] = []
  if (isMac ? e.metaKey : e.ctrlKey) mods.push('Mod')
  if (isMac && e.ctrlKey) mods.push('Ctrl')
  if (!isMac && e.metaKey) mods.push('Meta')
  if (e.altKey) mods.push('Alt')
  if (e.shiftKey) mods.push('Shift')
  return mods
}

export function matches(h: Hotkey, e: KeyboardEvent): boolean {
  const mods = eventModifiers(e)
  return h.key.toUpperCase() === eventKey(e).toUpperCase() && mods.length === h.modifiers.length && h.modifiers.every((m) => mods.includes(m))
}

export function commandFor(hotkeys: Hotkeys, e: KeyboardEvent): Command | null {
  for (const cmd of COMMANDS) if (hotkeys[cmd]?.some((h) => matches(h, e))) return cmd
  return null
}

export function formatHotkey(h: Hotkey): string {
  const names: Record<string, string> = { Mod: isMac ? '⌘' : 'Ctrl', Alt: isMac ? '⌥' : 'Alt', Shift: isMac ? '⇧' : 'Shift', Ctrl: '⌃', Meta: 'Win' }
  const key = h.key === ' ' ? 'Space' : h.key.replace(/^Arrow/, '')
  return [...h.modifiers.map((m) => names[m] ?? m), key].join(isMac ? '' : '+')
}
