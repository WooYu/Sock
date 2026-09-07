import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { ProductShell } from './product-shell'

describe('ProductShell', () => {
  test('keeps legacy tone inputs on the unified shell', () => {
    render(<ProductShell section="analysis" tone="cyber"><p>分析内容</p></ProductShell>)

    expect(screen.getByTestId('app-shell')).toHaveClass('sc-shell-unified')
    expect(screen.getByTestId('app-shell')).not.toHaveClass('sc-tone-cyber')
  })
})
