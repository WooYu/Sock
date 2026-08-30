export type ChartLayerState = { keyLevels: boolean; predictionPaths: boolean; trades: boolean; annotations: boolean }

const layerOptions: Array<[keyof ChartLayerState, string]> = [
  ['keyLevels', '关键位'],
  ['predictionPaths', '预测路径'],
  ['trades', '交易点'],
  ['annotations', '标注'],
]

export function ChartLayerPanel({ layers, onChange }: { layers: ChartLayerState; onChange: (key: keyof ChartLayerState, value: boolean) => void }) {
  const allVisible = layerOptions.every(([key]) => layers[key])

  return (
    <fieldset className="sc-kline-layer-panel">
      <div className="sc-kline-panel-heading">
        <legend>行情图层</legend>
        <button className="sc-kline-quiet-button" onClick={() => layerOptions.forEach(([key]) => onChange(key, !allVisible))} type="button">
          {allVisible ? '全部隐藏' : '全部显示'}
        </button>
      </div>
      <div className="sc-kline-layer-list">
        {layerOptions.map(([key, label]) => (
          <label className="sc-kline-layer-option" key={key}>
            <input aria-label={label} checked={layers[key]} onChange={(event) => onChange(key, event.target.checked)} role="switch" type="checkbox" />
            <span>{label}</span>
          </label>
        ))}
      </div>
      <p className="sc-kline-panel-note">图层开关只影响显示，不会修改行情数据。</p>
    </fieldset>
  )
}
