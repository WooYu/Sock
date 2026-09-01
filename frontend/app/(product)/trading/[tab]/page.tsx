import { ProductShell } from '@/features/navigation/product-shell'
import { TradingPage, type TradingTab } from '@/features/trading/trading-page'

export default async function TradingRoute({ params, searchParams }: { params: Promise<{ tab: string }>; searchParams: Promise<{ symbol?: string }> }) {
  const { tab } = await params
  const { symbol } = await searchParams
  const validTabs: TradingTab[] = ['positions', 'ledger', 'predictions', 'statistics']
  const activeTab = validTabs.includes(tab as TradingTab) ? tab as TradingTab : 'positions'
  return <ProductShell activeHref={`/trading/${activeTab}`} section="trading"><TradingPage initialTab={activeTab} symbol={symbol} /></ProductShell>
}
