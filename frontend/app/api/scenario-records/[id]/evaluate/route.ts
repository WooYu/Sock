import { proxyResearch } from '@/lib/api/research-backend-client'
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  return proxyResearch(request, 'scenario-records/' + encodeURIComponent(id) + '/evaluate', 'POST')
}
