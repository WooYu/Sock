import { render, screen } from '@testing-library/react'
import { test, expect } from 'vitest'
import Home from './page'

test('root page renders the live-data workspace instead of a demo dashboard', () => {
  render(<Home />)
  expect(screen.getByRole('status')).toHaveTextContent('正在加载真实行情')
  expect(screen.queryByText('真实行情暂不可用')).not.toBeInTheDocument()
  expect(screen.queryByText('公司行为调整')).not.toBeInTheDocument()
})
