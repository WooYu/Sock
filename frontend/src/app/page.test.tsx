import { render, screen } from '@testing-library/react'
import { test, expect } from 'vitest'
import Home from './page'

test('root page directs the user to the overview workspace', () => {
  render(<Home />)
  expect(screen.getByRole('link', { name: '进入总览' })).toHaveAttribute(
    'href',
    '/overview',
  )
})
