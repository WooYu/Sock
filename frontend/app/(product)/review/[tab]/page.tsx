import { ProductShell } from '@/features/navigation/product-shell'
import { ReviewPage, type ReviewTab } from '@/features/review/review-page'

export default async function ReviewRoute({ params }: { params: Promise<{ tab: string }> }) {
  const { tab } = await params
  const validTabs: ReviewTab[] = ['daily', 'trade', 'history', 'backtest']
  return <ProductShell section="review"><ReviewPage initialTab={validTabs.includes(tab as ReviewTab) ? tab as ReviewTab : 'daily'} /></ProductShell>
}
