import { NextResponse } from 'next/server'
import { requestAuthCode } from '@/lib/api/backend-client'

export async function POST(request: Request) {
  const { phone } = await request.json()
  if (typeof phone !== 'string' || !/^1\d{10}$/.test(phone)) return NextResponse.json({ message: '手机号格式不正确' }, { status: 400 })
  try { await requestAuthCode(phone); return new NextResponse(null, { status: 204 }) } catch { return NextResponse.json({ message: '验证码发送失败' }, { status: 502 }) }
}
