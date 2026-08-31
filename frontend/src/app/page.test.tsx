import { render, screen } from '@testing-library/react'
import { test, expect } from 'vitest'
import Home from './page'

test('root page renders the overview workspace instead of a placeholder', () => {
  render(<Home />)
  expect(screen.getByRole('heading', { name: '组合总览' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'AI策略分析中心' })).toBeInTheDocument()
})
