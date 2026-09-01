import { NextResponse } from 'next/server'
import { getPublishedKnowledgeRules } from '@/lib/api/backend-client'

export async function GET(request: Request) {
  try { return NextResponse.json(await getPublishedKnowledgeRules(request.headers.get('authorization') ?? undefined)) } catch { return NextResponse.json({ message: '规则库暂时不可用' }, { status: 502 }) }
}
