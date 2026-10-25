"use client"
import { useEffect, useState } from 'react'
import { SharedDataSync } from './shared-data-sync'

export function SharedDataSyncProvider() {
  const [status, setStatus] = useState('所有账号共享 · 正在连接')
  useEffect(() => {
    let sync: SharedDataSync
    try { sync = new SharedDataSync(localStorage) } catch { queueMicrotask(() => setStatus('共享同步记录不可读取')); return }
    let active = true
    const run = () => { void sync.sync().catch(() => { if (active) setStatus(navigator.onLine ? '共享同步待重试 · 本机记录已保留' : '离线 · 联网后自动同步') }) }
    const statusChange = (event: Event) => { if (active) setStatus((event as CustomEvent<string>).detail) }
    window.addEventListener('stockcal:shared-sync-status', statusChange)
    window.addEventListener('online', run)
    window.addEventListener('focus', run)
    window.addEventListener('stockcal:identity-change', run)
    const capture = () => sync.capture()
    document.addEventListener('visibilitychange', capture)
    window.addEventListener('pagehide', capture)
    const interval = setInterval(run, 3000)
    run()
    return () => { active = false; clearInterval(interval); window.removeEventListener('stockcal:shared-sync-status', statusChange); window.removeEventListener('online', run); window.removeEventListener('focus', run); window.removeEventListener('stockcal:identity-change', run); document.removeEventListener('visibilitychange', capture); window.removeEventListener('pagehide', capture) }
  }, [])
  return <div role="status" className="px-4 py-1 text-xs text-center text-[var(--sc-text-muted)]">{status}</div>
}
