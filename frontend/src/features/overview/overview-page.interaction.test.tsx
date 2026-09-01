import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { OverviewPage } from './overview-page'

describe('OverviewPage interactions', () => {
  test('links to the live chart and rules workspaces', () => {
    render(<OverviewPage snapshot={null} />)
    expect(screen.getByRole('link', { name: '进入 K 线工作区 →' })).toHaveAttribute('href', '/chart')
  })
})
