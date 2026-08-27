import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test } from 'vitest'
import { KeyLevelsPanel } from './key-levels-panel'

const analysis = {
  support: 1700,
  resistance: 1760,
  target: 1810,
  direction: 'bullish' as const,
  confidence: 0.82,
  directionStrength: 0.7,
  matchedRules: [],
  future: [],
}

describe('analysis panels', () => {
  test('key level evidence supports multiple expanded cards', async () => {
    render(<KeyLevelsPanel analysis={analysis} />)
    await userEvent.click(screen.getByRole('button', { name: '展开上涨关键区' }))
    await userEvent.click(screen.getByRole('button', { name: '展开下跌支撑区' }))
    expect(screen.getAllByText('计算依据')).toHaveLength(2)
    expect(screen.getAllByText(/触发条件/)).toHaveLength(2)
  })
})
