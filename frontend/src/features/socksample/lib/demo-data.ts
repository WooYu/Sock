export type CycleKey = "short" | "swing" | "long";
export type ZoneTone = "rise" | "fall";

export type ZoneSource = {
  name: string;
  date: string;
  price: number;
  weight: number;
  origin: "经验规则" | "多周期共振" | "双模型一致" | "单模型";
};

export type KeyZone = {
  id: string;
  label: string;
  tone: ZoneTone;
  role: string;
  price: number;
  range: [number, number];
  probability: number;
  touches: number;
  window: string;
  strength: number;
  note: string;
  trigger: string;
  invalidation: string;
  sources: ZoneSource[];
};

export type IndicatorPoint = {
  label: string;
  price: number;
  reachable: boolean;
  role: "ma" | "boll";
};

export type FutureDay = {
  date: string;
  weekday: string;
  points: IndicatorPoint[];
};

export type CycleProfile = {
  label: string;
  horizon: string;
  score: number;
  direction: string;
  directionScore: number;
  thesis: string;
  confidence: string;
  modelA: string;
  modelB: string;
  zones: KeyZone[];
  future: FutureDay[];
};

const source = (
  name: string,
  date: string,
  price: number,
  weight: number,
  origin: ZoneSource["origin"],
): ZoneSource => ({ name, date, price, weight, origin });

export const stock = {
  name: "华芯动力",
  code: "DEMO·001",
  market: "深市主板示例",
  price: 32.68,
  change: 0.86,
  changePct: 2.7,
  open: 31.92,
  high: 32.96,
  low: 31.74,
  previousClose: 31.82,
  volume: "48.2万手",
  turnover: "4.28%",
  atr: 1.12,
  legalLimitPct: 0.1,
  updatedAt: "收盘后 15:18",
};

const shortZones: KeyZone[] = [
  {
    id: "up-key",
    label: "上涨关键区",
    tone: "rise",
    role: "先看这里",
    price: 33.24,
    range: [33.05, 33.48],
    probability: 72,
    touches: 1.8,
    window: "1～2个交易日",
    strength: 4,
    note: "日线 MA5 上移与周线 BOLL 中轨形成近端共振，经验规则将代表价上调至 33.24。",
    trigger: "放量站稳 33.48，确认向上突破",
    invalidation: "回落并收于 32.78 下方",
    sources: [
      source("用户规则 R-07 · 周线均线优先", "本周", 33.24, 8, "经验规则"),
      source("日线 MA5", "08/04", 33.18, 4, "多周期共振"),
      source("周线 BOLL 中轨", "本周", 33.31, 4, "多周期共振"),
      source("路径模型 A/B", "未来2日", 33.42, 2, "双模型一致"),
    ],
  },
  {
    id: "up-target",
    label: "上涨目标区",
    tone: "rise",
    role: "强势延伸",
    price: 34.12,
    range: [33.88, 34.19],
    probability: 48,
    touches: 1.2,
    window: "3～4个交易日",
    strength: 3,
    note: "接近有效波动范围上沿，需前一关键区完成突破后才激活。",
    trigger: "33.48 上方连续两小时保持强势",
    invalidation: "量能回落且重新跌入 33.05 下方",
    sources: [
      source("日线 BOLL 上轨", "08/06", 34.12, 4, "多周期共振"),
      source("周线 MA10", "本周", 34.08, 4, "多周期共振"),
      source("路径模型 A", "未来4日", 34.16, 1, "单模型"),
    ],
  },
  {
    id: "down-support",
    label: "下跌支撑区",
    tone: "fall",
    role: "首要防守",
    price: 31.92,
    range: [31.72, 32.08],
    probability: 68,
    touches: 1.6,
    window: "1～3个交易日",
    strength: 4,
    note: "前收盘密集区与未来 MA10 重叠，路径回撤模型在此处出现明显收敛。",
    trigger: "回踩区间后 30 分钟内重新站上 32.08",
    invalidation: "放量跌破 31.72",
    sources: [
      source("用户规则 R-03 · 前收密集区", "当前", 31.92, 8, "经验规则"),
      source("日线 MA10", "08/05", 31.88, 4, "多周期共振"),
      source("路径模型 A/B", "未来3日", 31.96, 2, "双模型一致"),
    ],
  },
  {
    id: "down-risk",
    label: "下跌风险位",
    tone: "fall",
    role: "破位确认",
    price: 31.2,
    range: [31.17, 31.36],
    probability: 34,
    touches: 1.1,
    window: "2～4个交易日",
    strength: 2,
    note: "位于实际展示范围下沿，若有效跌破则短线判断转为空头占优。",
    trigger: "日线收于 31.17 下方",
    invalidation: "快速收复 31.72",
    sources: [
      source("日线 BOLL 下轨", "08/06", 31.2, 4, "多周期共振"),
      source("路径模型 B", "未来4日", 31.28, 1, "单模型"),
    ],
  },
];

const futureShort: FutureDay[] = [
  {
    date: "08/04",
    weekday: "周二",
    points: [
      { label: "MA5", price: 33.18, reachable: true, role: "ma" },
      { label: "MA10", price: 31.81, reachable: true, role: "ma" },
      { label: "MA20", price: 31.36, reachable: true, role: "ma" },
      { label: "BOLL上", price: 33.94, reachable: true, role: "boll" },
      { label: "BOLL中", price: 31.36, reachable: true, role: "boll" },
      { label: "BOLL下", price: 28.78, reachable: false, role: "boll" },
    ],
  },
  {
    date: "08/05",
    weekday: "周三",
    points: [
      { label: "MA5", price: 33.34, reachable: true, role: "ma" },
      { label: "MA10", price: 31.88, reachable: true, role: "ma" },
      { label: "MA20", price: 31.42, reachable: true, role: "ma" },
      { label: "BOLL上", price: 34.03, reachable: true, role: "boll" },
      { label: "BOLL中", price: 31.42, reachable: true, role: "boll" },
      { label: "BOLL下", price: 28.81, reachable: false, role: "boll" },
    ],
  },
  {
    date: "08/06",
    weekday: "周四",
    points: [
      { label: "MA5", price: 33.47, reachable: true, role: "ma" },
      { label: "MA10", price: 31.96, reachable: true, role: "ma" },
      { label: "MA20", price: 31.49, reachable: true, role: "ma" },
      { label: "BOLL上", price: 34.12, reachable: true, role: "boll" },
      { label: "BOLL中", price: 31.49, reachable: true, role: "boll" },
      { label: "BOLL下", price: 28.86, reachable: false, role: "boll" },
    ],
  },
];

const moveZone = (zone: KeyZone, delta: number, probabilityDelta: number): KeyZone => ({
  ...zone,
  price: Number((zone.price + delta).toFixed(2)),
  range: [
    Number((zone.range[0] + delta).toFixed(2)),
    Number((zone.range[1] + delta).toFixed(2)),
  ],
  probability: Math.max(18, Math.min(88, zone.probability + probabilityDelta)),
  window: delta > 0.4 ? "5～12个交易日" : "3～8个交易日",
  sources: zone.sources.map((item) => ({ ...item, price: Number((item.price + delta).toFixed(2)) })),
});

export const cycleProfiles: Record<CycleKey, CycleProfile> = {
  short: {
    label: "短线",
    horizon: "未来 1～4 日",
    score: 86,
    direction: "多头占优",
    directionScore: 64,
    thesis: "近端均线拐头向上，但 33.48 上方仍需要量能确认；先看共振区是否由压力转为支撑。",
    confidence: "较高",
    modelA: "偏多 · 68%路径向上",
    modelB: "偏多 · 波动收敛后上移",
    zones: shortZones,
    future: futureShort,
  },
  swing: {
    label: "波段",
    horizon: "未来 5～20 日",
    score: 74,
    direction: "震荡偏多",
    directionScore: 57,
    thesis: "周线结构仍在修复，34.60～35.10 是波段确认区；未突破前以箱体思路观察。",
    confidence: "中等",
    modelA: "偏多 · 中枢缓慢上移",
    modelB: "中性 · 区间概率较高",
    zones: shortZones.map((zone, index) => moveZone(zone, index < 2 ? 0.62 : -0.38, -8)),
    future: futureShort.map((day) => ({
      ...day,
      points: day.points.map((point) => ({ ...point, price: Number((point.price + 0.22).toFixed(2)) })),
    })),
  },
  long: {
    label: "中长线",
    horizon: "周线 / 月线",
    score: 61,
    direction: "中性观察",
    directionScore: 51,
    thesis: "月线尚未完成趋势确认，当前价更接近长期估值中枢；以周线收盘确认替代盘中追价。",
    confidence: "审慎",
    modelA: "中性 · 长周期样本不足",
    modelB: "中性 · 月线仍在整理",
    zones: shortZones.map((zone, index) => moveZone(zone, index < 2 ? 1.24 : -0.84, -15)),
    future: futureShort.map((day) => ({
      ...day,
      points: day.points.map((point) => ({ ...point, price: Number((point.price + 0.46).toFixed(2)) })),
    })),
  },
};

export const candles = [
  [30.86, 31.38, 30.62, 31.14],
  [31.16, 31.52, 30.9, 31.34],
  [31.32, 31.48, 30.76, 30.94],
  [30.92, 31.18, 30.55, 30.74],
  [30.72, 31.1, 30.64, 30.98],
  [31.02, 31.56, 30.88, 31.42],
  [31.45, 31.88, 31.3, 31.76],
  [31.78, 32.12, 31.54, 31.92],
  [31.9, 32.24, 31.63, 31.72],
  [31.7, 31.96, 31.28, 31.44],
  [31.42, 31.82, 31.18, 31.68],
  [31.66, 32.06, 31.48, 31.98],
  [32.0, 32.38, 31.72, 32.26],
  [32.24, 32.5, 31.94, 32.08],
  [32.06, 32.44, 31.88, 32.34],
  [32.36, 32.62, 32.04, 32.18],
  [32.16, 32.54, 31.92, 32.42],
  [31.92, 32.96, 31.74, 32.68],
] as const;

export const rules = [
  {
    id: "R-07",
    title: "短线关键位优先参考未来四日日线与周线均线 / BOLL",
    scope: "短线 · 双向",
    rawScore: 78,
    samples: 46,
    effectiveSamples: 38,
    status: "初步验证",
  },
  {
    id: "R-03",
    title: "前收密集区与未来 MA10 重叠时，优先作为首要支撑",
    scope: "短线 · 下跌方向",
    rawScore: 72,
    samples: 18,
    effectiveSamples: 14,
    status: "样本不足",
  },
];

