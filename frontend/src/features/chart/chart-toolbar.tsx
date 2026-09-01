import type { ChartTool } from './chart-annotation-store'

const primaryDrawingTools: Array<[ChartTool, string]> = [
  ['pointer', '指针'],
  ['trend-line', '趋势线'],
  ['rectangle', '矩形'],
  ['marker', '标记'],
]

const secondaryDrawingTools: Array<[ChartTool, string]> = [
  ['horizontal-line', '水平线'],
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
        {primaryDrawingTools.map(([tool, label]) => (
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
        <details className="sc-kline-tool-menu">
          <summary aria-label="更多绘图工具">更多绘图</summary>
          <div className="sc-kline-tool-menu-panel">
            {secondaryDrawingTools.map(([tool, label]) => (
              <button
                aria-pressed={activeTool === tool}
                className={`sc-kline-tool-button ${activeTool === tool ? 'is-active' : ''}`}
                key={tool}
                onClick={() => onToolChange(tool)}
                type="button"
              >
                {tool === 'buy' ? '买入点' : tool === 'sell' ? '卖出点' : tool === 'target' ? '目标位' : tool === 'stop-loss' ? '止损位' : label}
              </button>
            ))}
          </div>
        </details>
      </div>
    </div>
  )
}
