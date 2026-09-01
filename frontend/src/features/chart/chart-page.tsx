'use client'

import { ChartWorkspace } from './chart-workspace'
import { useStockWorkspace } from '../workspace/stock-workspace-provider'

export function ChartPage() {
  const { current, lastSuccessful, status, errorMessage, refresh } = useStockWorkspace()
  return <ChartWorkspace errorMessage={errorMessage} onRetry={() => void refresh()} snapshot={(current ?? lastSuccessful)?.market ?? null} status={status} />
}
