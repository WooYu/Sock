'use client'

import { ChartWorkspace } from './chart-workspace'
import { useStockWorkspace } from '../workspace/stock-workspace-provider'

export function ChartPage() {
  const { current, lastSuccessful } = useStockWorkspace()
  return <ChartWorkspace snapshot={(current ?? lastSuccessful)?.market ?? null} />
}
