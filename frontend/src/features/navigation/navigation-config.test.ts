import { describe, expect, test } from 'vitest'
import { desktopNavigation, mobileNavigation } from './navigation-config'

describe('navigation configuration', () => {
  test('exposes the approved five workspace destinations', () => {
    expect(desktopNavigation.map((item) => item.label)).toEqual([
      '首页',
      '分析',
      '规则',
      '复盘',
      '设置',
    ])
    expect(mobileNavigation.map((item) => item.label)).toEqual([
      '首页',
      '分析',
      '规则',
      '复盘',
      '设置',
    ])
  })
})
