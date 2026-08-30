import { describe, expect, test, vi } from 'vitest'
import { POST } from './route'

const explainStrategy = vi.fn(async (payload: unknown, authorization?: string) => ({
  decision: (payload as { decision: string }).decision,
  summary: authorization ? '解释成功' : '未登录',
  evidenceIds: [],
  risks: [],
  unknowns: [],
}))

vi.mock('@/lib/api/backend-client', () => ({ explainStrategy }))

describe('strategy explanation BFF', () => {
  test('forwards deterministic payload and authorization', async () => {
    const response = await POST(new Request('http://localhost/api/analysis/strategy-explanation', {
      method: 'POST',
      headers: { authorization: 'Bearer token', 'content-type': 'application/json' },
      body: JSON.stringify({ decision: 'WAIT', reason: '冲突' }),
    }))

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ decision: 'WAIT', summary: '解释成功' })
    expect(explainStrategy).toHaveBeenCalledWith({ decision: 'WAIT', reason: '冲突' }, 'Bearer token')
  })
})
