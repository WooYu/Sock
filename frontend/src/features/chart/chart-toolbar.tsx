import type { ChartTool } from './chart-annotation-store'

const drawingTools: Array<[ChartTool, string]> = [
  ['pointer', '指针'],
  ['trend-line', '趋势线'],
  ['horizontal-line', '水平线'],
  ['rectangle', '矩形'],
  ['buy', '买入'],
  ['sell', '卖出'],
  ['target', '目标'],
  ['stop-loss', '止损'],
  ['text', '文字'],
]

export function ChartToolbar({ activeTool, onToolChange }: { activeTool: ChartTool; onToolChange: (tool: ChartTool) => void }) {
  return <div className="flex flex-wrap items-center gap-2" aria-label="绘图工具"><span className="mr-1 text-xs font-semibold text-[var(--sc-muted)]">绘图</span>{drawingTools.map(([tool, label]) => <button aria-pressed={activeTool === tool} className={`min-h-12 rounded-xl px-3 text-sm font-semibold ${activeTool === tool ? 'bg-[var(--sc-primary)] text-white' : 'bg-[var(--sc-surface-muted)] text-[var(--sc-muted)]'}`} key={tool} onClick={() => onToolChange(tool)} type="button">{label}</button>)}</div>
}
