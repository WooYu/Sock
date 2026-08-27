import { ProductShell } from '@/features/navigation/product-shell'
import { TradingPage, type TradingTab } from '@/features/trading/trading-page'

export default async function TradingRoute({ params, searchParams }: { params: Promise<{ tab: string }>; searchParams: Promise<{ symbol?: string }> }) {
  const { tab } = await params
  const { symbol } = await searchParams
  const validTabs: TradingTab[] = ['positions', 'ledger', 'predictions', 'statistics']
  return <ProductShell section="trading"><TradingPage initialTab={validTabs.includes(tab as TradingTab) ? tab as TradingTab : 'positions'} symbol={symbol} /></ProductShell>
}
