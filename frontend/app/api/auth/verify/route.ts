import { NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/api/backend-client'

export async function POST(request: Request) {
  const body = await request.json()
  if (typeof body.phone !== 'string' || typeof body.code !== 'string') return NextResponse.json({ message: '登录信息不完整' }, { status: 400 })
  try { return NextResponse.json(await verifyAuth(body.phone, body.code)) } catch { return NextResponse.json({ message: '验证码无效或登录失败' }, { status: 401 }) }
}
