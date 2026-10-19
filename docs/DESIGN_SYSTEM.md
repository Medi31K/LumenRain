# Lumenrain – Design System (Paper)

Figma: https://www.figma.com/design/5wj8aGzwvICBvt7NuCsowP. Siderne er *Exploration*, *Design System* og *Screens*.

## Skrifttyper
| Rolle | Font | Brug |
|---|---|---|
| Overskrifter | Fraunces SemiBold 32/22 | H1, H2, logo |
| UI og brødtekst | Nunito 11–15 | knapper, labels, tekst |
| Matematik | STIX Two Text (+ STIX Two Math) | ligningsfelter, Italic for variable |
| Markdown/kode | DM Sans 12 | `$…$`-forhåndsvisning, kommandoer |

## Farvetokens (CSS: `--lr-*`, skiftes med `data-theme="day|night"`)
| Token | Day | Night |
|---|---|---|
| bg/canvas | #F4ECDD | #1C2130 |
| bg/sheet | #FFFDF7 | #262C3D |
| bg/slip | #F4ECDD | #1F2433 |
| bg/cloud | #FFFFFF | #343C52 |
| bg/accent | #E2674A | #A9B8E0 |
| bg/accent-hover | #C9553A | #8FA0D4 |
| wave/1–4 | #BFD8E6 · #8FB9D1 · #5E93B5 · #3C6E91 | #2B3449 · #323C54 · #3A4560 · #8E9AB8 |
| wind | #FFFFFF | #8E9AB8 |
| text/primary | #2B2A28 | #E6E1D6 |
| text/muted | #7A746A | #9A9AAE |
| text/on-accent | #FFFFFF | #1C2130 |
| text/result | #E2674A | #A9B8E0 |
| text/error | #C8443A | #E59A90 |
| border/cut | #B9B2A6 | #9A9AAE |
| border/focus | #E2674A | #A9B8E0 |

Starter-planen i Figma tillader kun én mode pr. collection. Day og Night er derfor to parallelle collections med samme tokennavne.

## Dimensioner
Spacing 4/8/12/16/24/32 · Radius 4/6/8/16/999

## Papirskygger (effect styles)
- Lift-sm: 0 2 2 / 18 %
- Lift-md: 0 4 6 / 22 %
- Lift-lg: 0 14 24 / 28 % + 0 2 3 / 15 %
- Layer-up: 0 −4 10 / 25 % (bølger)

## Komponenter
- **Button:** Style = Primary / Secondary / Ghost × State = Default / Hover. Har Label-property.
- **Equation Field:** State = Empty (stiplet klippelinje) / Typing (fokuskant + markør) / Result (svar efter ⇒/=) / Error.
- **Autocomplete Item:** Default / Selected. Properties: Command, Glyph, Description.
- **Autocomplete Popup:** vises efter `\`. Tab/Enter accepterer, ↑↓ navigerer.
- **Language Toggle:** EN | DA.
- **Toolbar:** logo, New equation, Fraction, Root, Power, ∑∫(), αβπ, Exact⇄≈, Obsidian, sprogskift.
