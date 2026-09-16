import type { DrawingObject } from '../chart/chart-types'
import { StudioIcon } from './studio-icon'

const names = { 'trend-line': '趋势线', 'horizontal-line': '水平线', rectangle: '矩形', text: '文字', buy: '买入点', sell: '卖出点', target: '目标位', 'stop-loss': '止损位' }
export function DrawingList({ drawings, selectedId, onSelect }: { drawings: DrawingObject[]; selectedId: string | null; onSelect: (id: string) => void }) {
  return <section className="rs-drawing-list" aria-label="已保存的绘图"><h3>已保存的绘图 <span>{drawings.length}</span></h3>{drawings.length ? drawings.map((drawing) => <button type="button" key={drawing.id} aria-pressed={drawing.id === selectedId} onClick={() => onSelect(drawing.id)}><StudioIcon name={drawing.kind} size={15} style={{ color: drawing.style.color }} /><span><strong>{drawing.text || names[drawing.kind]}</strong><small>{drawing.points[0]?.time} · {drawing.points[0]?.price.toFixed(2)}</small></span><small>{drawing.locked ? '已锁定' : drawing.visible ? '' : '已隐藏'}</small></button>) : <p>用画布旁的工具添加趋势线、关键位或文字。</p>}</section>
}
