import type { RuleRecord } from './rules-page'

export const builtInRules: RuleRecord[] = [
  { id: 'builtin-5ma-priority', title: '5日线上方优先参与', description: '5日线以上是最基础的参与要求；条件不足时只观察，不强行交易。', status: 'published', source: '内置 · 买股原则2.md', mode: 'BASE_GRANVILLE', action: 'WAIT', timeframe: '日线', priority: 10 },
  { id: 'builtin-uptrend-only', title: '只做上升趋势，回避均线向下', description: '5日线、10日线向下时不参与；优先选择均线抬头、价格站上均线的结构。', status: 'published', source: '内置 · 买股原则2.md', mode: 'EXCLUSION', action: 'AVOID', timeframe: '日线', priority: 15 },
  { id: 'builtin-panic-sea-turtle', title: '大盘暴跌时优先看海龟', description: '大盘暴跌阶段，优先观察相对强势、筑底或仍在5日线起步的个股。', status: 'published', source: '内置 · 海龟.md', mode: 'SEA_TURTLE', action: 'ENTER', timeframe: '日线', priority: 30 },
  { id: 'builtin-granville-day-one', title: '葛兰碧第一天才参与', description: '短线优先选择从5日线附近起步的葛兰碧第一天，避免追逐已经大涨的阶段。', status: 'published', source: '内置 · 买股原则2.md', mode: 'BASE_GRANVILLE', action: 'ENTER', timeframe: '日线', priority: 35 },
  { id: 'builtin-granville-day-two-exit', title: '葛兰碧第二天优先出局', description: '葛兰碧短线原则以两天为主要窗口，最迟不超过基础规则允许的退出时间。', status: 'published', source: '内置 · 买股原则2.md', mode: 'BASE_GRANVILLE', action: 'EXIT', timeframe: '日线', priority: 90 },
  { id: 'builtin-phase-three-hold', title: '攀升沿5日线或BOLL持股', description: '三期开口攀升时，5日线或BOLL线作为底线；底线不破才继续观察。', status: 'published', source: '内置 · 盈利模式.md', mode: 'PHASE3_OPENING', action: 'HOLD', timeframe: '日线', priority: 45 },
  { id: 'builtin-break-five-exit', title: '破位5日线不做', description: '破位5日线是不做和退出的底线，尤其不能把弱势反弹当成反转。', status: 'published', source: '内置 · 五日线.md', mode: 'EXCLUSION', action: 'EXIT', timeframe: '日线', priority: 100 },
  { id: 'builtin-mirror-retest', title: '压力支撑互换后再判断', description: '照镜子表示压力位与支撑位互换；触及BOLL上轨后等待确认，不把一次触线当成突破。', status: 'published', source: '内置 · 照镜子.md', mode: 'MIRROR_RETEST', action: 'REDUCE', timeframe: '日线', priority: 70 },
  { id: 'builtin-break-twenty-avoid', title: '跌破BOLL中轨不做', description: '破位20日线或BOLL中轨后远离不确定，不为了凑出买入结论而介入。', status: 'published', source: '内置 · 买股原则2.md', mode: 'EXCLUSION', action: 'AVOID', timeframe: '日线', priority: 95 },
  { id: 'builtin-monthly-wait', title: '月线条件不完整时等待', description: '月线级别允许空仓等待和持续更新判断；条件不完整时输出等待，不给单点结论。', status: 'published', source: '内置 · 20220915_收盘_月线炒股法.md', mode: 'MONTHLY_WAIT', action: 'WAIT', timeframe: '月线', priority: 80 },
]
