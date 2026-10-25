import 'server-only'

export class ResearchRequestError extends Error {
  constructor(public readonly status: number, public readonly body: unknown) {
    super(body && typeof body === 'object' && 'message' in body ? String(body.message) : `研究记录请求失败：${status}`)
    this.name = 'ResearchRequestError'
  }
}
export async function researchRequest<T>(path: string, init: RequestInit = {}, identityHeaders?: Headers): Promise<T> {
  if (!/^\/api\/v1\/(?:scenario-records(?:\/[a-zA-Z0-9-]+(?:\/evaluat(?:e|ions))?)?|note-studies|learning-samples)(?:\?.*)?$/.test(path)) {
    throw new ResearchRequestError(400, { message: '研究资源路径无效' })
  }
  const base = process.env.STOCKCAL_RECORDS_API_BASE_URL?.trim() || process.env.STOCKCAL_API_BASE_URL?.trim()
  if (!base) throw new ResearchRequestError(503, { message: '研究记录服务未连接，本地保存与导出仍可使用' })
  const headers = new Headers(init.headers)
  headers.set('Accept', 'application/json')
  for (const name of ['x-client-id', 'authorization']) {
    const value = identityHeaders?.get(name)
    if (value) headers.set(name, value)
  }
  const timeout = AbortSignal.timeout(15_000)
  const signal = init.signal ? AbortSignal.any([init.signal, timeout]) : timeout
  const response = await fetch(new URL(path, base).toString(), { ...init, headers, signal, cache: 'no-store', redirect: 'error' })
  const body = await response.json().catch(() => null)
  if (!response.ok) throw new ResearchRequestError(response.status, body)
  return body as T
}

/** Routes select the upstream resource; request query strings cannot select a host. */
export async function proxyResearch(request: Request, resource: string, method: 'GET' | 'POST' = 'GET', prepare?: (body: Record<string, unknown>) => Promise<void>): Promise<Response> {
  try {
    let body: unknown
    if (method === 'POST') {
      try { body = await request.json() } catch { return Response.json({ message: '请求JSON格式无效' }, { status: 400 }) }
      if (!body || typeof body !== 'object' || Array.isArray(body)) return Response.json({ message: '研究请求格式无效' }, { status: 400 })
      if (prepare) await prepare(body as Record<string, unknown>)
    }
    return Response.json(await researchRequest(`/api/v1/${resource}${new URL(request.url).search}`, {
      method, signal: request.signal, ...(method === 'POST' ? { body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } } : {}),
    }, request.headers))
  } catch (error) {
    if (error instanceof ResearchRequestError) return Response.json(error.body ?? { message: error.message }, { status: error.status })
    return Response.json({ message: '研究记录服务暂时不可用，请重试' }, { status: 502 })
  }
}
