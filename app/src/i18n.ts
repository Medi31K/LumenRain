import type { Lang } from './engine'

const en = {
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
  exportHint: 'Inline equations become $…$, equations on their own line become $$…$$.',
  copy: 'Copy Markdown',
  copied: 'Copied!',
  saveMd: 'Save .md',
  importMd: 'Import Markdown',
  importHint: 'Paste Markdown with $…$ / $$…$$ math. This replaces the current document.',
  importDo: 'Import',
  close: 'Close',
  errParse: "Can't read this expression",
  errSolve: "Can't solve this equation",
  shortcuts: 'Alt+M  new equation  ·  Enter  calculate  ·  Enter again  leave field  ·  \\  commands',
}

const da: typeof en = {
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
  exportHint: 'Ligninger i en sætning bliver $…$, ligninger på egen linje bliver $$…$$.',
  copy: 'Kopiér Markdown',
  copied: 'Kopieret!',
  saveMd: 'Gem .md',
  importMd: 'Importér Markdown',
  importHint: 'Indsæt Markdown med $…$ / $$…$$. Det erstatter det nuværende dokument.',
  importDo: 'Importér',
  close: 'Luk',
  errParse: 'Kan ikke læse udtrykket',
  errSolve: 'Kan ikke løse ligningen',
  shortcuts: 'Alt+M  ny ligning  ·  Enter  beregn  ·  Enter igen  forlad feltet  ·  \\  kommandoer',
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
