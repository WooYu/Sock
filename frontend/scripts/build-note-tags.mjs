import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const taxonomy = JSON.parse(readFileSync(resolve(scriptDir, '../src/features/knowledge/note-tag-taxonomy.json'), 'utf8'))
const knownTags = new Set(taxonomy.flatMap((dimension) => dimension.options.map((tag) => tag.id)))
// These matches produce reviewable topic candidates, never executable trading conditions.
const patterns = [
  ['topic.ma5', /\bMA\s*5\b|(?<![\d一二三四五六七八九十百])(?:五|5)日(?:均)?线|5\.10日线/i],
  ['topic.ma10', /\bMA\s*10\b|(?<![\d一二三四五六七八九十百])(?:十|10)日(?:均)?线|5\.10日线/i],
  ['topic.ma20', /\bMA\s*20\b|(?<![\d一二三四五六七八九十百])(?:二十|20)日(?:均)?线/i],
  ['topic.ma', /均线/], ['topic.boll', /BOLL|布林|上轨|中轨|下轨/i],
  ['topic.volume', /成交量|放量|缩量|量价|换手率/], ['topic.double-high', /双高/],
  ['topic.granville', /葛兰碧|格兰碧|葛兰比|格兰比|格兰币|葛[一二三四1234]/],
  ['topic.turtle', /海龟/], ['topic.mirror', /照镜子/], ['topic.phase', /摸线|三期|二转三/],
  ['topic.valuation', /市盈率|每股收益|估值|\bPE\b|\bEPS\b/i],
  ['topic.position', /仓位|满仓|持仓|总资产/], ['topic.market', /大盘|板块|指数/],
  ['purpose.screen', /选股|只做|不参与|禁止|买入资格/], ['purpose.trend', /趋势|攀升|金叉|死叉|沿着/],
  ['purpose.levels', /支撑|压力位|目标位|关键点|箱体/], ['purpose.forecast', /预测|推演|外推|算参数|增量/],
  ['purpose.valuation', /市盈率|估值|每股收益/], ['purpose.risk', /止损|风险|仓位|禁止|必须走|出局/],
  ['purpose.explain', /复盘|案例|原理|感悟|心态/],
  ['timeframe.daily', /日线|日K|(?:五|十|二十|5|10|20|30|60)日(?:均)?线|daily/i],
  ['timeframe.weekly', /周线|周K|weekly/i], ['timeframe.monthly', /月线|月K|monthly/i],
  ['timeframe.intraday', /分钟|分时|盘中|竞价|开盘十分钟|intraday/i],
  ['scope.stock', /A股|沪深|上证|创业板|科创板/i], ['scope.etf', /ETF/i], ['scope.bond', /可转债|转债/],
  ['scope.rising', /上涨|攀升|牛市/], ['scope.sideways', /震荡|横盘|整理平台/], ['scope.falling', /下跌|熊市/],
  ['data.daily', /日线|日K|收盘|最高价|最低价|成交量|[五5]日线/],
  ['data.intraday', /分钟|分时|盘中|竞价/], ['data.financial', /财报|每股收益|市盈率|业绩/],
  ['data.sector', /板块|大盘|指数/], ['data.portfolio', /成本价|仓位|持仓|总资产/],
  ['data.attachment', /!\[|图片|图像|音频|视频|\.mp[34]|\.png|\.jpg/i],
]

function excerpt(line, matchIndex = 0) {
  const start = Math.max(0, matchIndex - 60)
  return line.slice(start, Math.min(line.length, start + 240)).trim()
}

function addTag(record, tagId, source, method, reason) {
  if (!knownTags.has(tagId)) throw new Error(`Unknown taxonomy tag: ${tagId}`)
  if (!record.tags.includes(tagId)) {
    record.tags.push(tagId)
    record.evidence.push({ tagId, startLine: source.startLine, endLine: source.endLine, quote: source.quote, method, reason })
  }
}

function dictionaryTags(record, sources) {
  for (const [tagId, pattern] of patterns) {
    for (const source of sources) {
      const match = pattern.exec(source.quote)
      if (match) {
        addTag(record, tagId, { ...source, quote: excerpt(source.quote, match.index) }, 'dictionary', `原文术语匹配产生候选；请结合上下文核对。`)
        break
      }
    }
  }
}

function completeDimensions(record, source) {
  for (const dimension of ['topic', 'purpose', 'timeframe', 'scope', 'data']) {
    if (!record.tags.some((tag) => tag.startsWith(`${dimension}.`))) {
      addTag(record, `${dimension}.unknown`, source, 'dictionary', '本次未识别到明确内容，保留原文待人工补充。')
    }
  }
}

export function buildNoteCatalog({ root, commit, generatedAt }) {
  const legacy = JSON.parse(readFileSync(resolve(root, 'research/2026-09-16-xinyisheng/knowledge-catalog.json'), 'utf8'))
  const oldDocs = new Map(legacy.documents.map((document) => [document.file, document]))
  const files = readdirSync(resolve(root, 'notes')).filter((file) => file.endsWith('.md')).sort()
  const documents = [], fragments = [], rejectedQuotes = []
  for (const file of files) {
    const bytes = readFileSync(resolve(root, 'notes', file))
    const lines = bytes.toString('utf8').split(/\r?\n/)
    const sourceHash = createHash('sha256').update(bytes).digest('hex')
    const sourceUrl = `https://github.com/WooYu/Sock/blob/${commit}/notes/${encodeURIComponent(file)}`
    let frontMatter = false
    const sources = lines.flatMap((line, index) => {
      if (index === 0 && line.trim() === '---') { frontMatter = true; return [] }
      if (frontMatter) { if (line.trim() === '---') frontMatter = false; return [] }
      return line.trim() ? [{ startLine: index + 1, endLine: index + 1, quote: line }] : []
    })
    const fallbackIndex = lines.findIndex((line) => line.trim() && line.trim() !== '---')
    const first = sources.length ? { ...sources[0], quote: excerpt(sources[0].quote) }
      : { startLine: Math.max(0, fallbackIndex) + 1, endLine: Math.max(0, fallbackIndex) + 1, quote: excerpt(lines[Math.max(0, fallbackIndex)] ?? '') }
    if (!first.quote) throw new Error(`Completely empty file requires source evidence before labeling: ${file}`)
    const common = { file, sourceHash, sourceUrl, tags: [], evidence: [], gaps: [], status: 'candidate', version: 1, createdAt: generatedAt, revisionReason: '自动候选标签，尚待人工核对。' }
    const oldDoc = oldDocs.get(file)
    const document = { ...common, id: `note:${file}`, level: 'document', title: file.replace(/\.md$/, ''), sourceExcerpt: first.quote,
      summary: oldDoc?.summary ?? '旧研究尚未覆盖；本次从原文生成候选标签。', tags: [], evidence: [], gaps: [] }
    if (!sources.length) document.gaps.push('只有标题／元数据，缺少可解析正文；本篇标签仅为目录候选。')
    dictionaryTags(document, sources)
    const classification = oldDoc?.classification
    const kind = classification === 'case_study' ? 'kind.case' : classification === 'context' || classification === 'image_only' ? 'kind.context'
      : /计算|参数|价格/.test(file) ? 'kind.formula' : /原则|止损|仓位|不做/.test(file) ? 'kind.principle' : 'kind.experience'
    addTag(document, kind, first, 'catalog', oldDoc ? `复用旧目录分类 ${classification}，含义仍需核对。` : '按标题生成的内容类型候选，尚未经核对。')

    const rules = legacy.rules.filter((rule) => rule.sourceEvidence.some((e) => e.file === file))
    for (const rule of rules) {
      const valid = []
      for (const source of rule.sourceEvidence.filter((e) => e.file === file)) {
        const span = lines.slice(source.startLine - 1, source.endLine).join('\n')
        if (!span.includes(source.quote)) { rejectedQuotes.push(`${file}:${source.startLine}-${source.endLine} (${rule.id})`); document.gaps.push('旧目录引文与当前文件不一致，该片段未沿用。'); continue }
        // Display the exact quote within its original line range, never an invented reconstruction.
        valid.push({ ...source, quote: source.quote })
      }
      if (!valid.length) continue
      const fragment = { ...common, id: `fragment:${file}:${rule.id}`, parentId: document.id, level: 'fragment', title: rule.name,
        summary: rule.originalMeaning, sourceExcerpt: valid.map((e) => e.quote).join('\n\n'), tags: [], evidence: [], gaps: [...rule.assumptions, ...rule.caveats] }
      dictionaryTags(fragment, valid)
      const semantic = `${rule.name} ${rule.originalMeaning} ${rule.timeframe}`
      for (const [tagId, pattern] of patterns) {
        if (pattern.test(semantic)) addTag(fragment, tagId, valid[0], 'catalog', `旧语义解析指出此主题／情境；请核对所引原文，标签仍为候选。`)
      }
      const ruleKind = /formula/.test(rule.kind) ? 'kind.formula' : rule.kind === 'risk' || rule.kind === 'filter' ? 'kind.principle' : rule.kind === 'context' ? 'kind.context' : 'kind.experience'
      addTag(fragment, ruleKind, valid[0], 'catalog', `旧解析类型：${rule.kind}。`)
      const purpose = { filter: 'purpose.screen', risk: 'purpose.risk', target_formula: 'purpose.levels', forecast_formula: 'purpose.forecast', signal: 'purpose.trend', context: 'purpose.explain' }[rule.kind]
      if (purpose) addTag(fragment, purpose, valid[0], 'catalog', '复用旧解析的用途分类；不是交易信号。')
      const computability = { exact_daily: 'computability.direct', requires_proxy: 'computability.definition', requires_intraday: 'computability.data', requires_external_data: 'computability.data', subjective: 'computability.reference' }[rule.computability]
      addTag(fragment, computability ?? 'computability.definition', valid[0], 'catalog', `旧解析计算分类：${rule.computability}；尚未验证预测效果。`)
      completeDimensions(fragment, valid[0])
      fragments.push(fragment)
      for (const tag of fragment.tags) addTag(document, tag, fragment.evidence.find((e) => e.tagId === tag), 'catalog', `关联片段“${rule.name}”的候选标签；整篇标签与片段可分别修订。`)
    }
    if (!oldDoc) {
      for (const source of sources) {
        if (source.quote.startsWith('![') || source.quote.length < 8) continue
        const fragment = { ...common, id: `fragment:${file}:line-${source.startLine}`, parentId: document.id, level: 'fragment',
          title: document.title, summary: '新增笔记中的规则候选；未继承旧研究结果。', sourceExcerpt: source.quote, tags: [], evidence: [], gaps: [] }
        dictionaryTags(fragment, [source])
        addTag(fragment, kind, source, 'dictionary', '按标题生成的内容类型候选。')
        const direct = /^(02-ma-death-cross|03-stop-loss|04-position-sizing)/.test(file)
        addTag(fragment, direct ? 'computability.direct' : 'computability.definition', source, 'dictionary', direct ? '原文给出明确比较或比例条件；执行时点和数据口径仍需核对。' : '原文含温和、站稳或平台等需补充定义的词语。')
        fragment.gaps = [direct ? '执行时点、价格／账户口径需单独确认。' : '需补齐阈值、窗口或确认条件。']
        completeDimensions(fragment, source)
        fragments.push(fragment)
        for (const tag of fragment.tags) addTag(document, tag, fragment.evidence.find((e) => e.tagId === tag), 'dictionary', '来自本篇新增规则片段的候选标签。')
      }
    }
    if (!document.tags.some((tag) => tag.startsWith('computability.'))) {
      addTag(document, 'computability.reference', first, 'catalog', '尚未提取到有定义的规则片段，当前仅供解释。')
      document.gaps.push(classification === 'image_only' ? '图片或外链附件未读取，无法从正文恢复规则。' : '未登记可计算条件；应先提取原文片段并核对定义。')
    }
    if (document.tags.includes('data.attachment')) document.gaps.push('附件内容未纳入本次自动标签；仅记录正文提到的附件。')
    completeDimensions(document, first)
    documents.push(document)
  }
  return { schemaVersion: 1, generatedAt, sourceCommit: commit, sourceRepository: 'https://github.com/WooYu/Sock/tree/agent/local-first-watchlist/notes', documents, fragments,
    audit: { sourceQuotesRejected: rejectedQuotes.length, legacyDocumentCount: legacy.documents.length, addedFiles: files.filter((file) => !oldDocs.has(file)), rejectedQuotes } }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(scriptDir, '../..')
  const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim()
  const destination = resolve(scriptDir, '../src/features/knowledge/note-tag-catalog.json')
  const catalog = buildNoteCatalog({ root, commit, generatedAt: new Date().toISOString() })
  writeFileSync(destination, JSON.stringify(catalog, null, 2) + '\n')
  writeFileSync(resolve(scriptDir, '../src/features/knowledge/note-tag-summary.json'), JSON.stringify({
    documents: catalog.documents.length, fragments: catalog.fragments.length, sourceCommit: commit, generatedAt: catalog.generatedAt,
  }, null, 2) + '\n')
  console.log(`Saved ${catalog.documents.length} documents, ${catalog.fragments.length} fragments; ${catalog.audit.sourceQuotesRejected} stale citations rejected.`)
}
