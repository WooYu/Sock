'use client'

import { useId, useRef, useState, useSyncExternalStore, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { useDialogFocus } from '../ui/use-dialog-focus'
import { StudioIcon } from '../research/studio-icon'

type AuthFn = (phone: string) => Promise<unknown>
type VerifyFn = (phone: string, code: string) => Promise<{ accessToken: string; refreshToken: string; expiresAt: string }>
const requestAuthCode: AuthFn = async phone => {
  const response = await fetch('/api/auth/request-code', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone }) })
  if (!response.ok) throw new Error('验证码发送失败')
}
const verifyAuth: VerifyFn = async (phone, code) => {
  const response = await fetch('/api/auth/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone, code }) })
  if (!response.ok) throw new Error('登录失败')
  return response.json()
}
const subscribeIdentity = (listener: () => void) => {
  window.addEventListener('stockcal:identity-change', listener)
  window.addEventListener('storage', listener)
  return () => { window.removeEventListener('stockcal:identity-change', listener); window.removeEventListener('storage', listener) }
}
const signedInSnapshot = () => Boolean(window.localStorage.getItem('stockcal.accessToken'))
const signedOutSnapshot = () => false

export function WebAccountButton({ requestCode = requestAuthCode, verify = verifyAuth }: { requestCode?: AuthFn; verify?: VerifyFn }) {
  const [open, setOpen] = useState(false)
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState<'code' | 'login' | null>(null)
  const dialog = useRef<HTMLElement>(null)
  const phoneInput = useRef<HTMLInputElement>(null)
  const requestVersion = useRef(0)
  const titleId = useId()
  const errorId = useId()
  const signedIn = useSyncExternalStore(subscribeIdentity, signedInSnapshot, signedOutSnapshot)
  const close = () => { requestVersion.current++; setOpen(false); setPending(null) }
  useDialogFocus(dialog, open, close)
  const validPhone = () => {
    if (/^1[3-9]\d{9}$/.test(phone.trim())) return true
    setError('请填写有效的 11 位手机号。')
    phoneInput.current?.focus()
    return false
  }
  const sendCode = async () => {
    if (pending || !validPhone()) return
    const version = ++requestVersion.current
    setError(''); setMessage(''); setPending('code')
    try {
      await requestCode(phone.trim())
      if (version === requestVersion.current) setMessage('验证码已发送，请查看短信。')
    } catch {
      if (version === requestVersion.current) setError('验证码发送失败，请稍后重试。')
    } finally { if (version === requestVersion.current) setPending(null) }
  }
  const login = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (pending || !validPhone()) return
    if (!code.trim()) { setError('请填写短信验证码。'); return }
    const version = ++requestVersion.current
    setError(''); setMessage(''); setPending('login')
    try {
      const session = await verify(phone.trim(), code.trim())
      if (version !== requestVersion.current) return
      window.localStorage.setItem('stockcal.accessToken', session.accessToken)
      window.localStorage.setItem('stockcal.refreshToken', session.refreshToken)
      close()
      window.dispatchEvent(new Event('stockcal:identity-change'))
    } catch {
      if (version === requestVersion.current) setError('登录失败，请核对手机号和验证码后重试。')
    } finally { if (version === requestVersion.current) setPending(null) }
  }
  if (signedIn) return <div className="sc-account-signed"><span>已登录 · 跨设备同步</span><button onClick={() => {
    window.localStorage.removeItem('stockcal.accessToken'); window.localStorage.removeItem('stockcal.refreshToken')
    window.dispatchEvent(new Event('stockcal:identity-change'))
  }} type="button">退出登录</button></div>
  return <div className="sc-account-wrap">
    <button className="sc-account-sync" aria-haspopup="dialog" aria-expanded={open} onClick={() => { setError(''); setMessage(''); setOpen(true) }} type="button">登录同步</button>
    {open ? createPortal(<div className="sc-dialog-backdrop" onPointerDown={event => { if (event.target === event.currentTarget) close() }}>
      <section className="sc-account-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} ref={dialog} tabIndex={-1}>
        <header><div><h2 id={titleId}>登录 StockCal</h2><p>在不同设备继续使用研究工作台。</p></div><button className="sc-dialog-close" aria-label="关闭登录" onClick={close} type="button"><StudioIcon name="close" size={18} /></button></header>
        <form onSubmit={event => void login(event)} aria-busy={pending !== null}>
          <label>手机号<input aria-label="手机号" ref={phoneInput} inputMode="tel" autoComplete="tel" maxLength={11} placeholder="请输入手机号" aria-describedby={error ? errorId : undefined} onChange={event => { setPhone(event.target.value); setError('') }} value={phone} /></label>
          <div className="sc-account-code-row"><label>验证码<input aria-label="验证码" inputMode="numeric" autoComplete="one-time-code" placeholder="短信验证码" maxLength={8} onChange={event => { setCode(event.target.value); setError('') }} value={code} /></label><button disabled={pending !== null} onClick={() => void sendCode()} type="button">{pending === 'code' ? '发送中…' : '获取验证码'}</button></div>
          {error ? <p id={errorId} role="alert">{error}</p> : null}{message ? <p role="status">{message}</p> : null}
          <button className="sc-account-submit" disabled={pending !== null} type="submit">{pending === 'login' ? '正在登录…' : '确认登录'}</button>
        </form>
      </section>
    </div>, document.body) : null}
  </div>
}
