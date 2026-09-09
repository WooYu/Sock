import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import type { DrawingObject } from './chart-types'
import { ObjectInspector } from './object-inspector'

const drawing: DrawingObject = {
  id: 'text-1',
  symbol: '600519',
  period: 'day',
  kind: 'text',
  points: [{ time: '2026-09-08', price: 10.25 }],
  style: { color: '#ef4444', width: 2, lineStyle: 'solid', opacity: 1 },
  text: '压力位',
  locked: false,
  visible: true,
  version: 1,
  updatedAt: '2026-09-07T00:00:00Z',
}

test('commits accessible style and text edits as typed inspector changes', async () => {
  const onChange = vi.fn()
  render(<ObjectInspector drawing={drawing} onChange={onChange} onDelete={() => {}} />)

  fireEvent.change(screen.getByLabelText('线条颜色'), { target: { value: '#2563eb' } })
  await userEvent.selectOptions(screen.getByLabelText('线型'), 'dashed')
  fireEvent.change(screen.getByLabelText('绘图文字'), { target: { value: '支撑位' } })

  expect(onChange).toHaveBeenCalledWith({ type: 'style', patch: { color: '#2563eb' } })
  expect(onChange).toHaveBeenCalledWith({ type: 'style', patch: { lineStyle: 'dashed' } })
  expect(onChange).toHaveBeenLastCalledWith({ type: 'text', text: '支撑位' })
})

test('commits numeric values only when the input is finite and valid', () => {
  const onChange = vi.fn()
  render(<ObjectInspector drawing={drawing} onChange={onChange} onDelete={() => {}} />)

  fireEvent.change(screen.getByLabelText('线条宽度'), { target: { value: '' } })
  fireEvent.change(screen.getByLabelText('不透明度'), { target: { value: 'not-a-number' } })
  expect(onChange).not.toHaveBeenCalled()

  fireEvent.change(screen.getByLabelText('线条宽度'), { target: { value: '3' } })
  fireEvent.change(screen.getByLabelText('不透明度'), { target: { value: '0.6' } })
  fireEvent.change(screen.getByLabelText('控制点 1 价格'), { target: { value: '12.5' } })
  expect(onChange).toHaveBeenNthCalledWith(1, { type: 'style', patch: { width: 3 } })
  expect(onChange).toHaveBeenNthCalledWith(2, { type: 'style', patch: { opacity: 0.6 } })
  expect(onChange).toHaveBeenNthCalledWith(3, { type: 'point', index: 0, point: { time: '2026-09-08', price: 12.5 } })
})

test('does not expose raw floating-point precision in price controls', () => {
  render(<ObjectInspector drawing={{ ...drawing, points: [{ ...drawing.points[0], price: 112.79834662188473 }] }} onChange={() => {}} onDelete={() => {}} />)

  expect(screen.getByLabelText('控制点 1 价格')).toHaveValue(112.8)
  expect(screen.queryByText('text-1')).not.toBeInTheDocument()
})

test('changes visibility and lock state through accessible switches', async () => {
  const onChange = vi.fn()
  render(<ObjectInspector drawing={drawing} onChange={onChange} onDelete={() => {}} />)

  await userEvent.click(screen.getByRole('switch', { name: '显示对象' }))
  await userEvent.click(screen.getByRole('switch', { name: '锁定对象' }))

  expect(onChange).toHaveBeenNthCalledWith(1, { type: 'visible', visible: false })
  expect(onChange).toHaveBeenNthCalledWith(2, { type: 'locked', locked: true })
})

test('prevents edits, visibility changes and deletion while locked but allows unlocking', async () => {
  const onChange = vi.fn()
  const onDelete = vi.fn()
  render(<ObjectInspector drawing={{ ...drawing, locked: true }} onChange={onChange} onDelete={onDelete} />)

  expect(screen.getByLabelText('线条颜色')).toBeDisabled()
  expect(screen.getByLabelText('线条宽度')).toBeDisabled()
  expect(screen.getByRole('switch', { name: '显示对象' })).toBeDisabled()
  expect(screen.getByRole('button', { name: '删除对象' })).toBeDisabled()
  await userEvent.click(screen.getByRole('switch', { name: '锁定对象' }))

  expect(onChange).toHaveBeenCalledOnce()
  expect(onChange).toHaveBeenCalledWith({ type: 'locked', locked: false })
  expect(onDelete).not.toHaveBeenCalled()
})

test('requests deletion through the parent handler', async () => {
  const onDelete = vi.fn()
  render(<ObjectInspector drawing={drawing} onChange={() => {}} onDelete={onDelete} />)

  await userEvent.click(screen.getByRole('button', { name: '删除对象' }))

  expect(onDelete).toHaveBeenCalledOnce()
})

test('renders an empty inspector until a drawing is selected', () => {
  render(<ObjectInspector drawing={null} onChange={() => {}} onDelete={() => {}} />)

  expect(screen.getByText('选择图中对象以编辑属性。')).toBeInTheDocument()
})
