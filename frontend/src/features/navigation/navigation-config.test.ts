import { describe, expect, test } from 'vitest'
import { desktopNavigation, mobileNavigation } from './navigation-config'

describe('navigation configuration', () => {
  test('matches the reference site navigation labels', () => {
    expect(desktopNavigation.map((item) => item.label)).toEqual([
      '关键位分析',
      '盈利模式',
      '未来指标',
      '预测记录',
      '交易与盈亏',
      '统计图表',
      '当日复盘',
      'AI策略',
      '经验规则',
    ])
    expect(mobileNavigation.map((item) => item.label)).toEqual([
      '关键位',
      '模式',
      '指标',
      '记录',
      'K线',
      '交易',
      '统计',
      '复盘',
      '规则',
    ])
  })
})
