import { useState } from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { ScenarioAnalysisPanel } from './scenario-analysis-panel'
import { seriesFixture } from './scenario-test-fixtures'
import type { ChartPeriod } from '../chart/chart-periods'
import type { AnalysisPeriod } from './scenario-types'
import type { Security } from '../workspace/stock-workspace-types'
import { SCENARIO_STORAGE_KEY } from './scenario-ledger'
import { NOTE_STUDY_SELECTION_KEY } from '../knowledge/note-study-selections'

function makeClient(fail30m = false, falling = false) {
  return { series: async (symbol: string, period: ChartPeriod) => {
    if (fail30m && period === '30m') throw new Error('30分钟暂缺')
    const closes = falling && period === 'day' ? Array.from({ length: 22 }, (_, i) => 20 - i / 4)
      : period === '30m' ? Array.from({ length: 22 }, (_, i) => 10.4 + i / 50) : [...Array<number>(21).fill(10), 11]
    return seriesFixture({ symbol, period: period as AnalysisPeriod, closes, fetchedAt: new Date().toISOString() })
  } }
}
function Harness({ client = makeClient(), sourceMode = 'real', symbol = '603533', security }: {
  client?: ReturnType<typeof makeClient>; sourceMode?: 'real' | 'demo'; symbol?: string; security?: Security
}) {
  const [period, setPeriod] = useState<ChartPeriod>('day')
  return <ScenarioAnalysisPanel symbol={symbol} sourceMode={sourceMode} activePeriod={period} onPeriodChange={setPeriod} client={client} security={security} />
}
async function confirm(dayDirection: 'rising' | 'falling' = 'rising', shock = false) {
  const user = userEvent.setup()
  await screen.findByText('笔记来源已加载', {}, { timeout: 5000 })
  if (!screen.queryByLabelText('趋势方向')) await user.click(screen.getByRole('button', { name: '核对形态与模式' }))
  await user.selectOptions(screen.getByLabelText('趋势方向'), dayDirection)
  await user.selectOptions(screen.getByLabelText('上涨形态'), dayDirection === 'rising' ? 'climbing' : 'unknown')
  await user.selectOptions(screen.getByLabelText('盈利模式'), dayDirection === 'rising' ? 'trend_climb' : 'down_rebound')
  await user.selectOptions(screen.getByLabelText('持仓状态'), 'held')
  await user.type(screen.getByLabelText('确认依据'), '根据当前完整K线人工核对')
  if (shock) await user.click(screen.getByLabelText('确认日线大阳线'))
  await user.click(screen.getByRole('button', { name: '保存本次人工确认' }))
  await screen.findByText('人工确认已记录')
}
beforeEach(() => localStorage.clear())
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); vi.unstubAllGlobals() })
test('cloud failure keeps local snapshot and retry sends identical prices without loading smaller periods', async () => {
  const client = { series: vi.fn(makeClient().series) }
  const fetcher = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(async () => Response.json({ message: '研究服务离线' }, { status: 503 }))
  vi.stubGlobal('fetch', fetcher)
  render(<Harness client={client} />)
  await screen.findByText('笔记来源已加载', {}, { timeout: 5000 })
  await userEvent.click(screen.getByRole('button', { name: '保存分析快照' }))
  await screen.findByText('已保存分析版本1')
  await screen.findByText('仅本地 · 失败可重试')
  expect(JSON.parse(localStorage.getItem(SCENARIO_STORAGE_KEY)!).records).toHaveLength(1)
  await userEvent.click(screen.getByRole('button', { name: '重试入库版本1' }))
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2))
  expect(JSON.parse(fetcher.mock.calls[1][1]?.body as string)).toEqual(JSON.parse(fetcher.mock.calls[0][1]?.body as string))
  expect(client.series.mock.calls.every(call => call[1] === 'day')).toBe(true)
})
test('selected study UUID and hash are frozen into formal save without changing price calculations', async () => {
  localStorage.setItem('stockcal:sync-client-id', 'device')
  const revisionId = '10000000-0000-4000-8000-000000000001', sourceHash = 'a'.repeat(64)
  localStorage.setItem(NOTE_STUDY_SELECTION_KEY, JSON.stringify({ schemaVersion: 1, scopes: { 'web:device': [{ revisionId, sourceHash, sourceFile: 'one.md', channel: 'ai_semantic', selectedAt: new Date().toISOString() }] } }))
  const fetcher = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(async () => Response.json({ message: 'offline' }, { status: 503 })); vi.stubGlobal('fetch', fetcher)
  render(<Harness />); await screen.findByText('笔记来源已加载', {}, { timeout: 5000 })
  await userEvent.click(screen.getByRole('button', { name: '保存分析快照' }))
  await screen.findByText('仅本地 · 失败可重试')
  const request = JSON.parse(fetcher.mock.calls[0][1]?.body as string)
  expect(request.noteBindings).toContainEqual({ revisionId, sourceHash, legacyKey: null, inlineVersion: null })
  expect(request.snapshot.dailyPriceLadder).toEqual(JSON.parse(localStorage.getItem(SCENARIO_STORAGE_KEY)!).records[0].dailyPriceLadder)
})
describe('scenario analysis workspace', () => {
  test('history_automatic_rule_label_does_not_change_with_current_security_status', async () => {
    const first = render(<Harness />)
    await screen.findByText('笔记来源已加载', {}, { timeout: 5000 })
    await waitFor(() => expect(screen.getByRole('button', { name: '保存分析快照' })).toBeEnabled())
    await userEvent.click(screen.getByRole('button', { name: '保存分析快照' }))
    await screen.findByText('已保存分析版本1')
    first.unmount(); render(<Harness security={{ code: '603533', name: '*ST测试' }} />)
    await userEvent.click(await screen.findByRole('button', { name: '查看分析版本1' }))
    expect(screen.getByLabelText('单日涨跌幅规则')).toHaveDisplayValue('自动识别 · 主板常规 ±10%')
    expect(screen.getByLabelText('单日涨跌幅规则')).toBeDisabled()
  })
  test('summarizes_all_three_periods_with_one_percent_mean_and_freezes_method_on_reload', async () => {
    const client = { series: async (symbol: string, period: ChartPeriod) => seriesFixture({ symbol, period: period as AnalysisPeriod,
      closes: Array<number>(22).fill(period === 'day' ? 10 : period === '60m' ? 10.01 : 10.08), fetchedAt: new Date().toISOString() }) }
    const rendered = render(<Harness client={client} />)
    const summary = await screen.findByRole('region', { name: '跨周期综合结果' })
    expect(summary).toHaveTextContent('本次采用：日线')
    await userEvent.click(screen.getByRole('button', { name: '看1小时' }))
    await screen.findByRole('table', { name: '1小时 MA/BOLL参考位' })
    await userEvent.click(screen.getByRole('button', { name: '继续看30分钟' }))
    await waitFor(() => expect(summary).toHaveTextContent('本次采用：日线 / 1小时 / 30分钟'))
    expect(summary).toHaveTextContent('10.03')
    expect(within(summary).getAllByRole('article', { name: /综合参考价组/ })).toHaveLength(1)
    await userEvent.selectOptions(screen.getByLabelText('计算方法'), 'last_delta')
    expect(summary).toHaveTextContent('最近一根增量对照')
    await screen.findByText('笔记来源已加载')
    await userEvent.click(screen.getByRole('button', { name: '保存分析快照' }))
    await screen.findByText('已保存分析版本1')
    const stored = JSON.parse(localStorage.getItem(SCENARIO_STORAGE_KEY)!).records[0]
    expect(stored.consolidation.method).toBe('last_delta')
    expect(stored.mergedLevels[0].value).toBeCloseTo(10.03, 10)
    rendered.unmount()
    render(<Harness client={client} />)
    await screen.findByRole('button', { name: '查看分析版本1' })
    await userEvent.click(screen.getByRole('button', { name: '查看分析版本1' }))
    const historySummary = screen.getByRole('region', { name: '跨周期综合结果' })
    expect(historySummary).toHaveTextContent('10.03')
    expect(historySummary).toHaveTextContent('最近一根增量对照')
    expect(within(historySummary).queryByRole('button', { name: '汇总三个周期' })).not.toBeInTheDocument()
  }, 15000)
  test('shows_only_actual_computed_prices_without_count_controls_or_padding_and_freezes_history', async () => {
    vi.setSystemTime(new Date('2026-09-22T16:00:00+08:00'))
    const client = { series: async (symbol: string, period: ChartPeriod) => seriesFixture({ symbol, period: period as AnalysisPeriod,
      dates: Array.from({ length: 22 }, (_, i) => period === 'day' ? '2026-09-' + String(i + 1).padStart(2, '0') : '2026-09-' + String([15, 16, 17, 18, 21, 22][Math.floor(i / 4)]).padStart(2, '0') + 'T' + ['10:30', '11:30', '14:00', '15:00'][i % 4] + ':00+08:00'),
      closes: Array<number>(22).fill(period === 'day' ? 10 : 10.4), fetchedAt: new Date().toISOString() }) }
    const rendered = render(<Harness client={client} />)
    const summary = await screen.findByRole('region', { name: '跨周期综合结果' })
    await userEvent.click(screen.getByRole('button', { name: '看1小时' }))
    await screen.findByRole('table', { name: '1小时 MA/BOLL参考位' })
    const above = () => within(summary).queryAllByRole('article', { name: /^上方参考价/ })
    const below = () => within(summary).queryAllByRole('article', { name: /^下方参考价/ })
    expect(above()).toHaveLength(1); expect(below()).toHaveLength(0)
    expect(summary).toHaveTextContent('基准收盘价 10.00')
    expect(summary).toHaveTextContent('9.00～11.00')
    expect(above()[0]).toHaveTextContent('10.40')
    expect(above()[0]).toHaveTextContent('+4.00%')
    expect(within(summary).queryByLabelText('每侧价位数')).not.toBeInTheDocument()
    expect(summary).not.toHaveTextContent('等分补位')
    expect(summary).toHaveTextContent('本侧暂无范围内的计算价位')
    await userEvent.selectOptions(within(summary).getByLabelText('单日涨跌幅规则'), '0.2')
    expect(above()).toHaveLength(1); expect(below()).toHaveLength(0)
    expect(summary).toHaveTextContent('8.00～12.00')
    await screen.findByText('笔记来源已加载')
    await userEvent.click(screen.getByRole('button', { name: '保存分析快照' }))
    await screen.findByText('已保存分析版本1')
    const stored = JSON.parse(localStorage.getItem(SCENARIO_STORAGE_KEY)!).records[0]
    expect(stored.dailyPriceLadder.selection).toMatchObject({ limit: { source: 'manual', ratio: 0.2 } })
    expect(stored.dailyPriceLadder.selection).not.toHaveProperty('count')
    rendered.unmount(); render(<Harness client={client} />)
    await userEvent.click(await screen.findByRole('button', { name: '查看分析版本1' }))
    const history = screen.getByRole('region', { name: '跨周期综合结果' })
    expect(within(history).queryByLabelText('每侧价位数')).not.toBeInTheDocument()
    expect(within(history).getByLabelText('单日涨跌幅规则')).toBeDisabled()
    expect(history).toHaveTextContent('8.00～12.00')
  }, 15000)
  test('clear_daily_stops_automatic_loading_and_allows_only_one_hour_check_while_retaining_daily_risk', async () => {
    const client = { series: vi.fn(makeClient().series) }
    render(<Harness client={client} />)
    await screen.findByRole('region', { name: '跨周期综合结果' })
    expect(client.series.mock.calls.map(call => call[1])).toEqual(['day'])
    await confirm()
    expect(client.series.mock.calls.every(call => call[1] === 'day')).toBe(true)
    expect(screen.getByRole('region', { name: '周期判断与停止' })).toHaveTextContent('日线规律已确认')
    expect(screen.getByRole('button', { name: '继续看30分钟' })).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: '看1小时' }))
    await screen.findByRole('table', { name: '1小时 MA/BOLL参考位' })
    await confirm()
    expect(screen.getByRole('button', { name: '继续看30分钟' })).toBeDisabled()
    expect(client.series.mock.calls.some(call => call[1] === '30m')).toBe(false)
    const risk = screen.getByRole('region', { name: '交易原则与风险参考' })
    expect(risk).toHaveTextContent('日线 MA5')
    expect(risk).toHaveTextContent('1小时 MA5')
    expect(risk).not.toHaveTextContent('30分钟 MA5')
    await userEvent.click(screen.getByRole('button', { name: '保存分析快照' }))
    await screen.findByText('已保存分析版本1')
    const saved = JSON.parse(localStorage.getItem(SCENARIO_STORAGE_KEY)!).records[0]
    expect(saved.annotations.periodSelections.day.bottom.period).toBe('day')
    expect(Object.keys(saved.input.periods)).toEqual(['day', '60m'])
  }, 15000)
  test('unfinished_candle_hypotheses_are_visible_separately_from_formal_parameters', async () => {
    vi.setSystemTime(new Date('2026-10-12T14:15:00+08:00'))
    const dates = Array.from({ length: 20 }, (_, i) => new Date(Date.UTC(2026, 8, 23 + i)).toISOString().slice(0, 10))
    const client = { series: async (symbol: string, period: ChartPeriod) => seriesFixture({ symbol, period: period as AnalysisPeriod,
      ...(period === 'day' ? { dates } : {}), closes: [...Array<number>(19).fill(10), 11], fetchedAt: new Date().toISOString() }) }
    render(<Harness client={client} />)
    const provisional = await screen.findByRole('region', { name: '日线盘中暂估' })
    expect(provisional).toHaveTextContent('尚未收盘')
    expect(provisional).toHaveTextContent('10.20')
    expect(provisional).toHaveTextContent('假设本柱最终收于当前观察价')
    expect(screen.getByRole('region', { name: '日线状态' })).toHaveTextContent('10.00')
  })
  test('confirming_a_larger_period_after_exploration_removes_deeper_prices_from_new_snapshots', async () => {
    const client = { series: vi.fn(makeClient().series) }
    render(<Harness client={client} />)
    await screen.findByRole('region', { name: '跨周期综合结果' })
    await userEvent.click(screen.getByRole('button', { name: '看1小时' }))
    await screen.findByRole('table', { name: '1小时 MA/BOLL参考位' })
    await userEvent.click(screen.getByRole('button', { name: '继续看30分钟' }))
    await screen.findByRole('table', { name: '30分钟 MA/BOLL参考位' })
    await userEvent.click(screen.getByRole('button', { name: '日线分析' }))
    await confirm()
    expect(screen.queryByRole('region', { name: '30分钟状态' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '保存分析快照' }))
    await screen.findByText('已保存分析版本1')
    const saved = JSON.parse(localStorage.getItem(SCENARIO_STORAGE_KEY)!).records[0]
    expect(Object.keys(saved.input.periods)).toEqual(['day', '60m'])
    expect(saved.references.every((ref: { period: string }) => ref.period !== '30m')).toBe(true)
    client.series.mockClear()
    await userEvent.click(screen.getByRole('button', { name: '刷新分析行情' }))
    await waitFor(() => expect(client.series).toHaveBeenCalledTimes(2))
    expect(client.series.mock.calls.map(call => call[1])).toEqual(['day', '60m'])
  }, 15000)
  test('saved_creation_time_is_the_actual_save_time', async () => {
    render(<Harness client={makeClient()} />)
    await confirm()
    vi.setSystemTime(new Date('2027-01-03T17:00:00Z'))
    await userEvent.click(screen.getByRole('button', { name: '保存分析快照' }))
    await screen.findByText('已保存分析版本1')
    const raw = JSON.parse(localStorage.getItem(SCENARIO_STORAGE_KEY)!)
    expect(raw.records[0].createdAt).toBe('2027-01-03T17:00:00.000Z')
  })
  test('confirmed_large_bull_uses_rolling_method_without_forcing_small_periods', async () => {
    const client = { series: vi.fn(makeClient().series) }
    render(<Harness client={client} />)
    await confirm('rising', true)
    expect(screen.getByLabelText('计算方法')).toHaveValue('rolling_close')
    expect(client.series.mock.calls.every(call => call[1] === 'day')).toBe(true)
    await userEvent.click(screen.getByRole('button', { name: '看1小时' }))
    await screen.findByRole('table', { name: '1小时 MA/BOLL参考位' })
    expect(screen.getByRole('button', { name: '继续看30分钟' })).toBeDisabled()
    expect(screen.getByRole('region', { name: '日线状态' })).toHaveTextContent('上涨')
    expect(screen.queryByRole('region', { name: '30分钟状态' })).not.toBeInTheDocument()
  })
  test('30m_failure_keeps_upper_analysis_and_retry', async () => {
    render(<Harness client={makeClient(true)} />)
    await screen.findByText('笔记来源已加载', {}, { timeout: 10_000 })
    await userEvent.click(screen.getByRole('button', { name: '看1小时' }))
    await screen.findByRole('table', { name: '1小时 MA/BOLL参考位' })
    await userEvent.click(screen.getByRole('button', { name: '继续看30分钟' }))
    await screen.findByText(/30分钟暂缺/)
    expect(screen.getByRole('region', { name: '日线状态' })).toHaveTextContent('日线 MA5')
    expect(screen.getByRole('button', { name: '重试30分钟' })).toBeVisible()
  })
  test('daily_downtrend_and_30m_rebound_are_kept_separate', async () => {
    render(<Harness client={makeClient(false, true)} />)
    await confirm('falling')
    await userEvent.click(screen.getByRole('button', { name: '看1小时' }))
    await waitFor(() => expect(screen.getByRole('region', { name: '1小时状态' })).toHaveTextContent('上涨候选'))
    expect(screen.getByRole('region', { name: '日线状态' })).toHaveTextContent('下跌')
  })
  test('daily_stop_keeps_its_period_after_optional_hour_check', async () => {
    render(<Harness client={makeClient()} />)
    await confirm()
    await userEvent.click(screen.getByRole('button', { name: '看1小时' }))
    const risk = screen.getByRole('region', { name: '交易原则与风险参考' })
    await waitFor(() => expect(risk).toHaveTextContent('日线 MA5'))
    expect(risk).toHaveTextContent('10.20')
  })
  test('saves_sources_and_scenario_paths_and_reloads_readonly_history', async () => {
    const client = makeClient()
    const first = render(<Harness client={client} />)
    await confirm()
    await userEvent.click(screen.getByRole('button', { name: '保存分析快照' }))
    await screen.findByText('已保存分析版本1')
    const raw = JSON.parse(localStorage.getItem(SCENARIO_STORAGE_KEY)!)
    expect(raw.records[0].scenarios.length).toBeGreaterThan(0)
    expect(raw.records[0].rules.some((r: { evidence: unknown[] }) => r.evidence.length)).toBe(true)
    first.unmount()
    render(<Harness client={client} />)
    await screen.findByRole('button', { name: '查看分析版本1' })
    await userEvent.click(screen.getByRole('button', { name: '查看分析版本1' }))
    expect(screen.getByText(/历史快照，只读/)).toBeVisible()
    expect(screen.queryByRole('button', { name: '保存分析快照' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '返回当前分析' })).toBeVisible()
    expect(screen.getAllByRole('link', { name: /查看笔记原文/ }).some(link => link.getAttribute('href')?.includes('/blob/'))).toBe(true)
  })
  test('verified_calendar_is_available_and_demo_cannot_save_real_records', async () => {
    render(<Harness client={makeClient()} sourceMode="demo" symbol="DEMO" />)
    await screen.findByText('笔记来源已加载')
    expect(screen.queryByText('交易日历未核实，目标日期待核实')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '保存分析快照' })).toBeDisabled()
    expect(screen.getByText('合成示例分析')).toBeVisible()
  })
  test('unfinished_daily_bar_cannot_be_formally_confirmed', async () => {
    vi.setSystemTime(new Date('2026-10-12T14:15:00+08:00'))
    const client = { series: async (symbol: string, period: ChartPeriod) => seriesFixture({
      symbol, period: period as AnalysisPeriod, fetchedAt: new Date().toISOString(),
      ...(period === 'day' ? { dates: ['2026-10-12'], closes: [11] } : { closes: Array<number>(22).fill(10) }),
    }) }
    render(<Harness client={client} />)
    await screen.findByText('笔记来源已加载', {}, { timeout: 10_000 })
    await waitFor(() => expect(within(screen.getByRole('region', { name: '日线状态' })).getByText(/未完成1根/)).toBeVisible())
    expect(screen.getByRole('button', { name: '核对形态与模式' })).toBeDisabled()
  })
})
