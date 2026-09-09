import { useState } from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import type { PredictionSnapshot } from './chart-types'
import { PredictionDetails } from './prediction-details'

const prediction: PredictionSnapshot = {
  symbol: '600519',
  period: 'day',
  generatedAt: '2026-09-07T00:00:00Z',
  modelVersion: 'baseline-v1',
  days: [
    { day: '2026-09-08', open: 10.11, high: 11.12, low: 9.13, close: 10.14, rangeLow: 9.15, rangeHigh: 11.16, confidence: 0.81, ma5: 10.17, ma10: 10.18, ma20: 10.19, bollUpper: 11.21, bollMiddle: 10.22, bollLower: 9.23 },
    { day: '2026-09-09', open: 20.11, high: 21.12, low: 19.13, close: 20.14, rangeLow: 19.15, rangeHigh: 21.16, confidence: 0.72, ma5: 20.17, ma10: 20.18, ma20: 20.19, bollUpper: 21.21, bollMiddle: 20.22, bollLower: 19.23 },
    { day: '2026-09-10', open: 30.11, high: 31.12, low: 29.13, close: 30.14, rangeLow: 29.15, rangeHigh: 31.16, confidence: 0.63, ma5: 30.17, ma10: 30.18, ma20: 30.19, bollUpper: 31.21, bollMiddle: 30.22, bollLower: 29.23 },
  ],
}

test('renders every required prediction value in the desktop table', () => {
  render(<PredictionDetails mode="desktop-table" onSelectDay={() => {}} prediction={prediction} selectedDay={prediction.days[0].day} />)

  const table = screen.getByRole('table', { name: '未来三日推演详情' })
  const expectedRows = [
    ['预测开盘', '10.11', '20.11', '30.11'],
    ['预测最高', '11.12', '21.12', '31.12'],
    ['预测最低', '9.13', '19.13', '29.13'],
    ['预测收盘', '10.14', '20.14', '30.14'],
    ['预测区间', '9.15–11.16', '19.15–21.16', '29.15–31.16'],
    ['MA5', '10.17', '20.17', '30.17'],
    ['MA10', '10.18', '20.18', '30.18'],
    ['MA20', '10.19', '20.19', '30.19'],
    ['BOLL上轨', '11.21', '21.21', '31.21'],
    ['BOLL中轨', '10.22', '20.22', '30.22'],
    ['BOLL下轨', '9.23', '19.23', '29.23'],
    ['置信度', '81%', '72%', '63%'],
  ]

  for (const [label, ...values] of expectedRows) {
    const row = within(table).getByRole('row', { name: new RegExp(`^${label}`) })
    for (const value of values) expect(row).toHaveTextContent(value)
  }
})

test('selects the second predicted day from the desktop detail view', async () => {
  const onSelectDay = vi.fn()
  render(<PredictionDetails mode="desktop-table" onSelectDay={onSelectDay} prediction={prediction} selectedDay={null} />)

  await userEvent.click(screen.getByRole('button', { name: /第2日/ }))

  expect(onSelectDay).toHaveBeenCalledWith('2026-09-09')
})

test('collapses and restores the desktop prediction table', async () => {
  render(<PredictionDetails mode="desktop-table" onSelectDay={() => {}} prediction={prediction} selectedDay={null} />)

  const toggle = screen.getByRole('button', { name: '收起预测详情' })
  await userEvent.click(toggle)

  expect(toggle).toHaveAttribute('aria-expanded', 'false')
  expect(screen.queryByRole('table', { name: '未来三日推演详情' })).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: '展开预测详情' }))
  expect(screen.getByRole('table', { name: '未来三日推演详情' })).toBeInTheDocument()
})

test('uses controlled date tabs and one selected-day value list in the mobile sheet', async () => {
  const onSelectDay = vi.fn()
  render(<PredictionDetails mode="mobile-sheet" onSelectDay={onSelectDay} prediction={prediction} selectedDay="2026-09-09" />)

  expect(screen.getAllByRole('tab')).toHaveLength(3)
  expect(screen.getByRole('tab', { name: /第2日/ })).toHaveAttribute('aria-selected', 'true')
  const panel = screen.getByRole('tabpanel', { name: /第2日/ })
  expect(within(panel).getByText('预测开盘')).toBeInTheDocument()
  expect(within(panel).getByText('20.11')).toBeInTheDocument()
  expect(within(panel).queryByText('10.11')).not.toBeInTheDocument()

  await userEvent.click(screen.getByRole('tab', { name: /第3日/ }))
  expect(onSelectDay).toHaveBeenCalledWith('2026-09-10')
})

test('uses one shared tab panel and moves selection with roving keyboard focus', async () => {
  function ControlledDetails() {
    const [selectedDay, setSelectedDay] = useState(prediction.days[1].day)
    return <PredictionDetails mode="mobile-sheet" onSelectDay={setSelectedDay} prediction={prediction} selectedDay={selectedDay} />
  }
  render(<ControlledDetails />)

  const tabs = screen.getAllByRole('tab')
  const panel = screen.getByRole('tabpanel')
  for (const tab of tabs) expect(tab).toHaveAttribute('aria-controls', panel.id)
  expect(tabs[0]).toHaveAttribute('tabindex', '-1')
  expect(tabs[1]).toHaveAttribute('tabindex', '0')
  expect(tabs[2]).toHaveAttribute('tabindex', '-1')

  tabs[1].focus()
  await userEvent.keyboard('{ArrowRight}')
  expect(tabs[2]).toHaveFocus()
  expect(tabs[2]).toHaveAttribute('aria-selected', 'true')
  await userEvent.keyboard('{Home}')
  expect(tabs[0]).toHaveFocus()
  expect(tabs[0]).toHaveAttribute('aria-selected', 'true')
  await userEvent.keyboard('{End}')
  expect(tabs[2]).toHaveFocus()
  expect(tabs[2]).toHaveAttribute('aria-selected', 'true')
  await userEvent.keyboard('{ArrowRight}')
  expect(tabs[0]).toHaveFocus()
})

test('identifies forecast values as simulated rather than market data', () => {
  render(<PredictionDetails mode="mobile-sheet" onSelectDay={() => {}} prediction={prediction} selectedDay={null} />)

  expect(screen.getByText('推演数据，不是实际行情')).toBeInTheDocument()
})

test('exposes the prediction generation time and model version', () => {
  render(<PredictionDetails mode="desktop-table" onSelectDay={() => {}} prediction={prediction} selectedDay={null} />)

  expect(screen.getByText('baseline-v1')).toBeInTheDocument()
  expect(screen.getByText('2026-09-07T00:00:00Z')).toHaveAttribute('datetime', '2026-09-07T00:00:00Z')
})
