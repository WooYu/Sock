import type { AnalysisTab, PrimarySection, ReviewTab, TradingTab } from './navigation-config'

export class NavigationController {
  primary: PrimarySection = 'overview'
  analysisTab: AnalysisTab = 'key-levels'
  tradingTab: TradingTab = 'positions'
  reviewTab: ReviewTab = 'daily'

  selectPrimary(value: PrimarySection) {
    this.primary = value
  }

  selectAnalysisTab(value: AnalysisTab) {
    this.analysisTab = value
  }

  selectTradingTab(value: TradingTab) {
    this.tradingTab = value
  }

  selectReviewTab(value: ReviewTab) {
    this.reviewTab = value
  }
}
