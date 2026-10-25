import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { LearningSamplesView } from './learning-samples-view'
import { StrictMode } from 'react'
import { researchEvaluation, researchRecord } from '../scenario/scenario-research-test-fixtures'
const sample = { forecast: researchRecord(), evaluation: { latestStatus: researchEvaluation(), latestSuccessful: researchEvaluation() } }
const page = { items: [sample], nextCursor: 'cursor-two', asOf: '2026-10-16T08:00:00Z' }
beforeEach(() => { localStorage.clear(); window.history.replaceState(null, '', '/knowledge?view=samples') })
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); window.history.replaceState(null, '', '/') })
test('filters candidate/confirmed trend independently, resets cursor and displays frozen details', async () => {
  const urls: string[] = []
  vi.stubGlobal('fetch', vi.fn(async (url: string) => { urls.push(url); return Response.json(page) }))
  render(<LearningSamplesView />)
  await screen.findByRole('button', { name: '查看冻结样本' })
  await userEvent.click(screen.getByText('高级筛选 · 版本、趋势与笔记来源'))
  await userEvent.selectOptions(screen.getByLabelText('候选趋势'), 'rising')
  await userEvent.selectOptions(screen.getByLabelText('人工确认趋势'), 'unknown')
  await waitFor(() => expect(urls.at(-1)).toContain('directionConfirmed=unknown'))
  expect(urls.at(-1)).toContain('directionCandidate=rising')
  await userEvent.click(screen.getByRole('button', { name: '下一批样本' }))
  await waitFor(() => expect(urls.at(-1)).toContain('cursor=cursor-two'))
  await userEvent.selectOptions(screen.getByLabelText('计算方法筛选'), 'last_delta')
  await waitFor(() => expect(urls.at(-1)).toContain('method=last_delta'))
  expect(urls.at(-1)).not.toContain('cursor=')
  await userEvent.click(await screen.findByRole('button', { name: '查看冻结样本' }))
  expect(screen.getByRole('region', { name: '学习样本详情' })).toHaveTextContent('葛阶段：未知')
  expect(screen.getByRole('region', { name: '学习样本详情' })).toHaveTextContent('仅日线')
  expect(screen.getByText('2 / 5')).toBeInTheDocument()
})
test('ignores late responses from the previous filter', async () => {
  let resolve!: (response: Response) => void, calls = 0
  const fresh = { ...sample, forecast: { ...sample.forecast, anchorDay: '2026-10-02' } }
  vi.stubGlobal('fetch', vi.fn(async () => { calls++; if (calls === 1) return new Promise<Response>(done => { resolve = done }); return Response.json({ ...page, items: [fresh] }) }))
  render(<LearningSamplesView />)
  await waitFor(() => expect(calls).toBe(1))
  await userEvent.click(screen.getByText('高级筛选 · 版本、趋势与笔记来源'))
  await userEvent.selectOptions(screen.getByLabelText('候选趋势'), 'falling')
  await screen.findByText('2026-10-02')
  await act(async () => { resolve(Response.json({ ...page, items: [{ ...sample, forecast: { ...sample.forecast, anchorDay: '2026-10-01' } }] })); await Promise.resolve() })
  expect(screen.queryByText('2026-10-01')).not.toBeInTheDocument()
})
test('restores URL filters on popstate and distinguishes unavailable service from empty results', async () => {
  let ready = false
  vi.stubGlobal('fetch', vi.fn(async () => ready ? Response.json({ ...page, items: [], nextCursor: null }) : Response.json({ message: '样本服务离线' }, { status: 503 })))
  render(<LearningSamplesView />); await screen.findByText('样本服务离线')
  expect(screen.queryByText('没有符合条件的样本')).not.toBeInTheDocument()
  ready = true
  act(() => { window.history.pushState(null, '', '/knowledge?view=samples&directionCandidate=falling&directionConfirmed=unknown&forwardEligible=false'); window.dispatchEvent(new PopStateEvent('popstate')) })
  await screen.findByText('没有符合条件的样本')
  expect(screen.getByLabelText('候选趋势')).toHaveValue('falling'); expect(screen.getByLabelText('人工确认趋势')).toHaveValue('unknown')
  expect(screen.getByLabelText('前瞻资格筛选')).toHaveValue('false')
})
test('exports the selected frozen sample in React strict mode', async () => {
  const create = vi.fn<(blob: Blob | MediaSource) => string>(() => 'blob:test')
  vi.stubGlobal('URL', class extends URL { static createObjectURL = create; static revokeObjectURL() {} })
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  vi.stubGlobal('fetch', vi.fn(async (url: string) => Response.json(url.includes('/evaluations') ? [researchEvaluation()] : page)))
  render(<StrictMode><LearningSamplesView /></StrictMode>)
  await userEvent.click(await screen.findByRole('button', { name: '查看冻结样本' }))
  await userEvent.click(screen.getByRole('button', { name: '导出冻结样本' }))
  await waitFor(() => expect(create).toHaveBeenCalledTimes(1))
  expect(click).toHaveBeenCalledTimes(1); click.mockRestore()
})

test('clears filters and returns focus after dismissing a frozen sample', async () => {
  const urls: string[] = []
  window.history.replaceState(null, '', '/knowledge?view=samples&symbol=300502&status=scored&directionCandidate=rising')
  vi.stubGlobal('fetch', vi.fn(async (url: string) => { urls.push(url); return Response.json(page) }))
  render(<LearningSamplesView />)
  const trigger = await screen.findByRole('button', { name: '查看冻结样本' })
  await userEvent.click(trigger)
  expect(screen.getByRole('region', { name: '学习样本详情' })).toHaveFocus()
  await userEvent.keyboard('{Escape}')
  expect(screen.queryByRole('region', { name: '学习样本详情' })).not.toBeInTheDocument()
  expect(trigger).toHaveFocus()
  await userEvent.click(screen.getByRole('button', { name: '清空筛选' }))
  await waitFor(() => expect(urls.at(-1)).not.toContain('directionCandidate='))
  expect(screen.getByLabelText('股票代码')).toHaveValue('')
  expect(urls.at(-1)).not.toContain('status=')
  expect(window.location.search).not.toContain('directionCandidate=')
})
