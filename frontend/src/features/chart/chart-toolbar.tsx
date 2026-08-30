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
  return (
    <div className="sc-kline-tool-row" aria-label="绘图工具">
      <span className="sc-kline-group-label">绘图工具</span>
      <div className="sc-kline-tool-buttons">
        {drawingTools.map(([tool, label]) => (
          <button
            aria-pressed={activeTool === tool}
            className={`sc-kline-tool-button ${activeTool === tool ? 'is-active' : ''}`}
            key={tool}
            onClick={() => onToolChange(tool)}
            type="button"
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}
