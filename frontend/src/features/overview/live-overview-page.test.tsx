import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { LiveOverviewPage } from './live-overview-page'

const snapshot = {
  quote: { security: { code: '600519', name: '贵州茅台' }, price: 1450.12, previousClose: 1440 },
  dailyCandles: [{ day: '2026-08-31', open: 1440, high: 1460, low: 1435, close: 1450.12, volume: 1000 }],
  source: { name: 'Tushare Pro', fetchedAt: '2026-09-01T09:00:00Z', state: 'LIVE', online: true },
}

describe('LiveOverviewPage', () => {
  test('renders live security and source', () => {
    render(<LiveOverviewPage snapshot={snapshot} />)
    expect(screen.getByText('贵州茅台')).toBeInTheDocument()
    expect(screen.getByText('600519')).toBeInTheDocument()
    expect(screen.getByText(/Tushare Pro/)).toBeInTheDocument()
  })

  test('renders unavailable state without demo identity', () => {
    render(<LiveOverviewPage snapshot={null} status="error" errorMessage="后端不可达" />)
    expect(screen.getByText(/真实行情暂不可用/)).toBeInTheDocument()
    expect(screen.queryByText('华芯动力')).not.toBeInTheDocument()
    expect(screen.queryByText('DEMO·001')).not.toBeInTheDocument()
  })
})
