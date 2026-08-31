'use client'

import { useState } from 'react'
import { syncNow } from './record-sync'

export function RecordSyncButton({ onSynced }: { onSynced?: () => void }) {
  const [state, setState] = useState<'idle' | 'syncing' | 'done' | 'error'>('idle')
  const sync = async () => {
    setState('syncing')
    try {
      await syncNow()
      onSynced?.()
      setState('done')
    } catch {
      setState('error')
    }
  }
  return <div className="flex items-center gap-3"><button className="min-h-12 rounded-xl border border-[var(--sc-border)] px-4 text-sm font-semibold" disabled={state === 'syncing'} onClick={() => void sync()} type="button">{state === 'syncing' ? '同步中…' : '同步账户数据'}</button>{state === 'done' ? <span className="text-sm text-emerald-700" role="status">已同步</span> : null}{state === 'error' ? <span className="text-sm text-[var(--sc-danger)]" role="status">同步失败，本地数据仍保留</span> : null}</div>
}
