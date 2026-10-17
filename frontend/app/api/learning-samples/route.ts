import { proxyResearch } from '@/lib/api/research-backend-client'
export function GET(request: Request) { return proxyResearch(request, 'learning-samples') }
