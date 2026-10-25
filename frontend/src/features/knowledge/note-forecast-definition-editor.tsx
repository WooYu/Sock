'use client'

import { useEffect, useRef, useState } from 'react'
import { useDialogFocus } from '../ui/use-dialog-focus'
import { StudioIcon } from '../research/studio-icon'
import { DEFINITION_FIELDS, DEFINITION_ROLES, definitionError, type DefinitionRole, type ForecastDefinition } from './note-forecast-definitions'

export function ForecastDefinitionEditor({ role, title, initial, error, onSave, onCancel }: {
  role: DefinitionRole; title: string; initial?: ForecastDefinition; error: string;
  onSave: (definition: ForecastDefinition, reason: string) => void; onCancel: () => void;
}) {
  const [draft, setDraft] = useState<ForecastDefinition>(() => initial ? { ...initial } : { role, condition: '', timeframe: '', scope: '', invalidation: '', openQuestions: '', state: 'draft' })
  const [reason, setReason] = useState(`${initial ? '修订' : '补充'}${DEFINITION_ROLES[role]}定义`)
  const [validation, setValidation] = useState('')
  const [discard, setDiscard] = useState(false)
  const [dirty, setDirty] = useState(false)
  const panel = useRef<HTMLDivElement>(null)
  const continueButton = useRef<HTMLButtonElement>(null)
  const dirtyRef = useRef(false)
  const cancelRef = useRef(onCancel)
  useEffect(() => { dirtyRef.current = dirty }, [dirty])
  useEffect(() => { cancelRef.current = onCancel }, [onCancel])
  useEffect(() => {
    const originalURL = window.location.href
    const originalState = window.history.state
    const back = () => {
      if (dirtyRef.current) {
        window.history.pushState({ ...originalState, stockcalDefinitionEditor: true }, '', originalURL)
        setDiscard(true)
      } else cancelRef.current()
    }
    window.addEventListener('popstate', back)
    return () => window.removeEventListener('popstate', back)
  }, [])
  useDialogFocus(panel, true, cancel)
  useEffect(() => { if (discard) continueButton.current?.focus({ preventScroll: true }); else if (dirtyRef.current) panel.current?.querySelector<HTMLTextAreaElement>('textarea')?.focus({ preventScroll: true }) }, [discard])
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (dirty) { event.preventDefault(); event.returnValue = '' } }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])
  function cancel() { if (dirty) setDiscard(true); else onCancel() }
  function save(state: ForecastDefinition['state']) {
    const next = { ...draft, state }
    const problem = definitionError(next) || (!reason.trim() ? '请填写修订说明。' : '')
    setValidation(problem)
    if (!problem) onSave(next, reason)
  }
  return <div className="nt-modal-backdrop"><div className="nt-editor nt-definition-editor" role="dialog" aria-modal="true" aria-labelledby="nt-definition-title" aria-describedby="nt-definition-help" ref={panel} tabIndex={-1}>
    <div className="nt-editor-heading"><h2 id="nt-definition-title">{initial ? '编辑定义' : '补充定义'} · {DEFINITION_ROLES[role]}</h2><button className="sc-icon-button" type="button" aria-label="关闭定义编辑" onClick={cancel}><StudioIcon name="close" size={20} /></button></div>
    <p>{title}</p>
    <p id="nt-definition-help" className="nt-muted">先写下明确条件，也可以保存未完成的草稿。定义保存后仍需验证，不会自动启用公式或改变预测。</p>
    <form onSubmit={event => { event.preventDefault(); save('ready') }}>
      <div className="nt-editor-body">
        {Object.entries(DEFINITION_FIELDS).map(([field, label]) => {
          const key = field as keyof typeof DEFINITION_FIELDS
          return <label className="nt-editor-field" key={key} htmlFor={`nt-definition-${key}`}>{label}<textarea id={`nt-definition-${key}`} rows={key === 'condition' ? 4 : 2} maxLength={5000} value={draft[key]} placeholder={key === 'openQuestions' ? '仍不确定的参数或依据；有待补问题时请保存草稿。' : key === 'timeframe' ? '例如：日线收盘，或 15 分钟 K 线。' : key === 'invalidation' ? '什么情况下不再适用？如无退出条件，请说明原因。' : undefined} onChange={event => { setDraft(previous => ({ ...previous, [key]: event.target.value })); setDirty(true); setValidation('') }} /></label>
        })}
        <label className="nt-editor-field" htmlFor="nt-definition-reason">修订说明<input id="nt-definition-reason" value={reason} maxLength={500} onChange={event => { setReason(event.target.value); setDirty(true) }} /></label>
        {error || validation ? <p className="kw-alert" role="alert">{error || validation}</p> : null}
      </div>
      <footer className="nt-editor-footer">
        {discard ? <div className="nt-discard-prompt" role="alert"><span>有未保存的定义，确定放弃修改吗？</span><button ref={continueButton} className="kw-button" type="button" onClick={() => setDiscard(false)}>继续编辑</button><button className="kw-button" type="button" onClick={onCancel}>放弃修改</button></div> : <><button className="kw-button" type="button" onClick={cancel}>取消定义编辑</button><button className="kw-button" type="button" onClick={() => save('draft')}>保存草稿</button><button className="kw-button kw-primary" type="submit">保存并标记待验证</button></>}
      </footer>
    </form>
  </div></div>
}
