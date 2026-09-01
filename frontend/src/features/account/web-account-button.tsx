'use client'

import { useState, useSyncExternalStore } from 'react'
import { requestAuthCode, verifyAuth } from '@/lib/api/backend-client'

type AuthFn = (phone: string) => Promise<unknown>
type VerifyFn = (phone: string, code: string) => Promise<{ accessToken: string; refreshToken: string; expiresAt: string }>

export function WebAccountButton({ requestCode = requestAuthCode, verify = verifyAuth }: { requestCode?: AuthFn; verify?: VerifyFn }) {
  const [, refresh] = useState(0)
  const [open, setOpen] = useState(false)
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [message, setMessage] = useState('')

  const signedIn = useSyncExternalStore(() => () => undefined, () => Boolean(window.localStorage.getItem('stockcal.accessToken')), () => false)
  if (signedIn) return <button className="sc-account-sync" onClick={() => { window.localStorage.removeItem('stockcal.accessToken'); refresh((value) => value + 1) }} type="button">已登录 · 跨设备同步</button>
  return <div className="sc-account-wrap"><button className="sc-account-sync" onClick={() => setOpen((value) => !value)} type="button">登录同步</button>{open ? <div className="sc-account-popover"><label>手机号<input aria-label="手机号" inputMode="tel" onChange={(event) => setPhone(event.target.value)} value={phone} /></label><button onClick={() => void requestCode(phone).then(() => setMessage('验证码已发送')).catch(() => setMessage('验证码发送失败'))} type="button">获取验证码</button><label>验证码<input aria-label="验证码" inputMode="numeric" onChange={(event) => setCode(event.target.value)} value={code} /></label><button onClick={() => void verify(phone, code).then((session) => { window.localStorage.setItem('stockcal.accessToken', session.accessToken); window.localStorage.setItem('stockcal.refreshToken', session.refreshToken); refresh((value) => value + 1); setOpen(false) }).catch(() => setMessage('登录失败'))} type="button">确认登录</button>{message ? <small role="status">{message}</small> : null}</div> : null}</div>
}
