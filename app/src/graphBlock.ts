// The interactive graph block inside a note: curve fields on top, the plot below.
// Drag to pan, scroll to zoom, double-click to fit.

import type { ComputeEngine } from '@cortex-js/compute-engine'
import { MathfieldElement } from 'mathlive'
import { curveFunction } from './engine'
import { DAY_PALETTE, fitView, NIGHT_PALETTE, renderSvg, type Curve, type GraphData, type View } from './graph'

const W = 680
const H = 320

export interface GraphHost {
  engine(): ComputeEngine | null
  changed(): void
  remove(el: HTMLElement): void
}

export type GraphElement = HTMLElement & { graph: GraphController }

function paletteNow() {
  return document.documentElement.dataset.theme === 'night' ? NIGHT_PALETTE : DAY_PALETTE
}

export class GraphController {
  el: GraphElement
  private data: GraphData
  private host: GraphHost
  private list: HTMLElement
  private canvas: HTMLElement
  private readout: HTMLElement
  private curves: Curve[] = []
  private timer: number | undefined

  constructor(data: GraphData, host: GraphHost) {
    this.data = { exprs: data.exprs.length ? [...data.exprs] : ['x^2'], view: data.view }
    this.host = host
    const el = document.createElement('div') as unknown as GraphElement
    el.className = 'graph-block'
    el.contentEditable = 'false'
    el.graph = this
    this.el = el

    this.list = document.createElement('div')
    this.list.className = 'graph-curves'
    this.canvas = document.createElement('div')
    this.canvas.className = 'graph-canvas'
    this.readout = document.createElement('div')
    this.readout.className = 'graph-readout'
    const foot = document.createElement('div')
    foot.className = 'graph-foot'
    const hint = document.createElement('span')
    hint.textContent = 'drag · scroll to zoom · double-click to fit'
    const del = document.createElement('button')
    del.className = 'graph-remove'
    del.textContent = '×'
    del.title = 'Remove graph'
    del.addEventListener('click', () => host.remove(el))
    foot.append(hint, del)
    el.append(this.list, this.canvas, this.readout, foot)

    this.buildList()
    this.bindCanvas()
    this.render()
  }

  toData(): GraphData & { svg: string } {
    const view = this.data.view ?? fitView(this.curves)
    return { exprs: [...this.data.exprs], view: this.data.view, svg: renderSvg(this.curves, view, { width: W, height: H, palette: DAY_PALETTE, labels: true }) }
  }

  private buildList() {
    this.list.replaceChildren()
    this.data.exprs.forEach((latex, i) => {
      const row = document.createElement('div')
      row.className = 'graph-curve'
      const sw = document.createElement('span')
      sw.className = 'graph-swatch'
      sw.style.background = paletteNow().curves[i % 5]
      const mf = new MathfieldElement()
      mf.mathVirtualKeyboardPolicy = 'manual'
      mf.value = latex
      mf.addEventListener('mount', () => (mf.menuItems = []))
      mf.addEventListener('input', () => {
        this.data.exprs[i] = mf.value
        window.clearTimeout(this.timer)
        this.timer = window.setTimeout(() => {
          this.render()
          this.host.changed()
        }, 180)
      })
      mf.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') e.preventDefault()
        e.stopPropagation()
      })
      const x = document.createElement('button')
      x.className = 'graph-x'
      x.textContent = '×'
      x.title = 'Remove curve'
      x.addEventListener('click', () => {
        this.data.exprs.splice(i, 1)
        if (!this.data.exprs.length) this.data.exprs.push('x')
        this.buildList()
        this.render()
        this.host.changed()
      })
      row.append(sw, mf, x)
      this.list.append(row)
    })
    const add = document.createElement('button')
    add.className = 'graph-add'
    add.textContent = '+ curve'
    add.addEventListener('click', () => {
      this.data.exprs.push('')
      this.buildList()
      const fields = this.list.querySelectorAll('math-field')
      ;(fields[fields.length - 1] as MathfieldElement | undefined)?.focus()
    })
    this.list.append(add)
  }

  /** Re-evaluates the curves (variables may have changed) and redraws. */
  render() {
    const ce = this.host.engine()
    const pal = paletteNow()
    this.curves = []
    this.data.exprs.forEach((latex, i) => {
      const fn = ce ? curveFunction(ce, latex) : null
      const row = this.list.children[i] as HTMLElement | undefined
      row?.classList.toggle('bad', !!latex.trim() && !fn)
      const sw = row?.querySelector('.graph-swatch') as HTMLElement | null
      if (sw) sw.style.background = pal.curves[i % 5]
      if (fn) this.curves.push({ fn, color: pal.curves[i % 5], label: latex })
    })
    const view = this.data.view ?? fitView(this.curves)
    this.canvas.innerHTML = renderSvg(this.curves, view, { width: W, height: H, palette: pal })
  }

  private currentView(): View {
    return this.data.view ?? fitView(this.curves)
  }

  private bindCanvas() {
    let drag: { x: number; y: number; view: View } | null = null
    const toUnits = (e: PointerEvent | WheelEvent) => {
      const r = this.canvas.getBoundingClientRect()
      const [x0, x1, y0, y1] = this.currentView()
      return { fx: (e.clientX - r.left) / r.width, fy: (e.clientY - r.top) / r.height, x0, x1, y0, y1, r }
    }
    this.canvas.addEventListener('pointerdown', (e) => {
      drag = { x: e.clientX, y: e.clientY, view: this.currentView() }
      this.canvas.setPointerCapture(e.pointerId)
      this.canvas.classList.add('dragging')
    })
    this.canvas.addEventListener('pointermove', (e) => {
      const u = toUnits(e)
      if (drag) {
        const [x0, x1, y0, y1] = drag.view
        const dx = ((e.clientX - drag.x) / u.r.width) * (x1 - x0)
        const dy = ((e.clientY - drag.y) / u.r.height) * (y1 - y0)
        this.data.view = [x0 - dx, x1 - dx, y0 + dy, y1 + dy]
        this.render()
        return
      }
      const x = u.x0 + u.fx * (u.x1 - u.x0)
      const vals = this.curves.map((c) => {
        const y = c.fn(x)
        return Number.isFinite(y) ? `<span style="color:${c.color}">● ${+y.toPrecision(4)}</span>` : ''
      })
      this.readout.innerHTML = `x = ${+x.toPrecision(4)} ${vals.join(' ')}`
    })
    const end = () => {
      if (drag) this.host.changed()
      drag = null
      this.canvas.classList.remove('dragging')
    }
    this.canvas.addEventListener('pointerup', end)
    this.canvas.addEventListener('pointercancel', end)
    this.canvas.addEventListener('pointerleave', () => (this.readout.textContent = ''))
    this.canvas.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault()
        const u = toUnits(e)
        const k = Math.exp(e.deltaY * 0.0015)
        const cx = u.x0 + u.fx * (u.x1 - u.x0)
        const cy = u.y1 - u.fy * (u.y1 - u.y0)
        this.data.view = [cx + (u.x0 - cx) * k, cx + (u.x1 - cx) * k, cy + (u.y0 - cy) * k, cy + (u.y1 - cy) * k]
        this.render()
        window.clearTimeout(this.timer)
        this.timer = window.setTimeout(() => this.host.changed(), 400)
      },
      { passive: false },
    )
    this.canvas.addEventListener('dblclick', () => {
      this.data.view = null
      this.render()
      this.host.changed()
    })
  }
}
