'use client'

import type { DrawingObject, DrawingStyle, TimePricePoint } from './chart-types'

export type DrawingInspectorChange =
  | { type: 'style'; patch: Partial<DrawingStyle> }
  | { type: 'text'; text: string }
  | { type: 'point'; index: number; point: TimePricePoint }
  | { type: 'visible'; visible: boolean }
  | { type: 'locked'; locked: boolean }

type ObjectInspectorProps = {
  drawing: DrawingObject | null
  onChange: (change: DrawingInspectorChange) => void
  onDelete: () => void
}

const kindLabels: Record<DrawingObject['kind'], string> = {
  'trend-line': '趋势线',
  'horizontal-line': '水平线',
  rectangle: '矩形',
  text: '文字',
  buy: '买入点',
  sell: '卖出点',
  target: '目标位',
  'stop-loss': '止损位',
}

function finiteInput(value: number, isValid: (value: number) => boolean, commit: (value: number) => void) {
  if (Number.isFinite(value) && isValid(value)) commit(value)
}

export function ObjectInspector({ drawing, onChange, onDelete }: ObjectInspectorProps) {
  if (!drawing) {
    return <section aria-label="对象属性" className="sc-chart-inspector"><header><p className="sc-eyebrow">对象属性</p><h2>绘图检查器</h2></header><p className="sc-inspector-empty">选择图中对象以编辑属性。</p></section>
  }

  const disabled = drawing.locked
  return (
    <section aria-label="对象属性" className="sc-chart-inspector">
      <header><div><p className="sc-eyebrow">对象属性</p><h2>{kindLabels[drawing.kind]}</h2></div><code>{drawing.id}</code></header>
      <div className="sc-inspector-switches">
        <label><input aria-label="显示对象" checked={drawing.visible} disabled={disabled} onChange={(event) => onChange({ type: 'visible', visible: event.currentTarget.checked })} role="switch" type="checkbox" /><span>显示</span></label>
        <label><input aria-label="锁定对象" checked={drawing.locked} onChange={(event) => onChange({ type: 'locked', locked: event.currentTarget.checked })} role="switch" type="checkbox" /><span>锁定</span></label>
      </div>
      <div className="sc-inspector-fields">
        <label><span>线条颜色</span><input aria-label="线条颜色" disabled={disabled} onChange={(event) => onChange({ type: 'style', patch: { color: event.currentTarget.value } })} type="color" value={drawing.style.color} /></label>
        <label><span>线条宽度</span><input aria-label="线条宽度" disabled={disabled} max="12" min="0.5" onChange={(event) => finiteInput(event.currentTarget.valueAsNumber, (value) => value > 0 && value <= 12, (width) => onChange({ type: 'style', patch: { width } }))} step="0.5" type="number" value={drawing.style.width} /></label>
        <label><span>线型</span><select aria-label="线型" disabled={disabled} onChange={(event) => onChange({ type: 'style', patch: { lineStyle: event.currentTarget.value as DrawingStyle['lineStyle'] } })} value={drawing.style.lineStyle}><option value="solid">实线</option><option value="dashed">虚线</option></select></label>
        <label><span>不透明度</span><input aria-label="不透明度" disabled={disabled} max="1" min="0" onChange={(event) => finiteInput(event.currentTarget.valueAsNumber, (value) => value >= 0 && value <= 1, (opacity) => onChange({ type: 'style', patch: { opacity } }))} step="0.1" type="number" value={drawing.style.opacity} /></label>
        {drawing.kind === 'text' ? <label className="sc-inspector-field-wide"><span>绘图文字</span><input aria-label="绘图文字" disabled={disabled} onChange={(event) => onChange({ type: 'text', text: event.currentTarget.value })} type="text" value={drawing.text ?? ''} /></label> : null}
        {drawing.points.map((point, index) => <label className="sc-inspector-field-wide" key={`${point.time}-${index}`}><span>控制点 {index + 1} 价格</span><input aria-label={`控制点 ${index + 1} 价格`} disabled={disabled} onChange={(event) => finiteInput(event.currentTarget.valueAsNumber, () => true, (price) => onChange({ type: 'point', index, point: { ...point, price } }))} step="0.01" type="number" value={point.price} /></label>)}
      </div>
      <button className="sc-inspector-delete" disabled={disabled} onClick={onDelete} type="button">删除对象</button>
    </section>
  )
}
