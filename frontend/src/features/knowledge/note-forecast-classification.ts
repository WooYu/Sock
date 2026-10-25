import type { NoteTagRecord, SourceReference } from './note-tags'
import type { ScenarioRule } from '../scenario/scenario-types'

/** Derived from source evidence and compiled definitions, never from tag review status. */
export const FORECAST_ROLES = {
  calculation: '参数计算候选', entry: '入场条件', target: '目标／压力参考',
  bottom: '持仓底线', exit: '退出／期限条件', context: '适用场景', validation: '案例验证',
  unclassified: '尚无预估用途依据',
} as const
export type ForecastRole = keyof typeof FORECAST_ROLES
export type ForecastClassification = {
  role: ForecastRole; status: 'candidate' | 'defined'; ruleIds: string[]; evidence: SourceReference[]
}
const actionRole: Record<ScenarioRule['action'], ForecastRole> = {
  block_entry: 'entry', target: 'target', bottom: 'bottom', deadline: 'exit', context: 'context',
}
const candidatePatterns: Partial<Record<ForecastRole, RegExp>> = {
  calculation: /计算公式|计算方法|计算参数|均线参数|参数计算|(?:MA\d*|BOLL|均线|参数|股价)\s*[=＝]/i,
  entry: /买入|买股|入场|进场|建仓|开仓|做多|做空|空仓|参与条件|才参与|金叉/,
  target: /目标价|压力|上轨|支撑/,
  bottom: /底线|持有|持仓/,
  exit: /卖出|卖股|退出|止损|减仓/,
  context: /攀升|飙升|双高|照镜子|上涨|下跌|横盘|震荡|三期|反抽|均线向[上下]/,
  validation: /案例|复盘|回测/,
}

export function classifyNoteForForecast(record: NoteTagRecord, registry: ScenarioRule[], canonical?: NoteTagRecord): ForecastClassification[] {
  const result = new Map<ForecastRole, ForecastClassification>()
  for (const rule of registry) {
    const evidence = rule.evidence.filter(e => e.sourceHash === record.sourceHash
      && (e.recordId === record.id || record.level === 'document' && e.recordId.startsWith(`fragment:${record.file}:`)))
    // A missing source cannot acquire a defined role merely by retaining an ID.
    if (!evidence.length || rule.undefinedConditions.some(condition => condition.startsWith('source_missing:'))) continue
    const role = actionRole[rule.action]
    const previous = result.get(role)
    result.set(role, { role, status: 'defined', ruleIds: [...(previous?.ruleIds ?? []), rule.id],
      evidence: [...(previous?.evidence ?? []), ...evidence] })
  }
  // Candidates route source review only. They cannot manufacture an executable rule.
  const quoteKey = (e: SourceReference) => JSON.stringify([e.startLine, e.endLine, e.quote])
  // The excerpt may only contain the first paragraph. Later quotations must match
  // the frozen catalog's source-bound evidence, rather than an arbitrary local revision.
  const trusted = new Set(canonical?.id === record.id && canonical.file === record.file && canonical.sourceHash === record.sourceHash
    && canonical.sourceExcerpt === record.sourceExcerpt
    ? [...(canonical.sourceReferences ?? []), ...canonical.evidence].map(quoteKey) : [])
  const quotes = [...(record.sourceReferences ?? []), ...record.evidence].filter(e => (record.sourceExcerpt.includes(e.quote) || trusted.has(quoteKey(e)))
    && e.quote.trim() && e.startLine >= 1 && e.endLine >= e.startLine)
  for (const [role, pattern] of Object.entries(candidatePatterns) as Array<[ForecastRole, RegExp]>) {
    if (result.has(role)) continue
    const evidence = quotes.filter(e => {
      const prose = e.quote.replace(/!?\[[^\]]*\]\([^)]*\)/g, '').replace(/https?:\/\/\S+/g, '')
        .split(/\r?\n/).filter(line => !/^\s*(?:title|tags|date|source|file|附件|标题|标签)\s*[:：]/i.test(line)).join('\n')
      return pattern.test(prose)
    })
    if (evidence.length) result.set(role, { role, status: 'candidate', ruleIds: [], evidence })
  }
  if (!result.size) result.set('unclassified', { role: 'unclassified', status: 'candidate', ruleIds: [], evidence: [] })
  return [...result.values()].map(item => ({ ...item, evidence: [...new Map(item.evidence.map(e =>
    [JSON.stringify([e.startLine, e.endLine, e.quote]), { startLine: e.startLine, endLine: e.endLine, quote: e.quote }])).values()] }))
}

/** Only source-backed, already compiled roles enter execution; candidate keywords never do. */
export function forecastRegistryForRecords(records: NoteTagRecord[], registry: ScenarioRule[]): ScenarioRule[] {
  const defined = new Set(records.flatMap(record => classifyNoteForForecast(record, registry)
    .filter(item => item.status === 'defined').flatMap(item => item.ruleIds)))
  return registry.filter(rule => defined.has(rule.id))
}
