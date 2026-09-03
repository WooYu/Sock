import { afterEach, describe, expect, test, vi } from 'vitest'
import { browserMarketClient } from './browser-client'

describe('browserMarketClient.publishedRules', () => {
  afterEach(() => vi.unstubAllGlobals())

  test('excludes enabled server rules without a complete computable condition', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify([
      { id: 'empty', name: '空条件', enabled: true, action: 'ENTER', conditions: [] },
      { id: 'valid', name: '站上 MA5', enabled: true, action: 'ENTER', conditions: [{ field: 'closeAboveMa5', operator: 'equals', value: 1 }] },
    ]), { status: 200 })))

    const rules = await browserMarketClient.publishedRules?.()

    expect(rules?.map((rule) => rule.ruleId)).toEqual(['valid'])
  })
  test('excludes a rule when any one of its conditions is malformed', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify([
      { id: 'partial', name: '部分损坏', enabled: true, action: 'ENTER', conditions: [
        { field: 'closeAboveMa5', operator: 'equals', value: 1 },
        { field: 'not-supported', operator: 'equals', value: 1 },
      ] },
    ]), { status: 200 })))

    const rules = await browserMarketClient.publishedRules?.()

    expect(rules).toEqual([])
  })
})
