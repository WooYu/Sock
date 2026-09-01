"use client";

import { useEffect, useMemo, useState } from "react";

import { getReachableRange, shrinkReliability } from "@/features/socksample/lib/analysis.mjs";
import { loadPrototypeState, savePrototypeState } from "@/features/socksample/lib/prototype-store.mjs";
import { calculateFees, calculatePositionState, validateTrade } from "@/features/socksample/lib/trading.mjs";
import { calculateReviewSummary } from "@/features/socksample/lib/review.mjs";
import { actionLabel, adjustPriceForCompanyActions } from "@/features/socksample/lib/market-actions.mjs";
import { calculateBacktestSummary } from "@/features/socksample/lib/backtest.mjs";
import { evaluatePredictionRecords } from "@/features/socksample/lib/prediction-evaluation.mjs";
import { calculatePortfolioSummary } from "@/features/socksample/lib/portfolio.mjs";
import { parseAnnotations, serializeAnnotations } from "@/features/socksample/lib/annotation-io.mjs";
import { clientToChartPoint, updateView } from "@/features/socksample/lib/chart-view.mjs";
import { updateAnnotationFromDrag } from "@/features/socksample/lib/annotation-geometry.mjs";
import { aggregateCandles } from "@/features/socksample/lib/candle-aggregation.mjs";
import { defaultIndicatorConfig, normalizeIndicatorConfig } from "@/features/socksample/lib/indicator-config.mjs";
import {
  candles,
  cycleProfiles,
  rules as initialRules,
  stock,
  type CycleKey,
  type CycleProfile,
  type KeyZone,
} from "@/features/socksample/lib/demo-data";

const cycleOrder: CycleKey[] = ["short", "swing", "long"];

function formatPrice(value: number) {
  return value.toFixed(2);
}

function Strength({ value }: { value: number }) {
  return (
    <span className="strength" aria-label={`共振强度 ${value} 级`}>
      {Array.from({ length: 4 }).map((_, index) => (
        <i key={index} className={index < value ? "is-on" : ""} />
      ))}
    </span>
  );
}

function SectionHeading({
  eyebrow,
  title,
  aside,
}: {
  eyebrow: string;
  title: string;
  aside?: React.ReactNode;
}) {
  return (
    <div className="section-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
      </div>
      {aside}
    </div>
  );
}

function ZoneCard({
  zone,
  expanded,
  onToggle,
}: {
  zone: KeyZone;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <article className={`zone-card ${zone.tone} ${expanded ? "is-expanded" : ""}`}>
      <button className="zone-main" onClick={onToggle} aria-expanded={expanded}>
        <span className="zone-kicker">
          <span>{zone.label}</span>
          <em>{zone.role}</em>
        </span>
        <span className="zone-price-row">
          <strong>{formatPrice(zone.price)}</strong>
          <span className="zone-range">
            {formatPrice(zone.range[0])}～{formatPrice(zone.range[1])}
          </span>
        </span>
        <span className="zone-metrics">
          <span>
            <small>模型触达概率</small>
            <b>{zone.probability}%</b>
          </span>
          <span>
            <small>预计触达</small>
            <b>{zone.touches.toFixed(1)} 次</b>
          </span>
          <span>
            <small>观察窗口</small>
            <b>{zone.window}</b>
          </span>
        </span>
        <span className="zone-footer">
          <span className="resonance-label">
            共振 <Strength value={zone.strength} />
          </span>
          <span className="expand-label">{expanded ? "收起依据" : "展开依据"} <i>⌄</i></span>
        </span>
      </button>

      {expanded && (
        <div className="zone-detail">
          <p>{zone.note}</p>
          <div className="condition-grid">
            <span><i className="condition-dot trigger" />触发：{zone.trigger}</span>
            <span><i className="condition-dot invalid" />失效：{zone.invalidation}</span>
          </div>
          <div className="source-list" role="table" aria-label={`${zone.label}原始来源`}>
            {zone.sources.map((source) => (
              <div className="source-row" role="row" key={`${zone.id}-${source.name}`}>
                <span className="source-name" role="cell">{source.name}</span>
                <span className="source-origin" data-origin={source.origin} role="cell">{source.origin}</span>
                <span className="mono" role="cell">{source.price.toFixed(2)}</span>
                <span className="weight" role="cell">×{source.weight}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </article>
  );
}

type ChartDrawing = { id: number; tool: string; x: number; y: number; x2?: number; y2?: number; price?: number; label?: string; hidden?: boolean };

const drawingLabels: Record<string, string> = {
  marker: "标记", buy: "买入", sell: "卖出", target: "目标", stop: "止损", note: "备注",
};

function PriceChart({ profile }: { profile: CycleProfile }) {
  const [activeTool, setActiveTool] = useState("pointer");
  const [period, setPeriod] = useState<"日线" | "周线" | "月线">("日线");
  const [noteText, setNoteText] = useState("");
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [visibleLines, setVisibleLines] = useState<Record<string, boolean>>({
    MA5: true, MA10: true, MA20: true, MA30: false, MA60: false, MA120: false, MA250: false,
    BOLL上轨: true, BOLL中轨: true, BOLL下轨: true,
  });
  const [drawings, setDrawings] = useState<ChartDrawing[]>([]);
  const [redoDrawings, setRedoDrawings] = useState<ChartDrawing[]>([]);
  const [drawingVisibility, setDrawingVisibility] = useState({ all: true, trend: true, rect: true, point: true, hline: true });
  const [selectedDrawingId, setSelectedDrawingId] = useState<number | null>(null);
  const [editingDrawingId, setEditingDrawingId] = useState<number | null>(null);
  const [editDrag, setEditDrag] = useState<{ handle: string; start: { x: number; y: number }; origin: ChartDrawing } | null>(null);
  const [annotationNotice, setAnnotationNotice] = useState<string | null>(null);
  const [layers, setLayers] = useState({ actual: true, predictionLevels: true, predictionPath: true, predictionIndicators: true });
  const [view, setView] = useState({ zoom: 1, panX: 0, panY: 0 });
  const [crosshair, setCrosshair] = useState<{ x: number; y: number } | null>(null);
  const [indicatorConfig, setIndicatorConfig] = useState(defaultIndicatorConfig);
  const chart = { width: 760, height: 320, left: 54, right: 20, top: 22, bottom: 42 };
  const min = 30.5;
  const max = 34.5;
  const y = (price: number) =>
    chart.top + ((max - price) / (max - min)) * (chart.height - chart.top - chart.bottom);
  const yToPrice = (point: number) => max - ((point - chart.top) / (chart.height - chart.top - chart.bottom)) * (max - min);
  const candleStep = 30;
  const firstX = 66;
  const demoDates = candles.map((_, index) => `2026-07-${String(index + 1).padStart(2, "0")}`);
  const chartCandles = period === "日线" ? candles : aggregateCandles(candles, demoDates, period).map((item) => item.values);
  const futureStart = firstX + chartCandles.length * candleStep + 14;
  const chartRight = chart.width - chart.right;
  const pointFromEvent = (event: React.PointerEvent<SVGElement>) => clientToChartPoint({ x: event.clientX, y: event.clientY }, event.currentTarget.getBoundingClientRect(), view, chart);

  const closes = chartCandles.map((item) => item[3]);
  const movingAverageFor = (period: number) => closes.map((_, index) => {
    const values = closes.slice(Math.max(0, index - period + 1), index + 1);
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  });
  const maFuture = profile.future.map((day) => day.points.find((point) => point.label === "MA5")!.price);
  const bollFuture = profile.future.map((day) => day.points.find((point) => point.label === "BOLL上")!.price);
  const maColors = ["#d6a12a", "#4e9bd6", "#a46ee8", "#d56c9a", "#45a88b", "#e17b43", "#65738a"];
  const maConfig = indicatorConfig.maPeriods.map((item, index) => [`MA${item}`, item, maColors[index % maColors.length]] as const);
  const bollSeries = {
    BOLL上轨: chartCandles.map((item) => item[1] + indicatorConfig.bollDeviation * 0.31),
    BOLL中轨: movingAverageFor(indicatorConfig.bollPeriod),
    BOLL下轨: chartCandles.map((item) => item[2] - indicatorConfig.bollDeviation * 0.31),
  };
  const maLabels = maConfig.map(([label]) => label);
  const bollLabels = Object.keys(bollSeries);
  const indicatorLabels = [...maLabels, ...bollLabels];
  const setIndicatorVisibility = (labels: string[], visible: boolean) => setVisibleLines((current) =>
    Object.fromEntries(Object.entries(current).map(([label, value]) => [label, labels.includes(label) ? visible : value])) as Record<string, boolean>,
  );
  const visibleIndicatorCount = indicatorLabels.filter((label) => visibleLines[label]).length;
  const annotationKey = `${stock.code}-${period}-2026-08-14`;
  useEffect(() => {
    const saved = loadPrototypeState(window.localStorage).chartPreferences as { indicatorConfig?: typeof defaultIndicatorConfig } | undefined;
    // Restore persisted chart preferences once the browser storage is available.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (saved?.indicatorConfig) setIndicatorConfig(normalizeIndicatorConfig(saved.indicatorConfig));
  }, []);
  useEffect(() => {
    const state = loadPrototypeState(window.localStorage);
    savePrototypeState(window.localStorage, { ...state, chartPreferences: { ...(state as typeof state & { chartPreferences?: object }).chartPreferences, indicatorConfig } });
  }, [indicatorConfig]);
  useEffect(() => {
    const saved = loadPrototypeState(window.localStorage).annotations.filter((item: { key?: string }) => item.key === annotationKey);
    // The effect restores an external localStorage snapshot when the K-line period changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDrawings(saved.map((item: { id: number; tool: string; x: number; y: number; x2?: number; y2?: number; price?: number; label?: string; hidden?: boolean }) => ({ id: item.id, tool: item.tool, x: item.x, y: item.y, x2: item.x2, y2: item.y2, price: item.price, label: item.label, hidden: item.hidden })));
  }, [annotationKey]);
  const addDrawing = (drawing: Omit<ChartDrawing, "id">) => {
    setDrawings((current) => [...current, { ...drawing, id: Date.now() + current.length }]);
    setRedoDrawings([]);
    setAnnotationNotice(null);
  };
  const undoDrawing = () => setDrawings((current) => {
    if (current.length === 0) return current;
    const next = current.slice(0, -1);
    setRedoDrawings((redo) => [...redo, current[current.length - 1]]);
    return next;
  });
  const redoDrawing = () => setRedoDrawings((current) => {
    const drawing = current[current.length - 1];
    if (!drawing) return current;
    setDrawings((items) => [...items, drawing]);
    return current.slice(0, -1);
  });
  const deleteDrawing = () => {
    if (selectedDrawingId === null) return;
    setDrawings((current) => current.filter((drawing) => drawing.id !== selectedDrawingId));
    setSelectedDrawingId(null);
  };
  const toggleSelectedVisibility = () => {
    if (selectedDrawingId === null) return;
    setDrawings((current) => current.map((drawing) => drawing.id === selectedDrawingId ? { ...drawing, hidden: !drawing.hidden } : drawing));
  };
  const toggleDrawingGroup = (group: "all" | "trend" | "rect" | "point" | "hline") => setDrawingVisibility((current) => ({ ...current, [group]: !current[group] }));
  const maVisibleCount = maLabels.filter((label) => visibleLines[label]).length;
  const bollVisibleCount = bollLabels.filter((label) => visibleLines[label]).length;
  const toggleIndicatorGroup = (labels: string[], currentlyVisible: boolean) => setIndicatorVisibility(labels, !currentlyVisible);
  const indicatorToggleLabel = (label: string, visible: boolean) => `${label}，当前${visible ? "显示" : "隐藏"}，点击${visible ? "隐藏" : "显示"}`;
  const saveAnnotations = () => {
    const state = loadPrototypeState(window.localStorage);
    const otherAnnotations = state.annotations.filter((item: { key?: string }) => item.key !== annotationKey);
    savePrototypeState(window.localStorage, { ...state, annotations: [...otherAnnotations, ...drawings.map((drawing) => ({ ...drawing, key: annotationKey, stockCode: stock.code, validDate: "2026-08-14" }))] });
    setAnnotationNotice(`${period}标注已保存`);
  };
  const exportAnnotations = () => {
    const raw = serializeAnnotations(drawings, { stockCode: stock.code, period });
    const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([raw], { type: "application/json" })); link.download = `${stock.code}-${period}-标注.json`; link.click(); URL.revokeObjectURL(link.href); setAnnotationNotice("标注已导出");
  };
  const importAnnotations = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; if (!file) return;
    file.text().then((raw) => { try { const imported = parseAnnotations(raw, { stockCode: stock.code, period }); setDrawings((current) => [...current, ...imported.map((item) => ({ ...item, id: Date.now() + Math.random() }))]); setAnnotationNotice(`已导入 ${imported.length} 条标注`); } catch (error) { setAnnotationNotice(error instanceof Error ? error.message : "导入失败"); } }); event.target.value = "";
  };
  const finishEditing = () => { setEditDrag(null); setEditingDrawingId(null); };
  const startEditDrag = (event: React.PointerEvent<SVGElement>, drawing: ChartDrawing, handle: string) => {
    if (editingDrawingId !== drawing.id) return;
    event.stopPropagation(); event.currentTarget.setPointerCapture?.(event.pointerId);
    setEditDrag({ handle, start: pointFromEvent(event), origin: { ...drawing } });
  };
  const upperZone = profile.zones[0];
  const supportZone = profile.zones[2];

  return (
    <div className="chart-wrap chart-terminal">
      <div className="chart-terminal-head">
        <div><p className="eyebrow">价格结构</p><h3>日线与未来指标延伸</h3><span>真实行情 + 未来 3 日指标推演 · K线数据与绘图数据独立</span></div>
        <div className="period-switches" role="group" aria-label="K线周期">
          {(["日线", "周线", "月线"] as const).map((item) => <button key={item} className={period === item ? "active" : ""} aria-pressed={period === item} onClick={() => { finishEditing(); setPeriod(item); setDrawings([]); setRedoDrawings([]); setSelectedDrawingId(null); }}>{item}</button>)}
        </div>
      </div>
      <div className="chart-primary-toolbar" aria-label="K线工具栏">
        <div className="chart-primary-actions">
          {[["pointer", "指针"], ["trend", "趋势线"], ["rect", "矩形"], ["marker", "标记"]].map(([tool, label]) => <button key={tool} className={activeTool === tool ? "active" : ""} aria-pressed={activeTool === tool} aria-label={`选择${label}工具`} onClick={() => { finishEditing(); setActiveTool(tool); }}>{label}</button>)}
          <details className="chart-menu drawing-menu"><summary aria-label="更多绘图工具">更多绘图</summary><div className="chart-menu-panel compact-menu">{[["crosshair", "十字光标"], ["hline", "水平线"], ["buy", "买入点"], ["sell", "卖出点"], ["target", "目标位"], ["stop", "止损位"], ["note", "文字备注"]].map(([tool, label]) => <button key={tool} className={activeTool === tool ? "active" : ""} aria-pressed={activeTool === tool} onClick={() => setActiveTool(tool)}>{label}</button>)}</div></details>
          <span className="chart-tool-divider" />
          <button onClick={undoDrawing} disabled={drawings.length === 0}>撤销</button>
          <button onClick={redoDrawing} disabled={redoDrawings.length === 0}>重做</button>
          <button className={editingDrawingId !== null ? "active" : ""} onClick={() => editingDrawingId === null ? setEditingDrawingId(selectedDrawingId) : finishEditing()} disabled={selectedDrawingId === null}>{editingDrawingId === null ? "编辑标注" : "完成编辑"}</button>
        </div>
        <div className="chart-secondary-actions" aria-label="指标设置与指标参数">
          <details className="chart-menu indicator-menu"><summary>指标</summary><div className="chart-menu-panel indicator-menu-panel"><div className="indicator-setting-group"><div><button className={`indicator-group-toggle ${maVisibleCount > 0 ? "active" : ""}`} aria-pressed={maVisibleCount > 0} onClick={() => toggleIndicatorGroup(maLabels, maVisibleCount > 0)}>MA均线 <small>{maVisibleCount}/{maLabels.length}</small></button></div><div className="indicator-chips">{maConfig.map(([label, , color]) => { const visible = visibleLines[label]; const stateLabel = indicatorToggleLabel(label, visible); return <button key={label} className={visible ? "active" : ""} style={{ "--indicator-color": color } as React.CSSProperties} onClick={() => setVisibleLines((current) => ({ ...current, [label]: !current[label] }))} aria-pressed={visible} aria-label={stateLabel} title={stateLabel} data-indicator-state={visible ? "visible" : "hidden"}><span>{label}</span><i aria-hidden="true" /></button>; })}</div></div><div className="indicator-setting-group"><div><button className={`indicator-group-toggle ${bollVisibleCount > 0 ? "active" : ""}`} aria-pressed={bollVisibleCount > 0} onClick={() => toggleIndicatorGroup(bollLabels, bollVisibleCount > 0)}>BOLL指标 <small>{bollVisibleCount}/{bollLabels.length}</small></button></div><div className="indicator-chips">{Object.entries(bollSeries).map(([label]) => { const visible = visibleLines[label]; const stateLabel = indicatorToggleLabel(label, visible); return <button key={label} className={visible ? "active boll-switch" : "boll-switch"} onClick={() => setVisibleLines((current) => ({ ...current, [label]: !current[label] }))} aria-pressed={visible} aria-label={stateLabel} title={stateLabel} data-indicator-state={visible ? "visible" : "hidden"}><span>{label}</span><i aria-hidden="true" /></button>; })}</div></div><span className="indicator-count">已显示 {visibleIndicatorCount}/{indicatorLabels.length} 条指标线</span><div className="indicator-parameter-form"><label>MA 周期<input value={indicatorConfig.maPeriods.join(",")} onChange={(event) => setIndicatorConfig(normalizeIndicatorConfig({ ...indicatorConfig, maPeriods: event.target.value.split(",") }))} /></label><label>BOLL 周期<input type="number" min="2" max="250" value={indicatorConfig.bollPeriod} onChange={(event) => setIndicatorConfig(normalizeIndicatorConfig({ ...indicatorConfig, bollPeriod: event.target.value }))} /></label><label>标准差<input type="number" min="0.5" max="5" step="0.5" value={indicatorConfig.bollDeviation} onChange={(event) => setIndicatorConfig(normalizeIndicatorConfig({ ...indicatorConfig, bollDeviation: event.target.value }))} /></label></div></div></details>
          <details className="chart-menu"><summary>图层</summary><div className="chart-menu-panel compact-menu">{[["actual", "实际行情"], ["predictionLevels", "预测关键位"], ["predictionPath", "预测路径"], ["predictionIndicators", "预测MA/BOLL"]].map(([id, label]) => <button key={id} className={layers[id as keyof typeof layers] ? "active" : ""} onClick={() => setLayers((current) => ({ ...current, [id]: !current[id as keyof typeof layers] }))} aria-pressed={layers[id as keyof typeof layers]}>{label}</button>)}</div></details>
          <details className="chart-menu"><summary>标注管理</summary><div className="chart-menu-panel compact-menu"><button onClick={toggleSelectedVisibility} disabled={selectedDrawingId === null}>隐藏选中</button><button onClick={deleteDrawing} disabled={selectedDrawingId === null}>删除标注</button><button className="save-annotation" onClick={saveAnnotations}>保存标注</button><button onClick={exportAnnotations}>导出标注</button><label className="import-annotation">导入标注<input type="file" accept="application/json" onChange={importAnnotations} /></label><button onClick={() => { setRedoDrawings((current) => [...current, ...drawings]); setDrawings([]); setSelectedDrawingId(null); }}>清除全部</button><button className={drawingVisibility.all ? "active" : ""} onClick={() => toggleDrawingGroup("all")}>全部标注</button><button className={drawingVisibility.trend ? "active" : ""} onClick={() => toggleDrawingGroup("trend")}>趋势线</button><button className={drawingVisibility.rect ? "active" : ""} onClick={() => toggleDrawingGroup("rect")}>矩形框</button><button className={drawingVisibility.point ? "active" : ""} onClick={() => toggleDrawingGroup("point")}>点位标注</button><button className={drawingVisibility.hline ? "active" : ""} onClick={() => toggleDrawingGroup("hline")}>水平线</button></div></details>
          <details className="chart-menu more-menu"><summary>更多</summary><div className="chart-menu-panel compact-menu"><button onClick={() => setView((current) => updateView(current, { zoom: current.zoom + .25 }))}>放大</button><button onClick={() => setView((current) => updateView(current, { zoom: current.zoom - .25 }))}>缩小</button><button onClick={() => setView((current) => updateView(current, { panX: current.panX - 40 }))}>向左平移</button><button onClick={() => setView((current) => updateView(current, { panX: current.panX + 40 }))}>向右平移</button><button onClick={() => setView({ zoom: 1, panX: 0, panY: 0 })}>重置视图</button></div></details>
        </div>
        {activeTool === "note" && <label className="note-input active"><span>备注内容</span><input value={noteText} onChange={(event) => setNoteText(event.target.value)} placeholder="输入标注备注" /></label>}
        {annotationNotice && <span className="annotation-notice">{annotationNotice}</span>}
      </div>
      <div className="chart-stage">
      <div className="chart-legend">
        {layers.actual && <span><i className="legend-actual" />实际行情</span>}
        {layers.predictionPath && <span><i className="legend-prediction" />预测路径</span>}
        {maConfig.filter(([label]) => visibleLines[label]).map(([label, , color]) => <span key={label}><i style={{ background: color }} />{label}</span>)}
        {Object.entries(bollSeries).filter(([label]) => visibleLines[label]).map(([label]) => <span key={label}><i className="legend-boll" />{label}</span>)}
        <span><i className="legend-zone" />共振区域</span>
      </div>
      <svg viewBox={`${-view.panX} ${-view.panY} ${chart.width / view.zoom} ${chart.height / view.zoom}`} role="img" aria-label={`${period}价格与未来三日指标延伸图`} onPointerMove={(event) => { const point = pointFromEvent(event); setCrosshair(point); if (editingDrawingId !== null && editDrag) setDrawings((current) => current.map((item) => item.id === editingDrawingId ? updateAnnotationFromDrag(editDrag.origin, editDrag, point, chart) : item)); }} onPointerLeave={() => setCrosshair(null)} onPointerDown={(event) => {
        if (editingDrawingId !== null) return;
        if (activeTool !== "trend" && activeTool !== "rect") return;
        const bounds = event.currentTarget.getBoundingClientRect();
        setDragStart({ x: ((event.clientX - bounds.left) / bounds.width) * chart.width, y: ((event.clientY - bounds.top) / bounds.height) * chart.height });
      }} onPointerUp={(event) => {
        if (editingDrawingId !== null) { setEditDrag(null); event.currentTarget.releasePointerCapture?.(event.pointerId); return; }
        if (!dragStart || (activeTool !== "trend" && activeTool !== "rect")) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        const x = ((event.clientX - bounds.left) / bounds.width) * chart.width;
        const yPoint = ((event.clientY - bounds.top) / bounds.height) * chart.height;
        addDrawing({ tool: activeTool, x: dragStart.x, y: dragStart.y, x2: x, y2: yPoint });
        setDragStart(null);
      }} onClick={(event) => {
        if (activeTool === "pointer") return;
        if (activeTool === "trend" || activeTool === "rect") return;
        const bounds = event.currentTarget.getBoundingClientRect();
        const x = ((event.clientX - bounds.left) / bounds.width) * chart.width;
        const yPoint = ((event.clientY - bounds.top) / bounds.height) * chart.height;
        const price = yToPrice(yPoint);
        const label = activeTool === "note" ? (noteText.trim() || "备注") : drawingLabels[activeTool] ? `${drawingLabels[activeTool]} ${formatPrice(price)}` : undefined;
        addDrawing({ tool: activeTool, x, y: yPoint, price, label });
      }}>
        <defs>
          <linearGradient id="futureShade" x1="0" x2="1">
            <stop offset="0" stopColor="#4868ff" stopOpacity="0.08" />
            <stop offset="1" stopColor="#4868ff" stopOpacity="0.015" />
          </linearGradient>
          <pattern id="zonePattern" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="6" stroke="currentColor" strokeOpacity="0.2" strokeWidth="2" />
          </pattern>
        </defs>

        {[31, 32, 33, 34].map((price) => (
          <g key={price}>
            <line x1={chart.left} y1={y(price)} x2={chartRight} y2={y(price)} className="grid-line" />
            <text x="12" y={y(price) + 4} className="axis-label">{price.toFixed(2)}</text>
          </g>
        ))}

        {layers.predictionPath && <><rect x={futureStart - 22} y={chart.top} width={chartRight - futureStart + 22} height={chart.height - chart.top - chart.bottom} fill="url(#futureShade)" /><line x1={futureStart - 22} y1={chart.top} x2={futureStart - 22} y2={chart.height - chart.bottom} className="future-line" /><text x={futureStart - 14} y="16" className="future-label">未来 3 日推演</text></>}

        {layers.predictionLevels && <rect
          x={futureStart - 22}
          y={y(upperZone.range[1])}
          width={chartRight - futureStart + 22}
          height={Math.max(5, y(upperZone.range[0]) - y(upperZone.range[1]))}
          className="zone-band rise"
        />}
        {layers.predictionLevels && <rect
          x={futureStart - 22}
          y={y(supportZone.range[1])}
          width={chartRight - futureStart + 22}
          height={Math.max(5, y(supportZone.range[0]) - y(supportZone.range[1]))}
          className="zone-band fall"
        />}

        {layers.actual && chartCandles.map(([open, high, low, close], index) => {
          const x = firstX + index * candleStep;
          const isRise = close >= open;
          const top = y(Math.max(open, close));
          const height = Math.max(2, Math.abs(y(open) - y(close)));
          return (
            <g key={index} className={isRise ? "candle rise" : "candle fall"}>
              <line x1={x} y1={y(high)} x2={x} y2={y(low)} />
              <rect x={x - 6} y={top} width="12" height={height} rx="1" />
            </g>
          );
        })}

        {crosshair && activeTool === "crosshair" && <g className="live-crosshair"><line x1={chart.left} y1={crosshair.y} x2={chartRight} y2={crosshair.y} /><line x1={crosshair.x} y1={chart.top} x2={crosshair.x} y2={chart.height - chart.bottom} /><text x={chart.left + 4} y={crosshair.y - 5}>{yToPrice(crosshair.y).toFixed(2)}</text></g>}

        {maConfig.map(([label, period, color]) => {
          if (!visibleLines[label]) return null;
          const values = movingAverageFor(period);
          const actualPoints = values.map((price, index) => `${firstX + index * candleStep},${y(price)}`).join(" ");
          const futurePoints = label === "MA5" ? maFuture.map((price, index) => `${futureStart + index * 54},${y(price)}`).join(" ") : "";
          return <g key={label}>{layers.actual && <polyline points={actualPoints} className="indicator-line" style={{ stroke: color }} />}{layers.predictionIndicators && futurePoints && <polyline points={futurePoints} className="indicator-line prediction-line" style={{ stroke: color }} />}</g>;
        })}
        {Object.entries(bollSeries).map(([label, values]) => {
          if (!visibleLines[label]) return null;
          const future = label === "BOLL上轨" ? bollFuture : profile.future.map((day) => day.points.find((point) => point.label === "BOLL中")!.price);
          const actualPoints = values.map((price, index) => `${firstX + index * candleStep},${y(price)}`).join(" ");
          const futurePoints = future.map((price, index) => `${futureStart + index * 54},${y(price)}`).join(" ");
          const className = `indicator-line ${label === "BOLL上轨" ? "boll-line" : "boll-secondary"}`;
          return <g key={label}>{layers.actual && <polyline points={actualPoints} className={className} />}{layers.predictionIndicators && <polyline points={futurePoints} className={`${className} prediction-line`} />}</g>;
        })}
        {layers.predictionIndicators && visibleLines.MA5 && maFuture.map((price, index) => <circle key={`ma-${index}`} cx={futureStart + index * 54} cy={y(price)} r="3.5" className="ma-point" />)}
        {layers.predictionIndicators && visibleLines.BOLL上轨 && bollFuture.map((price, index) => <circle key={`boll-${index}`} cx={futureStart + index * 54} cy={y(price)} r="3" className="boll-point" />)}

        {drawings.filter((drawing) => !drawing.hidden && drawingVisibility.all && drawingVisibility[drawing.tool === "trend" ? "trend" : drawing.tool === "rect" ? "rect" : drawing.tool === "hline" ? "hline" : "point"]).map((drawing) => {
          const selected = selectedDrawingId === drawing.id;
          const onSelect = (event: React.MouseEvent) => { event.stopPropagation(); if (editingDrawingId !== null && editingDrawingId !== drawing.id) finishEditing(); setSelectedDrawingId(drawing.id); };
          if (drawing.tool === "hline") {
            const horizontalPrice = drawing.price ?? yToPrice(drawing.y);
            const labelX = chart.left + (chartRight - chart.left) * 0.56;
            return <g key={drawing.id} onClick={onSelect}>
              <line x1={chart.left} y1={drawing.y} x2={chartRight} y2={drawing.y} className={`user-horizontal-line ${selected ? "selected" : ""}`} />
              <text x={labelX} y={drawing.y + 3} textAnchor="middle" className={`horizontal-price-text ${selected ? "selected" : ""}`}>{formatPrice(horizontalPrice)}</text>
            </g>;
          }
          if (drawing.tool === "trend") return <g key={drawing.id} onClick={onSelect}><line x1={drawing.x} y1={drawing.y} x2={drawing.x2 ?? drawing.x + 80} y2={drawing.y2 ?? drawing.y - 18} className={`user-drawing ${selected ? "selected" : ""}`} onPointerDown={(event) => startEditDrag(event, drawing, "body")} />{editingDrawingId === drawing.id && <><circle className="edit-handle" cx={drawing.x} cy={drawing.y} onPointerDown={(event) => startEditDrag(event, drawing, "start")} /><circle className="edit-handle" cx={drawing.x2 ?? drawing.x + 80} cy={drawing.y2 ?? drawing.y - 18} onPointerDown={(event) => startEditDrag(event, drawing, "end")} /></>}</g>;
          if (drawing.tool === "rect") { const x = Math.min(drawing.x, drawing.x2 ?? drawing.x + 110); const y = Math.min(drawing.y, drawing.y2 ?? drawing.y + 56); const right = Math.max(drawing.x, drawing.x2 ?? drawing.x + 110); const bottom = Math.max(drawing.y, drawing.y2 ?? drawing.y + 56); const width = Math.abs(right - x); const height = Math.abs(bottom - y); const handles: Array<[number, number, string]> = [[x,y,"nw"],[right,y,"ne"],[x,bottom,"sw"],[right,bottom,"se"],[x + width / 2,y,"n"],[x + width / 2,bottom,"s"],[x,y + height / 2,"w"],[right,y + height / 2,"e"]]; return <g key={drawing.id} onClick={onSelect}><rect x={x} y={y} width={Math.max(8, width)} height={Math.max(8, height)} className={`user-rectangle ${selected ? "selected" : ""}`} onPointerDown={(event) => startEditDrag(event, drawing, "body")} />{editingDrawingId === drawing.id && handles.map(([cx, cy, handle]) => <circle key={handle} className="edit-handle" cx={cx} cy={cy} onPointerDown={(event) => startEditDrag(event, drawing, handle)} />)}</g>; }
          if (drawing.tool === "crosshair") return <g key={drawing.id} onClick={onSelect}><line x1={chart.left} y1={drawing.y} x2={chartRight} y2={drawing.y} className="user-crosshair" /><line x1={drawing.x} y1={chart.top} x2={drawing.x} y2={chart.height - chart.bottom} className="user-crosshair" /></g>;
          const label = drawing.label ?? drawingLabels[drawing.tool] ?? "标记";
          return <g key={drawing.id} onClick={onSelect}><circle cx={drawing.x} cy={drawing.y} r="6" className={`user-marker ${drawing.tool} ${selected ? "selected" : ""}`} /><text x={drawing.x + 9} y={drawing.y - 8} className="drawing-label">{drawing.label ?? label}</text></g>;
        })}

        {layers.actual && <><line x1={chart.left} y1={y(stock.price)} x2={chartRight} y2={y(stock.price)} className="current-line" /><rect x={chartRight - 49} y={y(stock.price) - 10} width="49" height="20" rx="4" className="current-tag" /><text x={chartRight - 25} y={y(stock.price) + 4} textAnchor="middle" className="current-text">{stock.price.toFixed(2)}</text></>}

        {profile.future.map((day, index) => (
          <text key={day.date} x={futureStart + index * 54} y={chart.height - 16} textAnchor="middle" className="date-label">{day.date}</text>
        ))}
      </svg>
      <div className="chart-statusbar"><span>缩放 {Math.round(view.zoom * 100)}%</span><span>拖动画布平移</span><span>十字光标读取行情</span><em>虚线区域为推演值，不是未来价格</em></div>
      </div>
    </div>
  );
}

function RuleComposer({ onClose, onConfirm }: { onClose: () => void; onConfirm: (title: string) => void }) {
  const [text, setText] = useState("短线操作时，如果未来三日 MA5 与周线 BOLL 中轨接近，优先作为上涨关键位。 ");
  const [parsed, setParsed] = useState(false);

  return (
    <div className="modal-layer" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="rule-composer" role="dialog" aria-modal="true" aria-labelledby="rule-title">
        <button className="modal-close" onClick={onClose} aria-label="关闭">×</button>
        <p className="eyebrow">自然语言 → 结构化规则</p>
        <h2 id="rule-title">录入一条个人经验</h2>
        <p className="composer-help">确认后立即高优先级生效；回测只验证可靠度，不参与本次价格计算。</p>
        <label className="field-label" htmlFor="rule-text">经验描述</label>
        <textarea id="rule-text" value={text} onChange={(event) => { setText(event.target.value); setParsed(false); }} rows={4} />

        {parsed && (
          <div className="parsed-rule">
            <div className="parsed-heading"><span>解析结果</span><em>待你确认</em></div>
            <dl>
              <div><dt>操作周期</dt><dd>短线（1～4日）</dd></div>
              <div><dt>适用方向</dt><dd>上涨</dd></div>
              <div><dt>触发条件</dt><dd>未来3日 MA5 与周线 BOLL 中轨区域重叠</dd></div>
              <div><dt>执行动作</dt><dd>将共振区提升为上涨关键位</dd></div>
              <div><dt>优先级</dt><dd>经验规则 · 权重 8</dd></div>
            </dl>
          </div>
        )}

        <div className="composer-actions">
          <button className="button ghost" onClick={onClose}>取消</button>
          {!parsed ? (
            <button className="button primary" onClick={() => setParsed(true)} disabled={!text.trim()}>解析规则</button>
          ) : (
            <button className="button primary" onClick={() => onConfirm(text.trim())}>确认并立即生效</button>
          )}
        </div>
      </section>
    </div>
  );
}

type RuleForDetail = {
  id: string;
  title: string;
  scope: string;
  rawScore?: number;
  effectiveSamples?: number;
  status?: string;
};

const ruleDetailCopy: Record<string, { trigger: string; action: string; invalidation: string; cadence: string; source: string }> = {
  "R-07": {
    trigger: "未来四日日线与周线 MA / BOLL 出现同向重叠，且价格位于近端趋势线之上。",
    action: "将重叠区标记为首要关键位：回踩不破时作为买入参考，触及 BOLL 上轨时分批止盈。",
    invalidation: "收盘跌破 5 日线或 BOLL 中轨，并且放量确认弱势。",
    cadence: "下个交易日有效；每天收盘后重新计算。",
    source: "系统默认规则 · R-07",
  },
  "R-03": {
    trigger: "前收密集区与未来 MA10 重叠，且下跌方向的反弹未能站稳 MA5。",
    action: "把密集区提升为首要支撑，反弹不过 MA5 时降低仓位并进入风险观察。",
    invalidation: "价格重新站稳 MA5 且连续两根 K 线抬高低点。",
    cadence: "下个交易日有效；不跨日沿用。",
    source: "系统默认规则 · R-03",
  },
};

function RuleDetail({ rule, enabled, onClose, onToggle }: { rule: RuleForDetail; enabled: boolean; onClose: () => void; onToggle: () => void }) {
  const detail = ruleDetailCopy[rule.id] ?? {
    trigger: "由已确认的自然语言经验解析为方向、周期和指标条件。",
    action: "作为当前预测的补充依据，并在预测记录中保留命中与偏离结果。",
    invalidation: "当条件不再满足，或回测样本不足以支持该经验时暂停参考。",
    cadence: "下个交易日有效；需在下一次预测时重新确认。",
    source: "用户录入经验规则",
  };
  const reliability = rule.rawScore === undefined || rule.effectiveSamples === undefined ? null : shrinkReliability(rule.rawScore, rule.effectiveSamples);
  return (
    <div className="modal-layer" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="rule-detail-panel" role="dialog" aria-modal="true" aria-labelledby="rule-detail-title">
        <button className="modal-close" onClick={onClose} aria-label="关闭规则详情">×</button>
        <p className="eyebrow">规则说明 · {rule.id}</p>
        <div className="rule-detail-title-row"><h2 id="rule-detail-title">{rule.title}</h2><span className={`rule-state ${enabled ? "on" : "off"}`}>{enabled ? "当前生效" : "已停用"}</span></div>
        <p className="rule-detail-scope">适用范围：{rule.scope}</p>
        <div className="rule-detail-grid">
          <div><small>触发条件</small><p>{detail.trigger}</p></div>
          <div><small>执行动作</small><p>{detail.action}</p></div>
          <div><small>失效条件</small><p>{detail.invalidation}</p></div>
          <div><small>有效窗口</small><p>{detail.cadence}</p></div>
        </div>
        <dl className="rule-detail-meta"><div><dt>规则来源</dt><dd>{detail.source}</dd></div><div><dt>修正可靠度</dt><dd>{reliability ?? "待验证"}{reliability ? "分" : ""}</dd></div><div><dt>有效样本</dt><dd>{rule.effectiveSamples ?? 0}</dd></div><div><dt>当前状态</dt><dd>{enabled ? "参与本次判断" : "不参与本次判断"}</dd></div></dl>
        <div className="rule-detail-actions"><button className="button ghost" onClick={onClose}>返回规则列表</button><button className="button primary" onClick={onToggle}>{enabled ? "停用这条规则" : "启用这条规则"}</button></div>
      </section>
    </div>
  );
}

const earningModes = [
  { id: "three-day", name: "3天5日线 → BOLL上轨", score: 86, tone: "rise", tag: "主策略", desc: "现价上方有 MA5 上移，优先等回踩买入，再以 3 天 BOLL 上轨分批止盈。", buy: "32.98～33.24", sell: "33.88～34.12", invalid: "收盘跌破 32.78", evidence: ["MA5 连续上移", "BOLL 上轨抬升", "近期振幅 3.8%"] },
  { id: "climb", name: "攀升", score: 74, tone: "rise", tag: "备选", desc: "5日线或 BOLL 中轨不破时继续看多，适合持仓观察，不适合远离均线追涨。", buy: "回踩 32.78 附近", sell: "34.12 附近", invalid: "放量跌破 5日线", evidence: ["价格在 5日线上方", "趋势斜率为正", "量能尚需确认"] },
  { id: "mirror", name: "照镜子止盈", score: 61, tone: "amber", tag: "风控", desc: "触及 BOLL 上轨后观察 2 天，等待价格照镜子回到 5日线，避免把浮盈回吐。", buy: "不追高", sell: "33.88～34.12", invalid: "跌破 5日线且放量", evidence: ["距离 MA5 偏离 1.7%", "上轨附近易反复", "适合已有持仓"] },
  { id: "rebound", name: "反弹止损", score: 39, tone: "fall", tag: "警戒", desc: "若下跌中继反弹不过 5日线，按弱势处理，不把反弹当反转。", buy: "暂不买入", sell: "反弹不过 5日线减仓", invalid: "重新站稳 33.48", evidence: ["下方支撑仍需确认", "反弹量能不足", "跌破 32.78 触发"] },
];

const forecastPaths = [
  { id: "base", label: "基准路径", note: "回踩 MA5 后震荡上移", tone: "blue", values: [33.18, 33.34, 33.47], buy: "32.98～33.24", sell: "33.88～34.12", trigger: "站稳 33.24" },
  { id: "strong", label: "偏强路径", note: "放量突破，向 BOLL 上轨靠拢", tone: "red", values: [33.42, 33.76, 34.12], buy: "不追高，等 33.48 回踩", sell: "34.03～34.19", trigger: "放量站稳 33.48" },
  { id: "weak", label: "偏弱路径", note: "反弹不过 MA5，回测支撑区", tone: "green", values: [32.74, 32.18, 31.92], buy: "31.72～32.08", sell: "暂不设目标", trigger: "收盘跌破 32.78" },
];

type TradeSide = "buy" | "sell";
type TradeRecord = { id: string; side: TradeSide; quantity: number; price: number; date: string; note?: string; valid?: boolean; correctedFrom?: { side: TradeSide; quantity: number; price: number; date: string; note?: string }; correctedAt?: string };

const tradingDate = "2026-08-14";
const demoInitialPosition = { quantity: 0, avgCost: 0, sellableQuantity: 0 };
const demoTrades: TradeRecord[] = [
  { id: "trade-demo-1", side: "buy", quantity: 1000, price: 31.8, date: "2026-08-13", note: "示例建仓" },
  { id: "trade-demo-2", side: "buy", quantity: 500, price: 32.1, date: tradingDate, note: "示例加仓" },
];

type CompanyAction = { id: string; date: string; type: "split" | "cash_dividend" | "rights_issue"; ratio?: number; amount?: number; subscriptionPrice?: number; note: string };
const demoCompanyActions: CompanyAction[] = [
  { id: "action-1", date: "2026-07-21", type: "cash_dividend", amount: 0.5, note: "每股现金分红" },
  { id: "action-2", date: "2026-06-18", type: "split", ratio: 2, note: "10 转 5" },
];

function CompanyActionPanel() {
  const [enabledIds, setEnabledIds] = useState<string[]>(demoCompanyActions.map((item) => item.id));
  const activeActions = demoCompanyActions.filter((item) => enabledIds.includes(item.id));
  const adjustedPrice = adjustPriceForCompanyActions(stock.price, activeActions);
  return (
    <section className="company-action-section" id="company-actions">
      <SectionHeading eyebrow="历史数据校准 · 公司行为" title="公司行为调整" aside={<span className="panel-note">除权除息后再计算 MA / BOLL</span>} />
      <div className="company-action-layout">
        <div className="company-action-table"><div className="company-action-table-head"><span>日期</span><span>行为</span><span>说明</span><span>纳入调整</span></div>{demoCompanyActions.map((action) => { const enabled = enabledIds.includes(action.id); return <div className={`company-action-row ${enabled ? "enabled" : ""}`} key={action.id}><b>{action.date}</b><strong>{actionLabel(action)}</strong><span>{action.note}</span><button className={`switch ${enabled ? "on" : ""}`} aria-label={`${enabled ? "取消" : "启用"}公司行为 ${action.date}`} aria-pressed={enabled} onClick={() => setEnabledIds((current) => enabled ? current.filter((id) => id !== action.id) : [...current, action.id])}><i /></button></div>; })}</div>
        <div className="company-action-result"><p className="eyebrow">调整结果</p><div className="adjusted-price-row"><span>现价参考</span><strong>{stock.price.toFixed(2)}</strong></div><div className="adjusted-price-row active"><span>复权参考价</span><strong>{adjustedPrice.toFixed(2)}</strong></div><p>当前启用 {activeActions.length} 项公司行为。调整仅影响历史价格与指标计算，不会修改实际成交记录。</p><button className="button ghost" onClick={() => setEnabledIds(demoCompanyActions.map((item) => item.id))}>恢复全部调整</button></div>
      </div>
    </section>
  );
}

const demoBacktestRows = [
  { date: "2026-07-20", side: "buy", pnl: 0, signal: "MA5 上穿" },
  { date: "2026-07-22", side: "sell", pnl: 180, signal: "触达 BOLL 上轨" },
  { date: "2026-07-27", side: "buy", pnl: 0, signal: "回踩 5 日线" },
  { date: "2026-07-30", side: "sell", pnl: -55, signal: "跌破 5 日线" },
  { date: "2026-08-04", side: "buy", pnl: 0, signal: "关键点确认" },
  { date: "2026-08-07", side: "sell", pnl: 235, signal: "BOLL 上轨止盈" },
];

const demoActualMarket = {
  "2026-08-12": { high: 33.95, low: 31.96 },
  "2026-08-13": { high: 33.72, low: 32.42 },
};

function BacktestPanel({ enabledRules, predictionRecords }: { enabledRules: Record<string, boolean>; predictionRecords: PredictionRecord[] }) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [range, setRange] = useState("近 60 个交易日");
  const [ruleId, setRuleId] = useState("all");
  const summary = calculateBacktestSummary(demoBacktestRows);
  const evaluatedRows = evaluatePredictionRecords(predictionRecords, demoActualMarket, "2026-08-13");
  const predictionCompleted = evaluatedRows.filter((row) => row.status !== "待评估");
  const predictionHits = predictionCompleted.filter((row) => row.status === "命中").length;
  const predictionTradeCount = evaluatedRows.filter((row) => row.tradeStatus === "已交易").length;
  const predictionWinRate = Math.round((predictionHits / predictionCompleted.length) * 100);
  const pendingCount = evaluatedRows.filter((row) => row.status === "待评估").length;
  return (
    <section className="backtest-section" id="rule-backtest">
      <SectionHeading eyebrow="历史验证 · 自动评估" title="策略效果" aside={<span className="panel-note">演示数据 · 不代表未来收益</span>} />
      <div className="backtest-summary-note">每天有预测就会自动评估，是否交易不影响预测命中率；只有实际买卖才会补充盈亏数据。偏离时再进入“当日复盘”，无需重复填写。</div>
      <div className="backtest-metrics"><div><small>预测天数</small><strong>{evaluatedRows.length}</strong><span>天</span></div><div><small>已评估</small><strong>{predictionCompleted.length}</strong><span>天</span></div><div><small>预测命中率</small><strong>{predictionCompleted.length ? predictionWinRate : "—"}{predictionCompleted.length ? "%" : ""}</strong><span>已完成预测</span></div><div><small>无交易但已评估</small><strong>{evaluatedRows.filter((row) => row.tradeStatus === "未交易" && row.status !== "待评估").length}</strong><span>天</span></div><div className="risk"><small>待到期评估</small><strong>{pendingCount}</strong><span>天</span></div></div>
      <div className="strategy-effect-trade"><span>交易数据补充</span><b>{predictionTradeCount} 天有交易</b><em className="positive">累计盈亏 +{summary.totalPnl.toFixed(2)} 元</em><small>最大回撤 {summary.maxDrawdown.toFixed(2)} 元 · 详见交易与盈亏</small></div>
      <div className="backtest-advanced"><button className="backtest-advanced-toggle" aria-expanded={showAdvanced} onClick={() => setShowAdvanced((current) => !current)}>高级筛选 <span>{showAdvanced ? "收起" : "展开"}</span></button>{showAdvanced && <div className="backtest-toolbar"><label>评估区间<select value={range} onChange={(event) => setRange(event.target.value)}><option>近 20 个交易日</option><option>近 60 个交易日</option><option>近 120 个交易日</option></select></label><label>规则筛选<select value={ruleId} onChange={(event) => setRuleId(event.target.value)}><option value="all">全部已启用规则</option>{Object.entries(enabledRules).filter(([, enabled]) => enabled).map(([id]) => <option key={id}>{id}</option>)}</select></label><span className="backtest-applied">当前：{range} · {ruleId === "all" ? "组合规则" : ruleId}</span><button className="button primary" onClick={() => undefined}>重新评估</button></div>}</div>
      <div className="backtest-table"><div className="backtest-table-head"><span>日期</span><span>匹配策略</span><span>交易情况</span><span>预测结果</span></div>{evaluatedRows.map((row) => <div className="backtest-row" key={row.id}><span>{row.validDate}</span><b>{row.mode} · {row.path}</b><span>{row.tradeStatus}</span><strong title={row.reason} className={row.status === "命中" ? "positive" : row.status === "偏离" ? "negative" : "flat"}>{row.status}</strong></div>)}</div>
    </section>
  );
}

const demoTradingStats = [
  { date: "08/04", pnl: 88, volume: 2 }, { date: "08/05", pnl: 145, volume: 3 }, { date: "08/06", pnl: -32, volume: 1 }, { date: "08/07", pnl: 235, volume: 4 }, { date: "08/08", pnl: 116, volume: 2 },
];

function TradingStatsPanel() {
  const cumulative = demoTradingStats.reduce<number[]>((values, item) => [...values, (values.at(-1) ?? 0) + item.pnl], []);
  const maxPnl = Math.max(...demoTradingStats.map((item) => item.pnl), 1);
  const minPnl = Math.min(...demoTradingStats.map((item) => item.pnl), 0);
  return (
    <section className="stats-section" id="trading-stats">
      <SectionHeading eyebrow="执行复盘 · 交易表现" title="交易统计" aside={<span className="panel-note">按已保存交易记录计算</span>} />
      <div className="stats-layout"><div className="stats-chart-card"><div className="chart-subhead"><b>累计盈亏曲线</b><span>近 5 个交易日</span></div><svg className="stats-line-chart" viewBox="0 0 430 150" role="img" aria-label="交易累计盈亏曲线"><line x1="32" y1="120" x2="410" y2="120" className="chart-axis" /><polyline points={cumulative.map((value, index) => `${42 + index * 82},${120 - (value / Math.max(1, cumulative.at(-1) ?? 1)) * 80}`).join(" ")} className="stats-equity-line" />{cumulative.map((value, index) => <g key={demoTradingStats[index].date}><circle cx={42 + index * 82} cy={120 - (value / Math.max(1, cumulative.at(-1) ?? 1)) * 80} r="3.5" className="equity-point" /><text x={42 + index * 82} y="139" textAnchor="middle" className="chart-date">{demoTradingStats[index].date}</text></g>)}</svg></div><div className="daily-bars-card"><div className="chart-subhead"><b>每日盈亏</b><span>元</span></div><div className="daily-bars">{demoTradingStats.map((item) => <div className="daily-bar-item" key={item.date}><span className={item.pnl >= 0 ? "positive" : "negative"}>{item.pnl > 0 ? "+" : ""}{item.pnl}</span><i className={item.pnl >= 0 ? "profit-bar" : "loss-bar"} style={{ height: `${Math.max(10, Math.abs(item.pnl) / Math.max(maxPnl, Math.abs(minPnl)) * 58)}px` }} /><small>{item.date}</small></div>)}</div></div></div>
      <div className="stats-metrics"><div><small>累计盈亏</small><strong>+552.00</strong><span>元</span></div><div><small>盈利天数</small><strong>4 / 5</strong><span>交易日</span></div><div><small>交易次数</small><strong>12</strong><span>买卖合计</span></div><div><small>平均单笔</small><strong>46.00</strong><span>元</span></div><div><small>执行偏差</small><strong>16.7%</strong><span>未按计划</span></div></div>
    </section>
  );
}

const demoPortfolio = [
  { symbol: "DEMO·001", name: "华芯动力", quantity: 1500, avgCost: 31.90, price: 32.68, realizedPnl: 0 },
  { symbol: "DEMO·002", name: "云端智造", quantity: 800, avgCost: 24.60, price: 25.18, realizedPnl: 126 },
  { symbol: "DEMO·003", name: "新能材料", quantity: 600, avgCost: 18.40, price: 17.92, realizedPnl: -42 },
];

function PortfolioSummaryPanel({ onSelectStock }: { onSelectStock: (symbol: string) => void }) {
  const summary = calculatePortfolioSummary(demoPortfolio);
  return (
    <section className="portfolio-section" id="portfolio-summary">
      <SectionHeading eyebrow="组合视角 · 多股票盈亏" title="组合总览" aside={<span className="panel-note">演示持仓 · 非真实账户</span>} />
      <div className="portfolio-metrics">
        <div><small>持仓股票</small><strong>{summary.stockCount}</strong><span>只</span></div>
        <div><small>总投入</small><strong>{summary.totalCost.toFixed(2)}</strong><span>元</span></div>
        <div><small>当前市值</small><strong>{summary.marketValue.toFixed(2)}</strong><span>元</span></div>
        <div className={summary.floatingPnl >= 0 ? "profit" : "loss"}><small>总浮动盈亏</small><strong>{summary.floatingPnl >= 0 ? "+" : ""}{summary.floatingPnl.toFixed(2)}</strong><span>元</span></div>
        <div><small>已实现盈亏</small><strong>{summary.realizedPnl >= 0 ? "+" : ""}{summary.realizedPnl.toFixed(2)}</strong><span>元</span></div>
        <div className={summary.totalPnl >= 0 ? "profit" : "loss"}><small>组合收益率</small><strong>{summary.returnRate >= 0 ? "+" : ""}{summary.returnRate.toFixed(2)}%</strong><span>浮动 + 已实现</span></div>
      </div>
      <div className="portfolio-table" role="table" aria-label="持仓股票盈亏">
        <div className="portfolio-table-head"><span>股票</span><span>持仓/成本</span><span>现价/市值</span><span>浮动盈亏</span><span>收益率</span><span /></div>
        {summary.rows.map((row) => <button className="portfolio-row" key={row.symbol} onClick={() => onSelectStock(row.symbol)}><span><b>{row.name}</b><small>{row.symbol}</small></span><span>{row.quantity} 股<small>成本 {row.avgCost.toFixed(2)}</small></span><span>{row.price.toFixed(2)}<small>市值 {row.marketValue.toFixed(2)}</small></span><strong className={row.floatingPnl >= 0 ? "positive" : "negative"}>{row.floatingPnl >= 0 ? "+" : ""}{row.floatingPnl.toFixed(2)}</strong><strong className={row.returnRate >= 0 ? "positive" : "negative"}>{row.returnRate >= 0 ? "+" : ""}{row.returnRate.toFixed(2)}%</strong><span className="portfolio-open">查看详情 →</span></button>)}
      </div>
    </section>
  );
}

function TradingPanel({ onNotify }: { onNotify: (message: string) => void }) {
  const [side, setSide] = useState<TradeSide>("buy");
  const [quantity, setQuantity] = useState("100");
  const [price, setPrice] = useState(stock.price.toFixed(2));
  const [note, setNote] = useState("");
  const [trades, setTrades] = useState<TradeRecord[]>(demoTrades);
  const [editingTrade, setEditingTrade] = useState<TradeRecord | null>(null);
  const [editSide, setEditSide] = useState<TradeSide>("buy");
  const [editQuantity, setEditQuantity] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editDate, setEditDate] = useState(tradingDate);
  const [editNote, setEditNote] = useState("");
  const numericQuantity = Number(quantity);
  const numericPrice = Number(price);
  const validTrades = trades.filter((trade) => trade.valid !== false);
  const position = calculatePositionState(validTrades, demoInitialPosition, stock.price);
  const fees = calculateFees({ side, quantity: Number.isFinite(numericQuantity) ? numericQuantity : 0, price: Number.isFinite(numericPrice) ? numericPrice : 0 });
  const validation = validateTrade({ side, quantity: numericQuantity, price: numericPrice, date: tradingDate }, position, { tradingDate });

  useEffect(() => {
    const saved = loadPrototypeState(window.localStorage).tradeRecords as TradeRecord[];
    // The effect restores the local demo transaction snapshot once browser storage is available.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (saved.length > 0) setTrades(saved);
  }, []);

  const persist = (next: TradeRecord[]) => {
    const state = loadPrototypeState(window.localStorage);
    savePrototypeState(window.localStorage, { ...state, tradeRecords: next });
    setTrades(next);
  };

  const saveTrade = (event: React.FormEvent) => {
    event.preventDefault();
    if (!Number.isFinite(numericQuantity) || !Number.isFinite(numericPrice) || numericQuantity <= 0 || numericPrice <= 0) return;
    const record: TradeRecord = { id: `trade-${trades.length + 1}-${side}-${numericQuantity}`, side, quantity: numericQuantity, price: numericPrice, date: tradingDate, note, valid: validation.valid };
    persist([record, ...trades]);
    setNote("");
    onNotify(validation.valid ? "交易记录已保存" : "已保存为规则外演示记录，未计入持仓统计");
  };

  const startEdit = (trade: TradeRecord) => {
    setEditingTrade(trade);
    setEditSide(trade.side);
    setEditQuantity(String(trade.quantity));
    setEditPrice(String(trade.price));
    setEditDate(trade.date);
    setEditNote(trade.note ?? "");
  };

  const saveEditedTrade = (event: React.SyntheticEvent) => {
    event.preventDefault();
    if (!editingTrade) return;
    const nextQuantity = Number(editQuantity);
    const nextPrice = Number(editPrice);
    const otherTrades = trades.filter((trade) => trade.id !== editingTrade.id);
    const editPosition = calculatePositionState(otherTrades.filter((trade) => trade.valid !== false), demoInitialPosition, stock.price);
    const editValidation = validateTrade({ side: editSide, quantity: nextQuantity, price: nextPrice, date: editDate }, editPosition, { tradingDate: editDate });
    const updated: TradeRecord = {
      ...editingTrade,
      side: editSide,
      quantity: nextQuantity,
      price: nextPrice,
      date: editDate,
      note: editNote,
      valid: editValidation.valid,
      correctedFrom: editingTrade.correctedFrom ?? { side: editingTrade.side, quantity: editingTrade.quantity, price: editingTrade.price, date: editingTrade.date, note: editingTrade.note },
      correctedAt: tradingDate,
    };
    persist([updated, ...otherTrades]);
    setEditingTrade(null);
    onNotify(editValidation.valid ? "交易记录已纠正，盈亏已重新计算" : "交易已纠正，但仍属于规则外演示记录");
  };

  return (
    <section className="trading-section" id="trading-pnl">
      <SectionHeading eyebrow="交易记录 · 本地演示" title="交易与盈亏" aside={<span className="panel-note">A 股 T+1 校验 · 非真实下单</span>} />
      <div className="trading-layout">
        <div className="holding-overview">
          <div className="holding-card primary"><small>当前市值</small><strong>{position.marketValue.toLocaleString()} 元</strong><span>现价 {stock.price.toFixed(2)}</span></div>
          <div className="holding-card"><small>持仓 / 可卖数量</small><strong>{position.quantity} / {position.sellableQuantity} 股</strong><span>买入当日不可卖出</span></div>
          <div className="holding-card"><small>平均成本</small><strong>{position.avgCost.toFixed(2)}</strong><span>已计入有效交易</span></div>
          <div className={`holding-card ${position.floatingPnl >= 0 ? "profit" : "loss"}`}><small>浮动盈亏</small><strong>{position.floatingPnl >= 0 ? "+" : ""}{position.floatingPnl.toFixed(2)} 元</strong><span>按当前演示价格计算</span></div>
        </div>
        <form className="trade-entry" onSubmit={saveTrade}>
          <div className="trade-entry-head"><div><p className="eyebrow">录入交易</p><h3>记录一笔买卖</h3></div><span className="trade-date">交易日 {tradingDate}</span></div>
          <div className="trade-side-tabs" role="group" aria-label="交易方向"><button type="button" className={side === "buy" ? "active buy" : "buy"} aria-pressed={side === "buy"} onClick={() => setSide("buy")}>买入</button><button type="button" className={side === "sell" ? "active sell" : "sell"} aria-pressed={side === "sell"} onClick={() => setSide("sell")}>卖出</button></div>
          <div className="trade-fields"><label>数量（股）<input value={quantity} onChange={(event) => setQuantity(event.target.value)} inputMode="numeric" aria-label="交易数量" /></label><label>成交价<input value={price} onChange={(event) => setPrice(event.target.value)} inputMode="decimal" aria-label="成交价格" /></label><label className="trade-note-field">备注<input value={note} onChange={(event) => setNote(event.target.value)} placeholder="可选" aria-label="交易备注" /></label></div>
          <div className="fee-preview"><span>成交金额 <b>{Number.isFinite(fees.amount) ? fees.amount.toFixed(2) : "—"}</b></span><span>手续费 <b>{Number.isFinite(fees.total) ? fees.total.toFixed(2) : "—"}</b></span><span>可卖数量 <b>{position.sellableQuantity} 股</b></span></div>
          {!validation.valid && <div className="trade-warning" role="alert"><b>交易校验提醒</b><span>{validation.message}</span><small>原始输入会保留；保存后作为规则外演示记录，不计入持仓统计。</small></div>}
          <button className="button primary trade-submit" type="submit">{validation.valid ? "保存交易记录" : "仍保存为演示记录"}</button>
        </form>
      </div>
      <div className="trade-history"><div className="trade-history-head"><div><h3>交易明细</h3><small className="trade-correction-note">支持编辑交易、纠正记录；保留纠正前数据</small></div><span>已记录 {trades.length} 笔 · 实现盈亏 {position.realizedPnl.toFixed(2)} 元</span></div>{trades.slice(0, 4).map((trade) => <div className={`trade-row ${trade.valid === false ? "invalid" : ""}`} key={trade.id}><span className={`trade-badge ${trade.side}`}>{trade.side === "buy" ? "买入" : "卖出"}</span><b>{trade.quantity} 股</b><span>@ {trade.price.toFixed(2)}</span><span>{trade.date}</span><small>{trade.note || "—"}</small>{trade.correctedFrom && <em>已纠正</em>}{trade.valid === false && !trade.correctedFrom && <em>规则外</em>}<button className="trade-edit-button" onClick={() => startEdit(trade)}>编辑交易</button></div>)}</div>
      {editingTrade && <div className="modal-layer" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setEditingTrade(null)}><section className="trade-edit-panel" role="dialog" aria-modal="true" aria-labelledby="trade-edit-title"><button className="modal-close" onClick={() => setEditingTrade(null)} aria-label="关闭交易编辑">×</button><p className="eyebrow">交易记录纠正</p><h2 id="trade-edit-title">纠正记录</h2><p className="trade-edit-help">修改后会重新计算持仓、手续费和盈亏，并保留纠正前数据。</p><div className="trade-side-tabs" role="group" aria-label="纠正后的交易方向"><button type="button" className={editSide === "buy" ? "active buy" : "buy"} aria-pressed={editSide === "buy"} onClick={() => setEditSide("buy")}>买入</button><button type="button" className={editSide === "sell" ? "active sell" : "sell"} aria-pressed={editSide === "sell"} onClick={() => setEditSide("sell")}>卖出</button></div><div className="trade-fields"><label>数量（股）<input value={editQuantity} onChange={(event) => setEditQuantity(event.target.value)} inputMode="numeric" /></label><label>成交价<input value={editPrice} onChange={(event) => setEditPrice(event.target.value)} inputMode="decimal" /></label><label>交易日期<input type="date" value={editDate} onChange={(event) => setEditDate(event.target.value)} /></label><label>备注<input value={editNote} onChange={(event) => setEditNote(event.target.value)} /></label></div><div className="trade-edit-original">纠正前：{editingTrade.side === "buy" ? "买入" : "卖出"} {editingTrade.quantity} 股 @ {editingTrade.price.toFixed(2)} · {editingTrade.date}</div><div className="trade-edit-actions"><button className="button ghost" onClick={() => setEditingTrade(null)}>取消</button><button className="button primary" onClick={saveEditedTrade}>保存纠正</button></div></section></div>}
    </section>
  );
}

type PredictionRecord = {
  id: string; stock: string; code: string; generatedAt: string; validDate: string;
  mode: string; path: string; keyPoint: string; target: string; support: string; risk: string;
  result: "待复盘" | "命中" | "偏离";
  actualKeyPoint?: string; actualTarget?: string; actualSupport?: string;
};

const demoPredictionRecords: PredictionRecord[] = [
  { id: "pred-001", stock: "华芯动力", code: "DEMO·001", generatedAt: "2026-08-12 15:18", validDate: "2026-08-13", mode: "3天5日线 → BOLL上轨", path: "基准路径", keyPoint: "33.24", target: "33.88～34.12", support: "31.72～32.08", risk: "31.17", result: "待复盘" },
  { id: "pred-002", stock: "华芯动力", code: "DEMO·001", generatedAt: "2026-08-11 15:18", validDate: "2026-08-12", mode: "攀升", path: "偏强路径", keyPoint: "32.80", target: "33.60", support: "31.90", risk: "31.55", result: "命中", actualKeyPoint: "32.86", actualTarget: "33.54", actualSupport: "31.96" },
];

type DailyReviewRecord = {
  id: string; date: string; predictionId: string;
  aiOriginal: { keyPoint: string; target: string; support: string };
  humanCorrection: { keyPoint: string; target: string; support: string };
  planAdherence: string; note: string;
  summary: { hitRate: number; correctionCount: number; tradeCount: number; realizedPnl: number; floatingPnl: number; totalPnl: number; conclusion: string };
};

function ModePanel({ onNotify }: { onNotify: (message: string) => void }) {
  const [selected, setSelected] = useState("three-day");
  const active = earningModes.find((mode) => mode.id === selected) ?? earningModes[0];
  return (
    <section className="mode-panel" id="profit-mode">
      <div className="mode-intro">
        <p className="eyebrow">盈利模式识别 · 规则匹配</p>
        <h2>当前更适合哪种盈利方式？</h2>
        <p>系统把当天的振幅、MA5、BOLL、量能和趋势状态打成多个参数，再按你的经验规则排序。</p>
        <div className="parameter-strip"><span>今日参数 <b>12</b></span><span>振幅匹配 <b>3.8%</b></span><span>规则命中 <b>8/11</b></span></div>
      </div>
      <div className="mode-list" role="tablist" aria-label="盈利模式">
        {earningModes.map((mode) => (
          <button key={mode.id} className={`mode-option ${mode.tone} ${selected === mode.id ? "selected" : ""}`} onClick={() => setSelected(mode.id)} role="tab" aria-selected={selected === mode.id}>
            <span className="mode-option-top"><b>{mode.name}</b><em>{mode.tag}</em></span>
            <span className="mode-score"><i style={{ width: `${mode.score}%` }} /><strong>{mode.score}</strong></span>
            <small>{mode.desc}</small>
          </button>
        ))}
      </div>
      <div className="mode-detail">
        <div className="mode-detail-head"><div><span className={`mode-badge ${active.tone}`}>{active.tag}</span><h3>{active.name}</h3></div><button onClick={() => onNotify(`已将「${active.name}」设为盘前主策略`)}>设为主策略</button></div>
        <p>{active.desc}</p>
        <div className="mode-levels"><div className="buy-level"><small>买入关注</small><strong>{active.buy}</strong></div><div className="sell-level"><small>卖出/止盈</small><strong>{active.sell}</strong></div><div className="risk-level"><small>失效条件</small><strong>{active.invalid}</strong></div></div>
        <div className="evidence-row">{active.evidence.map((item) => <span key={item}>✓ {item}</span>)}</div>
      </div>
    </section>
  );
}

function AiStrategyCenter({ onNotify }: { onNotify: (message: string) => void }) {
  const [view, setView] = useState("overview");
  const [model, setModel] = useState("GPT-5");
  const modelInfo = model === "GPT-5"
    ? { role: "复杂推理与策略解释", status: "演示模型", score: "86", note: "把指标结果、用户规则和历史案例组织成可解释的下个交易日策略。" }
    : { role: "快速规则分类与笔记提取", status: "演示模型", score: "82", note: "负责识别笔记中的条件、方向、周期和风险动作，供用户确认。" };
  return (
    <section className="ai-center" id="ai-center">
      <div className="ai-center-head"><div><p className="eyebrow">模型编排 · 可解释分析</p><h2>AI策略分析中心</h2><p>这里展示策略是如何从数值计算、规则匹配和 AI 解释共同得到的。当前仅为演示模型，不代表已调用真实 API。</p></div><span className="ai-demo-badge">DEMO · 未接入真实模型</span></div>
      <div className="ai-pipeline"><div className="ai-layer"><span className="ai-layer-icon">01</span><div><b>数值计算层</b><small>MA · BOLL · ATR · 振幅</small></div><strong>12 项参数</strong></div><i>→</i><div className="ai-layer"><span className="ai-layer-icon rules">02</span><div><b>规则引擎层</b><small>个人经验 · 策略条件</small></div><strong>8/11 命中</strong></div><i>→</i><div className="ai-layer"><span className="ai-layer-icon ai">03</span><div><b>AI解释层</b><small>{modelInfo.role}</small></div><strong>{modelInfo.score} 分</strong></div></div>
      <div className="ai-body"><div className="ai-main"><div className="ai-tabs">{[["overview", "策略结论"], ["evidence", "解释依据"], ["pending", "待确认经验"]].map(([id, label]) => <button key={id} className={view === id ? "active" : ""} onClick={() => setView(id)}>{label}</button>)}</div>{view === "overview" && <div className="ai-conclusion"><div className="conclusion-mark">↗</div><div><span className="ai-label">当前推荐</span><h3>3天5日线买入 → BOLL上轨止盈</h3><p>当前价格位于 MA5 上方，BOLL 上轨持续抬升，近期振幅适合短线区间策略。建议下个交易日等待 32.98～33.24 回踩，不追高；目标位 33.88～34.12。</p><div className="ai-scores"><span>策略匹配度 <b>86</b></span><span>规则可信度 <b>78</b></span><span>风险等级 <b className="risk-low">中等</b></span></div></div></div>}{view === "evidence" && <div className="evidence-board"><div><b>为什么匹配这条策略？</b><p>① MA5 连续上移，说明短线趋势仍偏多；② BOLL 上轨抬升，提供上方止盈参考；③ 近期振幅 3.8%，适合分批而非一次性追价。</p></div><div className="evidence-rule"><span>命中规则</span><b>R-07 · 周期均线优先</b><em>权重 ×8</em></div><div className="evidence-rule"><span>风险规则</span><b>照镜子止盈</b><em>上轨后观察回到 MA5</em></div></div>}{view === "pending" && <div className="pending-experience"><div className="pending-item"><span>待确认经验</span><b>放量接近 BOLL 上轨时，不宜直接追高</b><small>来源：人工修正 + 2 次盘后复盘</small><button onClick={() => onNotify("经验已确认，进入规则版本 R-08")}>确认并加入规则</button></div><div className="pending-item"><span>待确认经验</span><b>反弹不过 MA5 时按下跌中继处理</b><small>来源：反弹止损策略</small><button onClick={() => onNotify("已保留为待确认经验")}>暂不启用</button></div></div>}</div><aside className="ai-model-card"><p className="eyebrow">当前分析模型</p><div className="model-picker">{["GPT-5", "轻量分类模型"].map((item) => <button key={item} className={model === item ? "active" : ""} onClick={() => setModel(item)}>{item}</button>)}</div><h3>{model}</h3><span className="model-status">{modelInfo.status}</span><p>{modelInfo.note}</p><dl><div><dt>用途</dt><dd>{modelInfo.role}</dd></div><div><dt>输入</dt><dd>指标、规则、历史复盘</dd></div><div><dt>输出</dt><dd>策略排序与解释</dd></div></dl><button className="button ghost" onClick={() => onNotify("模型配置已记录，正式版可接入 API")}>查看模型配置</button></aside></div>
    </section>
  );
}

function ForecastPanel({ onNotify, onSave }: { onNotify: (message: string) => void; onSave: (path: typeof forecastPaths[number]) => void }) {
  const [path, setPath] = useState("base");
  const active = forecastPaths.find((item) => item.id === path) ?? forecastPaths[0];
  return (
    <section className="forecast-panel" id="forecast-paths">
      <SectionHeading eyebrow="规则 + AI 策略推演" title="未来三日：多路径，不给单点幻觉" aside={<span className="panel-note">演示计算 · 非实时行情</span>} />
      <div className="forecast-layout">
        <div className="forecast-visual">
          <div className="forecast-axis"><span>34.20</span><span>33.50</span><span>32.80</span><span>32.10</span><span>31.40</span></div>
          <div className="forecast-grid"><div className="forecast-line" /><div className="forecast-line" /><div className="forecast-line" /><div className="forecast-line" /><div className="forecast-current"><span>现价 32.68</span></div><div className={`path-dots ${active.tone}`}>{active.values.map((value, index) => <span key={index} style={{ left: `${18 + index * 31}%`, top: `${Math.max(9, Math.min(89, 84 - (value - 31.4) * 108))}%` }} title={`${index + 1}日 ${value.toFixed(2)}`}><i /></span>)}</div><div className="forecast-days"><span>今天</span><span>明天</span><span>后天</span></div></div>
        </div>
        <div className="forecast-summary"><div className="path-tabs">{forecastPaths.map((item) => <button key={item.id} className={path === item.id ? "active" : ""} onClick={() => setPath(item.id)}><i className={item.tone} />{item.label}</button>)}</div><h3>{active.note}</h3><p>当前选择路径的未来三日 MA5 轨迹：</p><div className="forecast-values">{active.values.map((value, index) => <div key={index}><span>D+{index + 1}</span><strong>{value.toFixed(2)}</strong></div>)}</div><div className="forecast-decision"><span>买入区域 <b>{active.buy}</b></span><span>卖出区域 <b>{active.sell}</b></span><span>触发/失效 <b>{active.trigger}</b></span></div><button className="button ghost" onClick={() => { onSave(active); onNotify("预测已保存，可在预测记录中查询") }}>保存下个交易日预测</button></div>
      </div>
      <div className="forecast-table-wrap"><table className="forecast-table"><thead><tr><th>指标</th><th>明天</th><th>后天</th><th>第3日</th><th>用途</th></tr></thead><tbody><tr><th>MA5</th><td>33.18</td><td>33.34</td><td>33.47</td><td>回踩买入参考</td></tr><tr><th>BOLL上轨</th><td>33.94</td><td>34.03</td><td>34.12</td><td>3天止盈参考</td></tr><tr><th>BOLL中轨</th><td>31.36</td><td>31.42</td><td>31.49</td><td>趋势底线观察</td></tr><tr><th>有效价格区</th><td>32.98～33.48</td><td>33.05～33.76</td><td>33.18～34.12</td><td>结合振幅筛选</td></tr></tbody></table></div>
      <div className="forecast-footnote"><span>i</span>未来值由 MA/BOLL 结构、近期振幅和已启用经验规则共同计算；三种路径用于表达不确定性，不代表实际最高价或收盘价。</div>
    </section>
  );
}

function PredictionDetail({ record, onClose, onSave }: { record: PredictionRecord; onClose: () => void; onSave: (record: PredictionRecord) => void }) {
  const [actualKeyPoint, setActualKeyPoint] = useState(record.actualKeyPoint ?? "");
  const [actualTarget, setActualTarget] = useState(record.actualTarget ?? "");
  const [actualSupport, setActualSupport] = useState(record.actualSupport ?? "");
  const [result, setResult] = useState<PredictionRecord["result"]>(record.result);
  const parsePrice = (value: string) => value.trim() ? Number(value) : Number.NaN;
  const values = [parsePrice(record.keyPoint), parsePrice(record.target.split("～")[0]), parsePrice(record.support.split("～")[0])];
  const actualValues = [parsePrice(actualKeyPoint), parsePrice(actualTarget), parsePrice(actualSupport)];
  const allValues = [...values, ...actualValues].filter(Number.isFinite);
  const min = Math.min(...allValues, 30.5) - 0.25;
  const max = Math.max(...allValues, 34.5) + 0.25;
  const pointY = (value: number) => 46 + ((max - value) / (max - min)) * 104;
  const validActualValues = actualValues.filter(Number.isFinite);
  const actualLine = validActualValues.length === 3 ? validActualValues.map((value, index) => `${110 + index * 180},${pointY(value)}`).join(" ") : "";
  const predictedLine = values.map((value, index) => `${110 + index * 180},${pointY(value)}`).join(" ");
  const saveResult = () => onSave({ ...record, actualKeyPoint, actualTarget, actualSupport, result });
  return (
    <div className="modal-layer" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="prediction-detail-panel" role="dialog" aria-modal="true" aria-labelledby="prediction-detail-title">
        <button className="modal-close" onClick={onClose} aria-label="关闭预测详情">×</button>
        <p className="eyebrow">预测快照 · {record.validDate}</p>
        <div className="prediction-detail-head"><div><h2 id="prediction-detail-title">{record.stock} <span>{record.code}</span></h2><p>生成于 {record.generatedAt} · {record.mode} · {record.path}</p></div><em className={`history-status ${record.result === "命中" ? "hit" : record.result === "偏离" ? "miss" : "pending"}`}>{record.result}</em></div>
        <div className="prediction-compare-title"><h3>预测与实际对比</h3><span>预测位只对下个交易日有效</span></div>
        <div className="prediction-compare-chart"><div className="compare-legend"><span><i className="predicted-dot" />预测关键位</span><span><i className="actual-dot" />实际价格</span></div><svg viewBox="0 0 620 180" role="img" aria-label="预测关键位与实际价格对比图"><line x1="70" y1="46" x2="570" y2="46" className="compare-grid" /><line x1="70" y1="98" x2="570" y2="98" className="compare-grid" /><line x1="70" y1="150" x2="570" y2="150" className="compare-grid" /><text x="30" y="50" className="compare-axis">目标</text><text x="30" y="102" className="compare-axis">关键</text><text x="30" y="154" className="compare-axis">支撑</text><polyline points={predictedLine} className="compare-predicted" /><circle cx="110" cy={pointY(values[0])} r="4" className="compare-predicted-point" /><circle cx="290" cy={pointY(values[1])} r="4" className="compare-predicted-point" /><circle cx="470" cy={pointY(values[2])} r="4" className="compare-predicted-point" />{actualLine && <><polyline points={actualLine} className="compare-actual" />{validActualValues.map((value, index) => <circle key={index} cx={110 + index * 180} cy={pointY(value)} r="4" className="compare-actual-point" />)}</>}</svg>{!actualLine && <p className="compare-empty">尚未录入实际价格，填写下方复盘结果后显示对比线。</p>}</div>
        <div className="prediction-level-summary"><span><small>预测关键点</small><b>{record.keyPoint}</b></span><span><small>预测目标位</small><b>{record.target}</b></span><span><small>预测支撑位</small><b>{record.support}</b></span><span><small>风险位</small><b>{record.risk}</b></span></div>
        <div className="actual-result-form"><div className="form-heading"><h3>录入实际结果</h3><span>用于判断命中、偏离或失效</span></div><div className="actual-input-grid"><label>实际关键点<input value={actualKeyPoint} onChange={(event) => setActualKeyPoint(event.target.value)} inputMode="decimal" placeholder="例如 33.20" /></label><label>实际目标位<input value={actualTarget} onChange={(event) => setActualTarget(event.target.value)} inputMode="decimal" placeholder="例如 33.90" /></label><label>实际支撑位<input value={actualSupport} onChange={(event) => setActualSupport(event.target.value)} inputMode="decimal" placeholder="例如 32.10" /></label><label>结果判定<select value={result} onChange={(event) => setResult(event.target.value as PredictionRecord["result"])}><option>待复盘</option><option>命中</option><option>偏离</option></select></label></div></div>
        <div className="prediction-detail-actions"><button className="button ghost" onClick={onClose}>取消</button><button className="button primary" onClick={saveResult}>保存复盘结果</button></div>
      </section>
    </div>
  );
}

function PredictionHistory({ records, onOpenDetail }: { records: PredictionRecord[]; onOpenDetail: (record: PredictionRecord) => void }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("全部状态");
  const filtered = records.filter((record) => `${record.stock} ${record.code} ${record.mode} ${record.validDate}`.includes(query.trim()) && (status === "全部状态" || record.result === status));
  return (
    <section className="history-section" id="prediction-history">
      <SectionHeading eyebrow="预测快照 · 可追溯复盘" title="预测记录" aside={<span className="panel-note">预测与实际对比 · 下个交易日有效</span>} />
      <div className="history-toolbar"><label><span>搜索</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="股票、代码、模式或日期" /></label><select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="预测状态"><option>全部状态</option><option>待复盘</option><option>命中</option><option>偏离</option></select><span className="history-count">共 {filtered.length} 条</span></div>
      <div className="history-list">{filtered.map((record) => <article className="history-card" key={record.id}><div className="history-card-top"><div><b>{record.stock}</b><span>{record.code}</span></div><em className={`history-status ${record.result === "命中" ? "hit" : record.result === "偏离" ? "miss" : "pending"}`}>{record.result}</em></div><div className="history-meta"><span>生成 {record.generatedAt}</span><strong>适用 {record.validDate}</strong><span>{record.mode}</span><span>{record.path}</span></div><div className="history-levels"><span><small>关键点</small><b>{record.keyPoint}</b></span><span className="target"><small>目标位</small><b>{record.target}</b></span><span className="support"><small>支撑位</small><b>{record.support}</b></span><span className="risk"><small>风险位</small><b>{record.risk}</b></span></div><button className="history-detail" onClick={() => onOpenDetail(record)}>查看预测详情 · 实际关键点 · 保存复盘结果 →</button></article>)}</div>
      {filtered.length === 0 && <div className="history-empty">没有匹配的预测记录</div>}
    </section>
  );
}

function ReviewPanel({ records, onNotify }: { records: PredictionRecord[]; onNotify: (message: string) => void }) {
  const record = records[0] ?? demoPredictionRecords[0];
  const [actualKeyPoint, setActualKeyPoint] = useState(record.actualKeyPoint ?? "33.20");
  const [actualTarget, setActualTarget] = useState(record.actualTarget ?? "34.00");
  const [actualSupport, setActualSupport] = useState(record.actualSupport ?? "31.80");
  const [planAdherence, setPlanAdherence] = useState("按计划执行");
  const [note, setNote] = useState("");
  const [reviews, setReviews] = useState<DailyReviewRecord[]>([]);
  const [selectedReview, setSelectedReview] = useState<DailyReviewRecord | null>(null);
  useEffect(() => {
    const saved = loadPrototypeState(window.localStorage).dailyReviews as DailyReviewRecord[];
    // Restore saved review history after localStorage is available.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReviews(saved);
  }, []);
  const parse = (value: string) => value.trim() ? Number(value) : Number.NaN;
  const summary = calculateReviewSummary({
    prediction: { keyPoint: parse(record.keyPoint), target: parse(record.target.split("～")[0]), support: parse(record.support.split("～")[0]) },
    actual: { keyPoint: parse(actualKeyPoint), target: parse(actualTarget), support: parse(actualSupport) },
    tradeCount: 2,
    realizedPnl: 120,
    floatingPnl: 410,
  });

  const saveReview = () => {
    const state = loadPrototypeState(window.localStorage);
    const review: DailyReviewRecord = { id: `review-${record.validDate}`, date: record.validDate, predictionId: record.id, aiOriginal: { keyPoint: record.keyPoint, target: record.target, support: record.support }, humanCorrection: { keyPoint: actualKeyPoint, target: actualTarget, support: actualSupport }, planAdherence, note, summary };
    const nextReviews = [review, ...reviews.filter((item) => item.id !== review.id)];
    setReviews(nextReviews);
    savePrototypeState(window.localStorage, { ...state, dailyReviews: nextReviews });
    onNotify("当日复盘已保存");
  };

  return (
    <section className="review-section" id="daily-review">
      <SectionHeading eyebrow="盘后复盘 · AI 与人工对照" title="当日总结" aside={<span className="panel-note">{record.validDate} · 预测仅下个交易日有效</span>} />
      <div className="review-layout">
        <div className="review-summary-grid">
          <div className="review-stat"><small>判断命中率</small><strong>{summary.hitRate}%</strong><span>{summary.conclusion}</span></div>
          <div className="review-stat"><small>人工修正项</small><strong>{summary.correctionCount}</strong><span>个价格位置</span></div>
          <div className="review-stat"><small>交易笔数</small><strong>{summary.tradeCount}</strong><span>已纳入复盘</span></div>
          <div className={`review-stat ${summary.totalPnl >= 0 ? "profit" : "loss"}`}><small>本日盈亏</small><strong>{summary.totalPnl >= 0 ? "+" : ""}{summary.totalPnl.toFixed(2)}</strong><span>已实现 + 浮动</span></div>
        </div>
        <div className="review-compare-card"><div className="review-card-head"><div><p className="eyebrow">预测 vs 实际</p><h3>人工修正</h3></div><span className="review-pending">{summary.conclusion}</span></div><div className="review-compare-row"><b>关键点</b><span className="ai-value">AI {record.keyPoint}</span><input value={actualKeyPoint} onChange={(event) => setActualKeyPoint(event.target.value)} aria-label="修正实际关键点" /></div><div className="review-compare-row"><b>目标位</b><span className="ai-value">AI {record.target}</span><input value={actualTarget} onChange={(event) => setActualTarget(event.target.value)} aria-label="修正实际目标位" /></div><div className="review-compare-row"><b>支撑位</b><span className="ai-value">AI {record.support}</span><input value={actualSupport} onChange={(event) => setActualSupport(event.target.value)} aria-label="修正实际支撑位" /></div></div>
      </div>
      <div className="review-bottom"><label>计划执行度<select value={planAdherence} onChange={(event) => setPlanAdherence(event.target.value)}><option>按计划执行</option><option>部分执行</option><option>未按计划执行</option></select></label><label className="review-note">复盘笔记<textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="记录为什么命中或偏离，作为后续规则复盘素材" rows={2} /></label><button className="button primary" onClick={saveReview}>保存当日复盘</button></div>
      <div className="review-footnote"><span>AI 原始判断</span><b>{record.mode}</b><span>·</span><span>人工修正不会自动修改已启用规则，需在经验规则中单独确认。</span></div>
      <div className="review-history">
        <div className="review-history-head"><div><p className="eyebrow">历史复盘 · 可追溯</p><h3>复盘记录</h3></div><span>共 {reviews.length} 条</span></div>
        {reviews.length === 0 ? <div className="review-history-empty">保存当日复盘后，记录会显示在这里，可再查看复盘详情。</div> : <div className="review-history-list">{reviews.map((item) => <article className="review-history-card" key={item.id}><div className="review-history-card-head"><b>{item.date}</b><span>{item.summary.conclusion}</span></div><div className="review-history-metrics"><span>命中率 <b>{item.summary.hitRate}%</b></span><span>修正 <b>{item.summary.correctionCount} 项</b></span><span>盈亏 <b className={item.summary.totalPnl >= 0 ? "positive" : "negative"}>{item.summary.totalPnl >= 0 ? "+" : ""}{item.summary.totalPnl.toFixed(2)}</b></span><span>{item.planAdherence}</span></div>{item.note && <p>{item.note}</p>}<button className="review-history-detail" onClick={() => setSelectedReview(item)}>查看复盘详情</button></article>)}</div>}
      </div>
      {selectedReview && <div className="modal-layer" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setSelectedReview(null)}><section className="review-detail-panel" role="dialog" aria-modal="true" aria-labelledby="review-detail-title"><button className="modal-close" onClick={() => setSelectedReview(null)} aria-label="关闭复盘详情">×</button><p className="eyebrow">复盘记录 · {selectedReview.date}</p><h2 id="review-detail-title">复盘详情</h2><div className="review-detail-summary"><span>命中率 <b>{selectedReview.summary.hitRate}%</b></span><span>修正项 <b>{selectedReview.summary.correctionCount}</b></span><span>总盈亏 <b>{selectedReview.summary.totalPnl.toFixed(2)}</b></span></div><div className="review-detail-table"><span>关键点</span><b>AI {selectedReview.aiOriginal.keyPoint}</b><strong>实际 {selectedReview.humanCorrection.keyPoint}</strong><span>目标位</span><b>AI {selectedReview.aiOriginal.target}</b><strong>实际 {selectedReview.humanCorrection.target}</strong><span>支撑位</span><b>AI {selectedReview.aiOriginal.support}</b><strong>实际 {selectedReview.humanCorrection.support}</strong></div>{selectedReview.note && <p className="review-detail-note">{selectedReview.note}</p>}</section></div>}
    </section>
  );
}

export function SampleDashboard() {
  const [activeNav, setActiveNav] = useState("overview");
  const [cycle, setCycle] = useState<CycleKey>("short");
  const [expandedZone, setExpandedZone] = useState("up-key");
  const [ruleEnabled, setRuleEnabled] = useState<Record<string, boolean>>(
    Object.fromEntries(initialRules.map((rule) => [rule.id, true])),
  );
  const [customRules, setCustomRules] = useState<Array<{ id: string; title: string }>>([]);
  const [composerOpen, setComposerOpen] = useState(false);
  const [selectedRule, setSelectedRule] = useState<RuleForDetail | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [predictionRecords, setPredictionRecords] = useState<PredictionRecord[]>(demoPredictionRecords);
  const [selectedPrediction, setSelectedPrediction] = useState<PredictionRecord | null>(null);
  const [selectedStock, setSelectedStock] = useState(stock.code);
  const profile = cycleProfiles[cycle];
  const range = useMemo(
    () =>
      getReachableRange({
        price: stock.price,
        atr: stock.atr,
        volatilityMultiplier: cycle === "short" ? 1.35 : cycle === "swing" ? 2.1 : 3.2,
        legalLimitPct: stock.legalLimitPct,
      }),
    [cycle],
  );

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 2600);
  };

  useEffect(() => {
    const savedState = loadPrototypeState(window.localStorage);
    // Restore the locally persisted prediction list after the browser storage is available.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (savedState.predictionRecords.length > 0) setPredictionRecords(savedState.predictionRecords);
  }, []);

  useEffect(() => {
    const ids = ["overview", "profit-mode", "future-indicators", "prediction-history", "trading-pnl", "trading-stats", "daily-review", "ai-center", "rule-center"];
    const sections = ids.map((id) => document.getElementById(id)).filter(Boolean) as HTMLElement[];
    if (!("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible) setActiveNav(visible.target.id);
    }, { rootMargin: "-18% 0px -62% 0px", threshold: [0.1, 0.35, 0.65] });
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  const savePrediction = (path: typeof forecastPaths[number]) => {
    const record: PredictionRecord = { id: `pred-${Date.now()}`, stock: stock.name, code: stock.code, generatedAt: "2026-08-13 15:18", validDate: "2026-08-14", mode: "3天5日线 → BOLL上轨", path: path.label, keyPoint: "33.24", target: path.sell, support: "31.72～32.08", risk: "31.17", result: "待复盘" };
    setPredictionRecords((current) => {
      const next = [record, ...current];
      const state = loadPrototypeState(window.localStorage);
      savePrototypeState(window.localStorage, { ...state, predictionRecords: next });
      return next;
    });
  };

  const updatePrediction = (record: PredictionRecord) => {
    setPredictionRecords((current) => {
      const next = current.map((item) => item.id === record.id ? record : item);
      const state = loadPrototypeState(window.localStorage);
      savePrototypeState(window.localStorage, { ...state, predictionRecords: next });
      return next;
    });
    setSelectedPrediction(null);
    notify("复盘结果已保存，预测状态已更新");
  };

  const scrollTo = (id: string) => { setActiveNav(id); document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }); };
  const selectStock = (symbol: string) => { setSelectedStock(symbol); scrollTo("overview"); notify(`${symbol}已切换到单股分析`); };

  return (
    <main>
      <header className="topbar">
        <div className="topbar-inner">
          <button className="brand" onClick={() => scrollTo("overview")} aria-label="回到总览">
            <span className="brand-mark"><i /><i /><i /></span>
            <span>位界 <em>KEYLINE</em></span>
          </button>
          <nav className="main-nav" aria-label="主导航">
            {[['overview', '关键位分析'], ['profit-mode', '盈利模式'], ['future-indicators', '未来指标'], ['prediction-history', '预测记录'], ['trading-pnl', '交易与盈亏'], ['trading-stats', '统计图表'], ['daily-review', '当日复盘'], ['ai-center', 'AI策略'], ['rule-center', '经验规则']].map(([id, label]) => <button key={id} className={activeNav === id ? "active" : ""} aria-current={activeNav === id ? "page" : undefined} onClick={() => scrollTo(id)}>{label}</button>)}
          </nav>
          <div className="top-actions">
            <label className="search-box">
              <span>⌕</span>
              <input aria-label="搜索股票" placeholder="输入代码 / 名称" />
              <kbd>⌘ K</kbd>
            </label>
            <button className="icon-button" onClick={() => notify("演示版暂无新增提醒") } aria-label="提醒">●</button>
            <button className="avatar" aria-label="个人账户">A</button>
          </div>
        </div>
      </header>

      <div className="demo-ribbon">
        <div><span>演示数据</span> 当前数值用于验证产品逻辑，不构成投资建议，也不是实时行情。</div>
        <button onClick={() => notify("真实行情接口将在下一开发阶段接入")}>数据说明 <i>→</i></button>
      </div>

      <div className="page-shell" id="overview">
        <PortfolioSummaryPanel onSelectStock={selectStock} />
        <section className="ticker-head">
          <div className="ticker-identity">
            <span className="stock-avatar">华</span>
            <div>
              <div className="stock-title"><h1>{stock.name}</h1><span>{selectedStock}</span><em>{stock.market}</em></div>
              <div className="stock-tags"><span>自选</span><span>半导体设备</span><span className="demo-tag">DEMO</span></div>
            </div>
          </div>
          <div className="ticker-price">
            <strong>{stock.price.toFixed(2)}</strong>
            <span>+{stock.change.toFixed(2)} <b>+{stock.changePct.toFixed(2)}%</b></span>
            <small>{stock.updatedAt}</small>
          </div>
          <dl className="quote-stats">
            <div><dt>今开</dt><dd>{stock.open.toFixed(2)}</dd></div>
            <div><dt>最高</dt><dd className="rise-text">{stock.high.toFixed(2)}</dd></div>
            <div><dt>最低</dt><dd className="fall-text">{stock.low.toFixed(2)}</dd></div>
            <div><dt>成交量</dt><dd>{stock.volume}</dd></div>
            <div><dt>换手率</dt><dd>{stock.turnover}</dd></div>
          </dl>
          <div className="cycle-block">
            <span className="cycle-caption">操作周期 <em>系统推荐</em></span>
            <div className="cycle-tabs" role="tablist" aria-label="操作周期">
              {cycleOrder.map((key) => (
                <button
                  key={key}
                  role="tab"
                  aria-selected={cycle === key}
                  className={cycle === key ? "active" : ""}
                  onClick={() => { setCycle(key); setExpandedZone(cycleProfiles[key].zones[0].id); }}
                >
                  {cycleProfiles[key].label}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="decision-strip">
          <div className="decision-primary">
            <span className="decision-icon">↗</span>
            <div>
              <p><span>{profile.direction}</span><em>{profile.horizon}</em></p>
              <h2>{profile.thesis}</h2>
            </div>
          </div>
          <div className="direction-gauge">
            <div className="gauge-head"><span>方向强度</span><strong>{profile.directionScore}<small>/100</small></strong></div>
            <div className="gauge-track"><i style={{ width: `${profile.directionScore}%` }} /></div>
            <div className="gauge-labels"><span>空头</span><span>中性</span><span>多头</span></div>
          </div>
          <dl className="decision-meta">
            <div><dt>周期匹配</dt><dd>{profile.score}<small>/100</small></dd></div>
            <div><dt>可信等级</dt><dd>{profile.confidence}</dd></div>
            <div><dt>规则覆盖</dt><dd>{Object.values(ruleEnabled).filter(Boolean).length + customRules.length} 条</dd></div>
          </dl>
        </section>

        <ModePanel onNotify={notify} />

        <CompanyActionPanel />

        <AiStrategyCenter onNotify={notify} />

        <div className="analysis-grid">
          <section className="analysis-main">
            <SectionHeading
              eyebrow="双向价格地图"
              title="关键区域与目标位"
              aside={<div className="legend-pills"><span className="rise">上涨方向</span><span className="fall">下跌方向</span></div>}
            />
            <div className="zone-grid">
              {profile.zones.map((zone) => (
                <ZoneCard
                  key={`${cycle}-${zone.id}`}
                  zone={zone}
                  expanded={expandedZone === zone.id}
                  onToggle={() => setExpandedZone(expandedZone === zone.id ? "" : zone.id)}
                />
              ))}
            </div>

            <section className="panel chart-panel">
              <PriceChart profile={profile} />
            </section>
          </section>

          <aside className="analysis-side">
            <section className="panel model-panel">
              <SectionHeading eyebrow="交叉验证" title="双模型判断" aside={<span className="status-dot">一致</span>} />
              <div className="model-row">
                <span className="model-logo">A</span>
                <div><b>路径模拟模型</b><p>{profile.modelA}</p></div>
                <em>10,000 路径</em>
              </div>
              <div className="model-row">
                <span className="model-logo secondary">B</span>
                <div><b>指标结构模型</b><p>{profile.modelB}</p></div>
                <em>MA · BOLL</em>
              </div>
              <div className="model-footnote"><i>i</i> 模型分歧时分别展示，不强行平均。</div>
            </section>

            <section className="panel range-panel">
              <SectionHeading eyebrow="ATR14 + 法定边界" title="现价有效展示范围" />
              <div className="range-numbers"><span>{range.low.toFixed(2)}</span><strong>{stock.price.toFixed(2)}</strong><span>{range.high.toFixed(2)}</span></div>
              <div className="range-track"><i className="range-fill" /><i className="range-current" /></div>
              <div className="range-annotation"><span>近期波动下沿</span><span>现价</span><span>近期波动上沿</span></div>
              <dl className="range-detail">
                <div><dt>实际展示半径</dt><dd>±{range.radius.toFixed(2)} <small>({(range.radius / stock.price * 100).toFixed(1)}%)</small></dd></div>
                <div><dt>法定硬边界</dt><dd>±10.0%</dd></div>
                <div><dt>触达区半宽</dt><dd>{cycle === "short" ? "0.15" : cycle === "swing" ? "0.25" : "0.35"} × ATR</dd></div>
              </dl>
            </section>

            <section className="panel strategy-panel">
              <SectionHeading eyebrow="当前策略" title="观察顺序" />
              <ol className="strategy-list">
                <li><span>1</span><p><b>先观察 {formatPrice(profile.zones[0].range[0])}～{formatPrice(profile.zones[0].range[1])}</b><small>站稳后才激活上涨目标区</small></p></li>
                <li><span>2</span><p><b>回踩关注 {formatPrice(profile.zones[2].range[0])}～{formatPrice(profile.zones[2].range[1])}</b><small>连续停留只计一次触达</small></p></li>
                <li><span>3</span><p><b>{formatPrice(profile.zones[3].range[0])} 下方判断失效</b><small>切换为空头占优并完整重算</small></p></li>
              </ol>
            </section>
          </aside>
        </div>

        <ForecastPanel onNotify={notify} onSave={savePrediction} />

        <PredictionHistory records={predictionRecords} onOpenDetail={setSelectedPrediction} />

        <TradingPanel onNotify={notify} />

        <TradingStatsPanel />

        <BacktestPanel enabledRules={ruleEnabled} predictionRecords={predictionRecords} />

        <ReviewPanel records={predictionRecords} onNotify={notify} />

        <section className="future-section" id="future-indicators">
          <SectionHeading
            eyebrow="未来三个交易日"
            title="现价附近 MA / BOLL 候选值"
            aside={<span className="reachable-badge">有效范围 {range.low.toFixed(2)}～{range.high.toFixed(2)}</span>}
          />
          <div className="future-grid">
            {profile.future.map((day, index) => (
              <article className="future-card" key={`${cycle}-${day.date}`}>
                <div className="future-date"><span>0{index + 1}</span><div><b>{day.date}</b><small>{day.weekday}</small></div>{index === 0 && <em>最近</em>}</div>
                <div className="indicator-list">
                  {day.points.map((point) => {
                    const reachable = point.price >= range.low && point.price <= range.high;
                    return (
                      <div key={point.label} className={!reachable ? "unreachable" : ""}>
                        <span><i className={point.role} />{point.label}</span>
                        <strong>{point.price.toFixed(2)}</strong>
                        <em>{reachable ? (Math.abs(point.price - stock.price) < 0.7 ? "近端" : "可达") : "暂不可达"}</em>
                      </div>
                    );
                  })}
                </div>
              </article>
            ))}
          </div>
          <p className="future-footnote"><i>i</i> 候选值来自假设价格路径下的指标延伸。每个交易日分别检查可达边界，范围外数值只保留为图表参考。</p>
        </section>

        <section className="rule-section" id="rule-center">
          <div className="rule-header">
            <div>
              <p className="eyebrow">用户经验规则层</p>
              <h2>你的经验优先于默认模型</h2>
              <p>自然语言录入后转成结构化规则，由你确认才生效；所有覆盖原因均可追溯。</p>
            </div>
            <button className="button primary" onClick={() => setComposerOpen(true)}><span>＋</span> 录入新经验</button>
          </div>
          <div className="rules-grid">
            {initialRules.map((rule) => {
              const reliability = shrinkReliability(rule.rawScore, rule.effectiveSamples);
              const enabled = ruleEnabled[rule.id];
              return (
                <article className={`rule-card ${enabled ? "enabled" : ""}`} key={rule.id}>
                  <div className="rule-card-head"><span>{rule.id}</span><button onClick={() => setRuleEnabled((current) => ({ ...current, [rule.id]: !enabled }))} className={`switch ${enabled ? "on" : ""}`} aria-label={`${enabled ? "停用" : "启用"}规则 ${rule.id}`}><i /></button></div>
                  <h3>{rule.title}</h3>
                  <p>{rule.scope}</p>
                  <div className="rule-score">
                    <div><small>修正可靠度</small><strong>{reliability ?? "—"}<em>{reliability ? "分" : ""}</em></strong></div>
                    <div><small>原始评分</small><b>{rule.rawScore}</b></div>
                    <div><small>有效样本</small><b>{rule.effectiveSamples}</b></div>
                  </div>
                  <div className="rule-card-foot"><span className={rule.status === "样本不足" ? "warning" : ""}>{rule.status}</span><em>{enabled ? "已参与本次判断" : "已停用"}</em></div>
                  <button className="rule-detail-button" onClick={() => setSelectedRule(rule)}>查看规则详情 <span>→</span></button>
                </article>
              );
            })}
            {customRules.map((rule) => (
              <article className="rule-card enabled fresh" key={rule.id}>
                <div className="rule-card-head"><span>{rule.id}</span><span className="pending-tag">待验证</span></div>
                <h3>{rule.title}</h3>
                <p>短线 · 上涨方向</p>
                <div className="rule-score"><div><small>修正可靠度</small><strong>—</strong></div><div><small>原始评分</small><b>—</b></div><div><small>有效样本</small><b>0</b></div></div>
                <div className="rule-card-foot"><span className="warning">待验证</span><em>已立即生效 · 权重 8</em></div>
                <button className="rule-detail-button" onClick={() => setSelectedRule({ ...rule, scope: "短线 · 上涨方向", status: "待验证" })}>查看规则详情 <span>→</span></button>
              </article>
            ))}
            <button className="rule-add-card" onClick={() => setComposerOpen(true)}><span>＋</span><b>补充一条经验</b><small>自然语言输入，确认后生效</small></button>
          </div>
        </section>
      </div>

      <footer>
        <div><span className="brand mini"><span className="brand-mark"><i /><i /><i /></span><span>位界</span></span><p>只呈现可解释的关键位置，不制造确定性。</p></div>
        <p>演示版本 · 数据非实时 · 不构成任何投资建议</p>
      </footer>

      <nav className="mobile-nav" aria-label="移动端导航">
        <button onClick={() => scrollTo("overview")}><span>⌂</span>总览</button>
        <button onClick={() => scrollTo("profit-mode")}><span>↗</span>模式</button>
        <button onClick={() => scrollTo("future-indicators")}><span>⌁</span>指标</button>
        <button onClick={() => scrollTo("prediction-history")}><span>▤</span>记录</button>
        <button onClick={() => scrollTo("trading-pnl")}><span>￥</span>交易</button>
        <button onClick={() => scrollTo("trading-stats")}><span>▥</span>统计</button>
        <button onClick={() => scrollTo("daily-review")}><span>✓</span>复盘</button>
        <button onClick={() => scrollTo("ai-center")}><span>✦</span>AI</button>
        <button onClick={() => scrollTo("rule-center")}><span>◇</span>规则</button>
      </nav>

      {composerOpen && (
        <RuleComposer
          onClose={() => setComposerOpen(false)}
          onConfirm={(title) => {
            setCustomRules((current) => [...current, { id: `R-${String(8 + current.length).padStart(2, "0")}`, title }]);
            setComposerOpen(false);
            notify("经验规则已确认并立即生效");
          }}
        />
      )}
      {selectedRule && (
        <RuleDetail
          rule={selectedRule}
          enabled={ruleEnabled[selectedRule.id] ?? true}
          onClose={() => setSelectedRule(null)}
          onToggle={() => {
            setRuleEnabled((current) => ({ ...current, [selectedRule.id]: !(current[selectedRule.id] ?? true) }));
            notify((ruleEnabled[selectedRule.id] ?? true) ? "规则已停用" : "规则已启用");
          }}
        />
      )}
      {selectedPrediction && <PredictionDetail record={selectedPrediction} onClose={() => setSelectedPrediction(null)} onSave={updatePrediction} />}
      {toast && <div className="toast" role="status"><span>✓</span>{toast}</div>}
    </main>
  );
}
