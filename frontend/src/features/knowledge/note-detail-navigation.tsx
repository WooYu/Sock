import type { KeyboardEvent } from 'react'

export const NOTE_DETAIL_TABS = [
  { id: 'overview', label: '概览' },
  { id: 'source', label: '原文与依据' },
  { id: 'history', label: '版本历史' },
] as const
export type NoteDetailTab = typeof NOTE_DETAIL_TABS[number]['id']

export function NoteDetailNavigation({ active, onChange }: { active: NoteDetailTab; onChange: (tab: NoteDetailTab) => void }) {
  function keyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const next = event.key === 'ArrowRight' ? (index + 1) % NOTE_DETAIL_TABS.length
      : event.key === 'ArrowLeft' ? (index + NOTE_DETAIL_TABS.length - 1) % NOTE_DETAIL_TABS.length
        : event.key === 'Home' ? 0 : event.key === 'End' ? NOTE_DETAIL_TABS.length - 1 : null
    if (next === null) return
    event.preventDefault()
    onChange(NOTE_DETAIL_TABS[next].id)
    event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus()
  }
  return <div className="nt-detail-tabs" role="tablist" aria-label="笔记详情视图">
    {NOTE_DETAIL_TABS.map((tab, index) => <button key={tab.id} type="button" role="tab" id={`nt-tab-${tab.id}`} aria-controls={`nt-panel-${tab.id}`} aria-selected={active === tab.id} tabIndex={active === tab.id ? 0 : -1} onClick={() => onChange(tab.id)} onKeyDown={event => keyDown(event, index)}>{tab.label}</button>)}
  </div>
}

/** Readable source excerpt; render text only so source HTML is never executed. */
export function NoteExcerpt({ text }: { text: string }) {
  return <div className="nt-note-prose">{text.split(/\r?\n\s*\r?\n/).filter(block => block.trim()).map((block, index) => {
    const lines = block.split(/\r?\n/)
    if (lines.every(line => /^\s*(?:[-*+]\s+|\[[ xX]\]\s+)/.test(line))) return <ul key={index}>{lines.map((line, lineIndex) => <li key={lineIndex}>{line.replace(/^\s*(?:[-*+]\s+)?(?:\[[ xX]\]\s+)?/, '')}</li>)}</ul>
    if (lines.length === 1 && /^#{1,6}\s/.test(block)) return <h5 key={index}>{block.replace(/^#{1,6}\s+/, '')}</h5>
    return <p key={index}>{block}</p>
  })}</div>
}
