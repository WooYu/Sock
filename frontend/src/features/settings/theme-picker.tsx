'use client'

import { useSyncExternalStore } from 'react'

const storageKey = 'stockcal-theme'
const changeEvent = 'stockcal-theme-change'
type Theme = 'c' | 'd'

function snapshot(): Theme {
  return document.documentElement.dataset.theme === 'd' ? 'd' : 'c'
}

function subscribe(notify: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key !== storageKey && event.key !== null) return
    document.documentElement.setAttribute('data-theme', event.newValue === 'd' ? 'd' : 'c')
    notify()
  }
  window.addEventListener(changeEvent, notify)
  window.addEventListener('storage', onStorage)
  return () => {
    window.removeEventListener(changeEvent, notify)
    window.removeEventListener('storage', onStorage)
  }
}

export function ThemePicker() {
  const theme = useSyncExternalStore(subscribe, snapshot, () => 'c' as const)
  function select(next: Theme) {
    document.documentElement.setAttribute('data-theme', next)
    try { localStorage.setItem(storageKey, next) } catch { /* Still apply when storage is unavailable. */ }
    window.dispatchEvent(new Event(changeEvent))
  }
  return <section className="sc-settings-section sc-theme-section" aria-labelledby="theme-heading">
    <h2 id="theme-heading">外观主题</h2>
    <p className="sc-theme-description">选择适合你的阅读方式，自动记住本机偏好。</p>
    <div className="sc-theme-options" role="group" aria-label="外观主题">
      {([
        ['c', 'C · 清爽自然', '等线 · 灰绿配色，柔和耐看'],
        ['d', 'D · 深色科技', '雅黑 · 深蓝青色，突出行情数字'],
      ] as const).map(([key, title, description]) => <button key={key} type="button"
        className="sc-theme-option" data-palette={key} aria-pressed={theme === key}
        onClick={() => select(key)}>
        <span className="sc-theme-swatches" aria-hidden="true"><i /><i /><i /></span>
        <strong>{title}</strong><span>{description}</span>
        <small>{theme === key ? '当前使用' : '使用此主题'}</small>
      </button>)}
    </div>
  </section>
}
