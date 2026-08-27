import { describe, expect, test } from 'vitest'
import { desktopNavigation, mobileNavigation } from './navigation-config'

describe('navigation configuration', () => {
  test('exposes six desktop and five mobile entries', () => {
    expect(desktopNavigation.map((item) => item.label)).toEqual([
      '总览',
      '个股分析',
      '专业 K 线',
      '交易',
      '复盘',
      '规则库',
    ])
    expect(mobileNavigation.map((item) => item.label)).toEqual([
      '总览',
      '分析',
      'K线',
      '交易',
      '复盘',
    ])
  })
})
