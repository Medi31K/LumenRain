# Lumenrain

A desktop calculator you write in like a Word document: text with live equation fields.
It has a paper-cutout theme in Day and Night, and exports to Obsidian Markdown.

![Lumenrain](docs/screenshot-day.png)

## Features (v0.1 prototype)

- **Word-style writing.** `Alt+M` (or `Alt+=`) inserts an equation field inside the text. An equation alone on a line is a display equation.
- **Live 2D maths (MathLive) with Word build-up rules:**
  - `/` makes a fraction and `^` an exponent. The denominator or exponent ends when you type an operator or a space, so `1/2+1/3` becomes ½ + ⅓.
  - `sqrt(` opens a root and `)` closes it. `\` gives command suggestions.
- **Enter calculates** and the answer is appended in the same field. Pressing Enter again leaves the field.
  - Expressions are given exactly and approximately: `√2/3+π = √2/3+π ≈ 3.613`.
  - Equations are solved: `x²+3x−10=0 ⇒ x=2 ∨ x=−5`.
  - Variables: `m=2.5`, `v=12`, then `E_kin=½·m·v² = 180`. Later fields can use them, and they're listed in the side panel.
- **Result format.** Exact ⇄ ≈ cycles between exact, decimal and both. The number of significant digits is set in Settings.
- **Obsidian export.** Inline maths becomes `$…$` and display maths becomes `$$…$$`. You can copy it, save it as `.md`, and import Markdown back.
- **Paper theme in Day and Night.** The waves sway, the clouds drift and wind gusts pass by. The scenery pauses while you type and respects the OS "reduce motion" setting.
- **English and Danish.** Danish uses a decimal comma (`2,5`).
- Autosave to local storage.

## Develop

```bash
cd app
npm install
npm run dev        # web preview at http://localhost:5173
npm test           # engine + Markdown tests
npm run tauri dev  # desktop window (needs Rust + platform WebView)
npm run tauri build
```

Windows and macOS installers are built by `.github/workflows/desktop.yml`, which uploads them as artifacts.

## Structure

| Path | What |
|---|---|
| `app/src/engine.ts` | Calculation: evaluate, solve and variables (Cortex Compute Engine) |
| `app/src/editor.ts` | Word-style document editor with MathLive fields and build-up rules |
| `app/src/markdown.ts` | Obsidian Markdown export and import |
| `app/src/Background.tsx` | Animated paper scenery |
| `app/src/index.css` | Design tokens (Day/Night) and styles |
| `app/src-tauri/` | Desktop shell |
| `docs/` | Plan and design system |

Design: [Figma](https://www.figma.com/design/5wj8aGzwvICBvt7NuCsowP)
