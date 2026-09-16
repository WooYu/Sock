import { ResearchStudio } from '@/features/research/research-studio'

export default async function ChartRoute({ searchParams }: { searchParams: Promise<{ symbol?: string; example?: string }> }) {
  const { symbol, example } = await searchParams
  return <ResearchStudio initialSymbol={symbol ?? '600519'} initialPreview={example === '1'} />
}
