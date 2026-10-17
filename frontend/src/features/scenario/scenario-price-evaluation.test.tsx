import { render, screen, within } from '@testing-library/react'
import { expect, test } from 'vitest'
import { ScenarioPriceEvaluation } from './scenario-price-evaluation'
import { researchEvaluation } from './scenario-research-test-fixtures'
test('renders all five prices and separate per-level and four-target coverage', () => {
  const evaluation = researchEvaluation()
  render(<ScenarioPriceEvaluation view={{ latestStatus: evaluation, latestSuccessful: evaluation }} />)
  expect(screen.getByText('2 / 5')).toBeInTheDocument(); expect(screen.getByText('3 / 4')).toBeInTheDocument()
  const table = screen.getByRole('table', { name: '全部计算价与实际四价偏差' })
  expect(within(table).getAllByRole('row')).toHaveLength(6)
  expect(table).toHaveTextContent('27.69'); expect(table).toHaveTextContent('30.75')
  expect(screen.getByText(/最高.*32.91.*未覆盖/)).toBeInTheDocument()
  expect(screen.getByText(/事后对照/)).toBeInTheDocument(); expect(screen.getByText(/盘中支撑.*未评估/)).toBeInTheDocument()
})
test('source failure keeps the last successful result and empty precision is unavailable', () => {
  const success = researchEvaluation(); const failure = { ...success, id: 'failed', status: 'source_error' as const, result: null }
  const view = render(<ScenarioPriceEvaluation view={{ latestStatus: failure, latestSuccessful: success }} />)
  expect(screen.getByText(/采集失败/)).toBeInTheDocument(); expect(screen.getByText('2 / 5')).toBeInTheDocument()
  const empty = { ...success, result: { ...success.result!, levels: [], totalLevels: 0, closeLevels: 0, levelClosenessRatio: null, coveredTargets: 0 } }
  view.rerender(<ScenarioPriceEvaluation view={{ latestStatus: empty, latestSuccessful: empty }} />)
  expect(screen.getByText(/暂无计算价位.*接近比例未定义/)).toBeInTheDocument()
})
