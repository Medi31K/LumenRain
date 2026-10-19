import type { Lang } from './engine'

const en = {
  notes: 'Notes',
  noteMenu: 'New note, templates',
  newBlankNote: 'New blank note',
  newNoteFrom: 'New note from',
  closeNote: 'Close note',
  confirmDelete: 'Click again to delete this note',
  deleteQ: 'Delete?',
  noteTitle: 'Note title',
  sourceMode: 'Source mode (Markdown)',
  hotkeys: 'Hotkeys',
  pressKeys: 'Press keys…',
  noHotkey: 'Not set',
  importObsidian: 'Import Obsidian hotkeys.json',
  importedHotkeys: 'Took over {n} writing shortcuts from Obsidian.',
  importFailed: "That file isn't an Obsidian hotkeys.json.",
  resetHotkeys: 'Reset',
  commands: {
    heading1: 'Heading 1',
    heading2: 'Heading 2',
    heading3: 'Heading 3',
    heading4: 'Heading 4',
    heading5: 'Heading 5',
    heading6: 'Heading 6',
    bulletList: 'Bullet list',
    numberedList: 'Numbered list',
    equation: 'Equation (own line)',
    inlineEquation: 'Inline equation',
    insertTemplate: 'Insert template',
    toggleSource: 'Source mode',
    newNote: 'New note',
    copyMarkdown: 'Copy as Markdown',
  },
  untitled: 'Untitled',
  newNote: 'New note',
  applyTemplate: 'Apply to this note:',
  manageTemplates: 'Templates',
  templateName: 'Template name',
  newTemplate: 'New template',
  addTemplate: 'Add template',
  useForNew: 'Default for new notes',
  noDefault: 'No default',
  edit: 'Edit',
  done: 'Done',
  remove: 'Remove',
  properties: 'Properties',
  addProperty: 'Add property',
  propertyName: 'name',
  empty: 'Empty',
  listHint: 'comma, separated',
  newEquation: 'New equation',
  fraction: 'Fraction',
  root: 'Root',
  power: 'Power',
  symbols: 'Symbols',
  modeAuto: 'Exact ≈',
  modeExact: 'Exact',
  modeDecimal: '≈ Decimal',
  modeHint: 'Result format: exact, decimal or both',
  obsidian: 'Obsidian',
  variables: 'Variables',
  noVariables: 'Define one with  m = 2.5',
  settings: 'Settings',
  theme: 'Theme',
  day: 'Day',
  night: 'Night',
  system: 'System',
  motion: 'Background motion',
  digits: 'Significant digits',
  language: 'Language',
  exportTitle: 'Export to Obsidian',
  copy: 'Copy Markdown',
  copied: 'Copied!',
  saveMd: 'Save .md',
  importMd: 'Import Markdown',
  importDo: 'Import',
  close: 'Close',
  errParse: "Can't read this expression",
  errSolve: "Can't solve this equation",
}

const da: typeof en = {
  notes: 'Noter',
  noteMenu: 'Ny note, skabeloner',
  newBlankNote: 'Ny tom note',
  newNoteFrom: 'Ny note fra',
  closeNote: 'Luk note',
  confirmDelete: 'Klik igen for at slette noten',
  deleteQ: 'Slet?',
  noteTitle: 'Notens titel',
  sourceMode: 'Kildetilstand (Markdown)',
  hotkeys: 'Genveje',
  pressKeys: 'Tryk tasterne…',
  noHotkey: 'Ikke sat',
  importObsidian: 'Importér Obsidian hotkeys.json',
  importedHotkeys: 'Overtog {n} skrivegenveje fra Obsidian.',
  importFailed: 'Filen er ikke en Obsidian hotkeys.json.',
  resetHotkeys: 'Nulstil',
  commands: {
    heading1: 'Overskrift 1',
    heading2: 'Overskrift 2',
    heading3: 'Overskrift 3',
    heading4: 'Overskrift 4',
    heading5: 'Overskrift 5',
    heading6: 'Overskrift 6',
    bulletList: 'Punktliste',
    numberedList: 'Nummereret liste',
    equation: 'Ligning (egen linje)',
    inlineEquation: 'Ligning i teksten',
    insertTemplate: 'Indsæt skabelon',
    toggleSource: 'Kildetilstand',
    newNote: 'Ny note',
    copyMarkdown: 'Kopiér som Markdown',
  },
  untitled: 'Uden titel',
  newNote: 'Ny note',
  applyTemplate: 'Brug på denne note:',
  manageTemplates: 'Skabeloner',
  templateName: 'Skabelonens navn',
  newTemplate: 'Ny skabelon',
  addTemplate: 'Tilføj skabelon',
  useForNew: 'Standard for nye noter',
  noDefault: 'Ingen standard',
  edit: 'Redigér',
  done: 'Færdig',
  remove: 'Fjern',
  properties: 'Egenskaber',
  addProperty: 'Tilføj egenskab',
  propertyName: 'navn',
  empty: 'Tom',
  listHint: 'komma, separeret',
  newEquation: 'Ny ligning',
  fraction: 'Brøk',
  root: 'Rod',
  power: 'Potens',
  symbols: 'Symboler',
  modeAuto: 'Eksakt ≈',
  modeExact: 'Eksakt',
  modeDecimal: '≈ Decimal',
  modeHint: 'Resultatformat: eksakt, decimal eller begge',
  obsidian: 'Obsidian',
  variables: 'Variable',
  noVariables: 'Definér en med  m = 2,5',
  settings: 'Indstillinger',
  theme: 'Tema',
  day: 'Dag',
  night: 'Nat',
  system: 'System',
  motion: 'Bevægelig baggrund',
  digits: 'Betydende cifre',
  language: 'Sprog',
  exportTitle: 'Eksportér til Obsidian',
  copy: 'Kopiér Markdown',
  copied: 'Kopieret!',
  saveMd: 'Gem .md',
  importMd: 'Importér Markdown',
  importDo: 'Importér',
  close: 'Luk',
  errParse: 'Kan ikke læse udtrykket',
  errSolve: 'Kan ikke løse ligningen',
}

export type Strings = typeof en
export const strings: Record<Lang, Strings> = { en, da }

export const sampleDoc: Record<Lang, string> = {
  en: `# Physics – Assignment 3

## Problem 1 – Kinetic energy

A ball with mass $m=2.5$ and speed $v=12$ (SI units). Find its kinetic energy:

$$
E_{kin}=\\frac{1}{2}\\cdot m\\cdot v^2
$$

## Problem 2 – Solve

$$
x^2-4=0
$$

Try it: click an equation and press Enter. Press Alt+M for a new one.`,
  da: `# Fysik – Aflevering 3

## Opgave 1 – Kinetisk energi

En bold med massen $m=2{,}5$ og farten $v=12$ (SI-enheder). Find den kinetiske energi:

$$
E_{kin}=\\frac{1}{2}\\cdot m\\cdot v^2
$$

## Opgave 2 – Løs

$$
x^2-4=0
$$

Prøv selv: klik på en ligning og tryk Enter. Tryk Alt+M for en ny.`,
}
