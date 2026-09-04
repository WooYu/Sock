import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { TradingPage } from './trading-page'
import { ReviewPage } from '../review/review-page'
import { RulesPage } from '../rules/rules-page'

describe('交易、复盘与规则库', () => {
  it('交易页切换页签并保留当前股票上下文', () => {
    render(<TradingPage symbol="600519" initialTab="positions" />)
    expect(screen.getByRole('heading', { name: '持仓与交易' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: '预测记录' }))
    expect(screen.getByRole('heading', { name: '预测记录' })).toBeInTheDocument()
    expect(screen.getByText('当前股票：600519')).toBeInTheDocument()
  })

  it('复盘页支持在当日总结和规则回测之间切换', () => {
    render(<ReviewPage initialTab="daily" />)
    fireEvent.click(screen.getByRole('tab', { name: '规则回测' }))
    expect(screen.getByRole('heading', { name: '规则回测' })).toBeInTheDocument()
  })

  it('通过内部链接进入交易预测记录时直接显示对应页签', () => {
    render(<TradingPage initialTab="predictions" />)
    expect(screen.getByRole('heading', { name: '预测记录' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: '预测记录' })).toHaveAttribute('aria-selected', 'true')
  })

  it('规则库只有发布后的规则进入分析', () => {
    render(<RulesPage initialRules={[{ id: 'r1', title: '突破回踩', status: 'draft', conditions: [{ field: 'closeAboveMa5', operator: 'equals', value: 1 }] }]} />)
    expect(screen.getByText('草稿')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '发布突破回踩' }))
    expect(screen.getByText('已发布')).toBeInTheDocument()
    expect(screen.getByText('参与分析')).toBeInTheDocument()
  })
})
