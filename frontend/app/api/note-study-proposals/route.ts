import { getProposal, listProposals } from '@/lib/knowledge/note-study-proposals'
export function GET(request: Request) {
  const file = new URL(request.url).searchParams.get('file')
  if (!file) return Response.json(listProposals())
  const full = getProposal(file)
  return full ? Response.json(full) : Response.json({ message: '该文件没有已核对来源的逐篇研究' }, { status: 404 })
}
