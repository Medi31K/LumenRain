# Lumenrain – plan (v1)

Figma (low-fi): https://www.figma.com/design/5wj8aGzwvICBvt7NuCsowP

## Mål
En selvstændig desktop-lommeregner (Windows/macOS), hvor man skriver matematik lige så nemt som i WordMat: tekst-genveje bliver straks til pæn 2D-matematik. Den får et eget tema i glas/blød moderne stil.

## Scope v1
- Dokument som i Word: almindelig tekst med indlejrede ligningsfelter (Alt+M indsætter et nyt felt). Feltet har håndtag ⋮ og menu ▾.
- Enter i et felt beregner, og resultatet tilføjes efter "=" i samme felt.
- Live 2D-input: `/` giver brøk, `^` potens, `_` indeks, `sqrt` kvadratrod, `pi` π, græske bogstaver.
- Autoforslag-popup (Tab/Enter). Piletaster navigerer i brøker og rødder.
- Variable (`m = 2,5`), som genbruges i senere linjer. Historik i sidepanelet.
- Eksakt ⇄ decimal, valg af antal decimaler, Rad/Deg, dansk decimalkomma.
- Ligningsløsning (CAS): løs, reducér, faktorisér. `løs(x^2-4=0)` giver `x = −2 ∨ x = 2`.
- **Obsidian/Markdown-eksport:** Hele dokumentet kopieres 1:1 til Markdown. Brødtekst forbliver tekst, et ligningsfelt inde i en linje bliver til `$…$`, og et felt på sin egen linje bliver til `$$…$$`. Indholdet er LaTeX, som Obsidian kan læse (MathJax).
  - Eksempel: `$$E_{kin}=\frac{1}{2}\cdot m\cdot v^2=180\text{ J}$$`
  - Ved import (indsæt Markdown) parses `$`/`$$` tilbage til ligningsfelter.
- Tema: Glas lys, Glas mørk og Følg system. Accentfarve og blur-styrke kan vælges.

Udenfor v1: grafer, enheder/konstanter (kandidater til v2).

## Teknologi (forslag)
| Del | Valg | Hvorfor |
|---|---|---|
| App-skal | Tauri 2 | Lille binær, native vinduer på Win/Mac, understøtter vibrancy/acrylic (ægte glas) |
| UI | React + TypeScript | |
| 2D-editor | MathLive | WordMat-agtig indtastning, LaTeX/MathML-eksport |
| Beregning + CAS | Cortex Compute Engine (følger med MathLive) | Læser LaTeX direkte, eksakte brøker/rødder, løser ligninger |
| Gem | Lokale .lmr-filer (JSON) + autosave | |

## Faser
1. Low-fi-skitser + plan ✅
2. Design system i Figma: farver, papirlag, typografi, komponenter ✅
3. Hi-fi-skærme (lys + mørk). Delvist: Figma-grænsen blev nået, og prototypen bruges i stedet ✅
4. Prototype: Tauri-skal, MathLive og Compute Engine ← **nu (v0.1)**
5. Variable, historik, eksport og indstillinger
6. Test (enhedstest af parser/motor), installers til Win/Mac

## Skærme (low-fi)
1. Regneark: Word-dokument med ligningsfelter
2. Live 2D-input + autoforslag
3. Resultat-handlinger
4. Indstillinger & tema

## Tema-kandidater (Figma-side "Temaer")
- A · Aurora Night: mørk, med nordlys-orbs i teal, violet og rose bag frostet glas
- B · Liquid Daylight: lyst perlemor-glas (Liquid Glass-inspireret) med azur-accent
- C · Rosé Rain: skumring i rosé og guld (Rosé Pine-inspireret)
- **Valgt retning: Paper cutout ("Lumenrain · Paper")**: både lys og mørk tilstand
  - Day: cremefarvet karton, blå papirbølger og hvide papirskyer. Accentfarven er terracotta `#E2674A`.
  - Night: dæmpet skumring `#1C2130` med lav kontrast. Accentfarven er periwinkle `#A9B8E0`. Ingen måne/sol.
  - Skrivearket er lige og centreret, uden tape. Ligningsfelter er papirlapper, og tomme felter har en stiplet kant.
  - Baggrunden bevæger sig langsomt: bølgerne vugger (parallax, 9–15 s), skyerne driver, og vindstrøg (papirstrimler) suser forbi hvert 6.–12. sekund. Ingen regn.
  - Bevægelsen stopper, mens man skriver, følger OS-indstillingen "reduce motion" og kan slås fra i indstillingerne.

## Sprog
Engelsk som primært sprog, dansk som alternativ (i18n fra start; skift under Settings og som EN | DA-knap).
