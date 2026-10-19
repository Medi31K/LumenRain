# Lommeregner – plan (v1)

Figma (low-fi): https://www.figma.com/design/5wj8aGzwvICBvt7NuCsowP

## Mål
En selvstændig desktop-lommeregner (Windows/macOS), hvor man skriver matematik lige så nemt som i WordMat: tekst-genveje bliver straks til pæn 2D-matematik. Den får et eget tema i glas/blød moderne stil.

## Scope v1
- Regneark med én beregning pr. linje. Enter giver resultat.
- Live 2D-input: `/` giver brøk, `^` potens, `_` indeks, `sqrt` kvadratrod, `pi` π, græske bogstaver.
- Autoforslag-popup (Tab/Enter). Piletaster navigerer i brøker og rødder.
- Variable (`m = 2,5`), som genbruges i senere linjer. Historik i sidepanelet.
- Eksakt ⇄ decimal, valg af antal decimaler, Rad/Deg, dansk decimalkomma.
- Kopiér som tekst / LaTeX / Word-ligning (MathML).
- Tema: Glas lys, Glas mørk og Følg system. Accentfarve og blur-styrke kan vælges.

Udenfor v1: CAS/ligningsløsning, grafer, enheder/konstanter (kandidater til v2).

## Teknologi (forslag)
| Del | Valg | Hvorfor |
|---|---|---|
| App-skal | Tauri 2 | Lille binær, native vinduer på Win/Mac, understøtter vibrancy/acrylic (ægte glas) |
| UI | React + TypeScript | |
| 2D-editor | MathLive | WordMat-agtig indtastning, LaTeX/MathML-eksport |
| Beregning | math.js (BigNumber + Fraction) | Eksakte brøker, ingen 0,1+0,2-fejl |
| Gem | Lokale .lmr-filer (JSON) + autosave | |

## Faser
1. Low-fi-skitser + plan ← **nu**
2. Design system i Figma: farver, glas-lag, typografi, komponenter
3. Hi-fi-skærme (lys + mørk) og godkendelse
4. Prototype: Tauri-skal + MathLive + math.js-motor
5. Variable, historik, eksport og indstillinger
6. Test (enhedstest af parser/motor), installers til Win/Mac

## Skærme (low-fi)
1. Regneark (hovedvindue)
2. Live 2D-input + autoforslag
3. Resultat-handlinger
4. Indstillinger & tema
