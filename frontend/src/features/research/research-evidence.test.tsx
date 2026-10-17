import { useState } from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'
import { ResearchEvidence } from './research-evidence'
import { createPreviewData } from './preview-data'

function ScenarioDraft() {
  const [value, setValue] = useState('')
  return <label>确认依据<input value={value} onChange={(event) => setValue(event.target.value)} /></label>
}

test('keeps entry labels and analysis draft unchanged across tab switches', async () => {
  const user = userEvent.setup()
  render(<ResearchEvidence candles={createPreviewData().market.dailyCandles} scenario={<ScenarioDraft />} />)
  const tabs = screen.getByRole('tablist', { name: '研究依据类型' })
  const labels = () => within(tabs).getAllByRole('tab').map((tab) => tab.textContent)
  const initial = labels()
  expect(initial).toEqual(['走势依据', '笔记规则', '历史相似', '多周期分析'])
  await user.click(screen.getByRole('tab', { name: '多周期分析' }))
  await user.type(screen.getByLabelText('确认依据'), '保留当前分析')
  await user.click(screen.getByRole('tab', { name: '历史相似' }))
  expect(screen.getAllByRole('tabpanel')).toHaveLength(1)
  await user.click(screen.getByRole('tab', { name: '多周期分析' }))
  expect(screen.getByLabelText('确认依据')).toHaveValue('保留当前分析')
  expect(labels()).toEqual(initial)
  await user.keyboard('{Home}')
  expect(screen.getByRole('tab', { name: '走势依据' })).toHaveFocus()
  expect(screen.getByRole('tab', { name: '走势依据' })).toHaveAttribute('aria-selected', 'true')
})
