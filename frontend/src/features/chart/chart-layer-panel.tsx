export type ChartLayerState = { keyLevels: boolean; predictionPaths: boolean; trades: boolean; annotations: boolean }

export function ChartLayerPanel({ layers, onChange }: { layers: ChartLayerState; onChange: (key: keyof ChartLayerState, value: boolean) => void }) {
  return <fieldset className="rounded-xl border border-[var(--sc-border)] p-3"><legend className="px-1 text-sm font-semibold">行情图层</legend><div className="grid gap-2 sm:grid-cols-2">{([['keyLevels', '关键位'], ['predictionPaths', '预测路径'], ['trades', '交易点'], ['annotations', '标注']] as const).map(([key, label]) => <label className="flex min-h-12 items-center gap-2 text-sm text-[var(--sc-muted)]" key={key}><input aria-label={label} checked={layers[key]} onChange={(event) => onChange(key, event.target.checked)} role="switch" type="checkbox" />{label}</label>)}</div></fieldset>
}
