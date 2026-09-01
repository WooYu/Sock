import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { OverviewPage } from './overview-page'

describe('OverviewPage', () => {
  test('exposes the live overview without demo identity', () => {
    render(<OverviewPage snapshot={null} status="error" errorMessage="行情服务不可用" />)
    expect(screen.getByRole('heading', { name: '真实行情暂不可用' })).toBeInTheDocument()
    expect(screen.queryByText('华芯动力')).not.toBeInTheDocument()
  })
})
