import { ProductShell } from '@/features/navigation/product-shell'
import { ReviewPage, type ReviewTab } from '@/features/review/review-page'

export default async function ReviewRoute({ params }: { params: Promise<{ tab: string }> }) {
  const { tab } = await params
  const validTabs: ReviewTab[] = ['daily', 'trade', 'history', 'backtest']
  const activeTab = validTabs.includes(tab as ReviewTab) ? tab as ReviewTab : 'daily'
  return <ProductShell activeHref={`/review/${activeTab}`} section="review" tone="feed"><ReviewPage initialTab={activeTab} /></ProductShell>
}
