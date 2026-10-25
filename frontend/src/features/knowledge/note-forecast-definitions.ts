import type { NoteTagRecord } from './note-tags'

export const DEFINITION_ROLES = {
  calculation: '参数计算候选', entry: '入场条件', target: '目标／压力参考', bottom: '持仓底线',
  exit: '退出／期限条件', context: '适用场景', validation: '案例验证',
} as const
export type DefinitionRole = keyof typeof DEFINITION_ROLES
export type ForecastDefinition = {
  role: DefinitionRole; condition: string; timeframe: string; scope: string; invalidation: string;
  openQuestions: string; state: 'draft' | 'ready'
}
export const DEFINITION_FIELDS = {
  condition: '条件或计算方法', timeframe: '适用周期', scope: '适用场景', invalidation: '失效或退出条件', openQuestions: '待补问题',
} as const

export function definitionError(value: ForecastDefinition): string {
  if (typeof value.role !== 'string' || !Object.hasOwn(DEFINITION_ROLES, value.role) || !['draft', 'ready'].includes(value.state)) return '定义类型或状态无效。'
  const keys = Object.keys(DEFINITION_FIELDS) as Array<keyof typeof DEFINITION_FIELDS>
  for (const key of keys) {
    if (typeof value[key] !== 'string' || value[key].length > 5000) return `${DEFINITION_FIELDS[key]}须为不超过 5000 字的文本。`
  }
  if (!keys.some(key => value[key].trim())) return '请至少填写一项定义内容。'
  if (value.state === 'ready') {
    for (const key of keys.filter(key => key !== 'openQuestions')) if (!value[key].trim()) return `请补充${DEFINITION_FIELDS[key]}，或先保存草稿。`
    if (value.openQuestions.trim()) return '仍有待补问题，请先保存草稿。'
  }
  return ''
}

export function isForecastDefinition(value: unknown): value is ForecastDefinition {
  return Boolean(value && typeof value === 'object' && !definitionError(value as ForecastDefinition))
}

/** Human definitions are research records, never compiled or validated trading rules. */
export function reviseForecastDefinition(previous: NoteTagRecord, definition: ForecastDefinition, reason: string, createdAt: string): NoteTagRecord {
  if (!reason.trim()) throw new Error('请填写修订说明。')
  const error = definitionError(definition)
  if (error) throw new Error(error)
  const clean = { ...definition }
  for (const key of Object.keys(DEFINITION_FIELDS) as Array<keyof typeof DEFINITION_FIELDS>) clean[key] = clean[key].trim()
  return { ...previous, forecastDefinitions: [...(previous.forecastDefinitions ?? []).filter(item => item.role !== clean.role).map(item => ({ ...item })), clean],
    version: previous.version + 1, previousVersion: previous.version, createdAt, revisionReason: `预估作用定义：${reason.trim()}` }
}
