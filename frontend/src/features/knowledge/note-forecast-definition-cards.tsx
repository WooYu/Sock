import { useState } from 'react'
import { DEFINITION_ROLES, type DefinitionRole } from './note-forecast-definitions'
import { FORECAST_ROLES, type ForecastClassification } from './note-forecast-classification'
import type { NoteTagRecord } from './note-tags'
import type { ScenarioRule } from '../scenario/scenario-types'

export function ForecastDefinitionCards({ record, classifications, registry, readOnly, disabled, onEdit }: {
  record: NoteTagRecord; classifications: ForecastClassification[]; registry: ScenarioRule[];
  readOnly: boolean; disabled: boolean; onEdit: (role: DefinitionRole) => void;
}) {
  const [adding, setAdding] = useState(false)
  const [newRole, setNewRole] = useState<DefinitionRole>('context')
  const roles = [...new Set([...classifications.map(item => item.role), ...(record.forecastDefinitions ?? []).map(item => item.role)])]
  return <section className="nt-detail-card nt-purpose-section" aria-label="笔记的预估作用">
    <div className="nt-card-heading"><h4>预估作用</h4>{!readOnly ? <button type="button" className="kw-button" aria-expanded={adding} onClick={() => setAdding(value => !value)}>补充其他用途</button> : null}</div>
    <p className="nt-muted">标签核对只确认分类。补齐具体条件后，再通过研究验证其效果。</p>
    {adding && !readOnly ? <div className="nt-add-purpose"><label>选择用途<select value={newRole} onChange={event => setNewRole(event.target.value as DefinitionRole)}>{Object.entries(DEFINITION_ROLES).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label><button className="kw-button" type="button" disabled={disabled} onClick={() => onEdit(newRole)}>编辑所选用途</button></div> : null}
    <div className="nt-purpose-list">{roles.map(role => {
      const item = classifications.find(item => item.role === role)
      const definition = record.forecastDefinitions?.find(item => item.role === role)
      const state = definition ? definition.state === 'ready' ? '已定义、待验证' : '定义草稿' : '待补充定义'
      return <details className="nt-purpose-card nt-purpose-disclosure" key={role}>
        <summary className="nt-purpose-heading"><strong>{FORECAST_ROLES[role]}</strong>{role !== 'unclassified' ? <span className={`nt-definition-state${definition?.state === 'ready' ? ' is-ready' : ''}`}>{state}</span> : null}<span className="nt-purpose-hint">展开详情</span></summary>
        <div className="nt-purpose-body">
        {role !== 'unclassified' && !readOnly ? <button className="kw-button" type="button" disabled={disabled} aria-label={`${definition ? '编辑定义' : '补充定义'}：${FORECAST_ROLES[role]}`} onClick={() => onEdit(role)}>{definition ? '编辑定义' : '补充定义'}</button> : null}
        {definition ? <><p className="nt-definition-condition">{definition.condition || '条件或计算方法尚未填写'}</p><details className="nt-definition-content"><summary>查看定义内容</summary><dl><dt>适用周期</dt><dd>{definition.timeframe || '待补充'}</dd><dt>适用场景</dt><dd>{definition.scope || '待补充'}</dd><dt>失效或退出条件</dt><dd>{definition.invalidation || '待补充'}</dd>{definition.openQuestions ? <><dt>待补问题</dt><dd>{definition.openQuestions}</dd></> : null}</dl></details></> : <p className="nt-muted">{role === 'unclassified' ? '尚未找到明确用途，可通过“补充其他用途”记录你的定义。' : '补充判断条件、适用周期和失效边界，或先保存草稿。'}</p>}
        {item?.status === 'defined' ? <details className="nt-linked-rules"><summary>已关联条件规则，是否适用另行核对</summary>{item.ruleIds.map(id => <p key={id}>{registry.find(rule => rule.id === id)?.name}</p>)}</details> : null}
        {item?.evidence.length ? <details className="nt-purpose-evidence"><summary>查看原文依据 · {item.evidence.length} 段</summary>{item.evidence.map(e => <blockquote key={`${e.startLine}:${e.endLine}:${e.quote}`}>L{e.startLine}–{e.endLine}：{e.quote}</blockquote>)}</details> : null}
      </div></details>
    })}</div>
  </section>
}
