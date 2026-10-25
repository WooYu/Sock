import { describe, expect, test } from 'vitest'
import { desktopNavigation, mobileNavigation } from './navigation-config'

describe('navigation configuration', () => {
  test('exposes the four frequent workspace destinations', () => {
    expect(desktopNavigation.map((item) => item.label)).toEqual([
      '趋势',
      '笔记',
      '分析',
      '交易',
    ])
    expect(mobileNavigation.map((item) => item.label)).toEqual([
      '趋势',
      '笔记',
      '分析',
      '交易',
    ])
  })
})
