'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { getPortfolio } from '@/lib/api/backend-client'
import { getAuthorizationHeader, getClientId } from '../records/record-sync'
import { useStockWorkspace } from '../workspace/stock-workspace-provider'
import type { OperationCycle } from '../workspace/stock-workspace-types'

export type OverviewHolding = {
  symbol: string
  name: string
  marketValue?: number
  profitRate?: number
  shares?: number
  cost?: number
  price?: number
  profit?: number
  code?: string
}

const demoHoldings: OverviewHolding[] = [
  { symbol: 'DEMO001', code: 'DEMO·001', name: '华芯动力', shares: 1500, cost: 31.9, price: 32.68, marketValue: 49020, profit: 1170, profitRate: 2.45 },
  { symbol: 'DEMO002', code: 'DEMO·002', name: '云端智造', shares: 800, cost: 24.6, price: 25.18, marketValue: 20144, profit: 464, profitRate: 2.36 },
  { symbol: 'DEMO003', code: 'DEMO·003', name: '新能材料', shares: 600, cost: 18.4, price: 17.92, marketValue: 10752, profit: -288, profitRate: -2.61 },
]

const modes = [
  { name: '3天5日线 → BOLL上轨', tag: '主策略', score: 86, tone: 'rise', description: '现价上方有 MA5 上移，优先等回踩买入，再以 3 天 BOLL 上轨分批止盈。' },
  { name: '攀升', tag: '备选', score: 74, tone: 'rise', description: '5日线或 BOLL 中轨不破时继续看多，适合持仓观察，不适合远离均线追涨。' },
  { name: '照镜子止盈', tag: '风控', score: 61, tone: 'amber', description: '触及 BOLL 上轨后观察 2 天，等待价格照镜子回到 5日线，避免把浮盈回吐。' },
  { name: '反弹止损', tag: '警戒', score: 39, tone: 'fall', description: '若下跌中继反弹不过 5日线，按弱势处理，不把反弹当反转。' },
]

export function OverviewPage({ holdings = demoHoldings }: { holdings?: OverviewHolding[] }) {
  const workspace = useStockWorkspace()
  const [remoteHoldings, setRemoteHoldings] = useState<OverviewHolding[] | null>(null)
  const [cycle, setCycle] = useState<OperationCycle>(workspace.cycle)
  const [selectedMode, setSelectedMode] = useState(2)
  const [message, setMessage] = useState('')
  const [enabledActions, setEnabledActions] = useState([true, true])
  const [aiTab, setAiTab] = useState<'conclusion' | 'evidence' | 'pending'>('conclusion')
  const [model, setModel] = useState('GPT-5')
  const [configOpen, setConfigOpen] = useState(false)
  const selected = modes[selectedMode]
  useEffect(() => {
    void getPortfolio(getClientId(), getAuthorizationHeader()).then((portfolio) => {
      setRemoteHoldings(portfolio.holdings.map((holding) => ({
        symbol: holding.symbol,
        code: holding.symbol,
        name: holding.symbol,
        shares: holding.quantity,
        cost: holding.averageCost,
      })))
    }).catch(() => undefined)
  }, [])
  const visibleHoldings = remoteHoldings ?? holdings
  const totalInvested = visibleHoldings.reduce((sum, holding) => sum + (holding.shares ?? 0) * (holding.cost ?? 0), 0)

  const changeCycle = async (nextCycle: OperationCycle) => {
    setCycle(nextCycle)
    await workspace.setCycle(nextCycle)
    setMessage(`${cycleLabel(nextCycle)}周期已切换`)
  }
  const setMainStrategy = () => {
    setMessage('主策略已更新')
    window.localStorage.setItem('stockcal:main-strategy', selected.name)
  }

  return (
    <div className="sc-dashboard">
      <section className="sc-section sc-portfolio" aria-labelledby="portfolio-title">
        <div className="sc-portfolio-heading"><SectionHeading eyebrow="组合视角 · 多股票盈亏" title="组合总览" titleId="portfolio-title" /><span className="sc-portfolio-status">{remoteHoldings ? '真实账户 · 已同步' : '演示持仓 · 非真实账户'}</span></div>
        <div className="sc-metrics sc-metrics-six">
          <Metric label="持仓股票" value={visibleHoldings.length.toString()} suffix="只" />
          <Metric label="总投入" value={remoteHoldings ? totalInvested.toFixed(2) : '78,570.00'} suffix="元" />
          <Metric label="当前市值" value={remoteHoldings ? '—' : '79,916.00'} suffix="元" />
          <Metric label="总浮动盈亏" value={remoteHoldings ? '—' : '+1,346.00'} suffix="元" tone={remoteHoldings ? undefined : 'positive'} />
          <Metric label="已实现盈亏" value={remoteHoldings ? '—' : '+84.00'} suffix="元" tone={remoteHoldings ? undefined : 'positive'} />
          <Metric label="组合收益率" value={remoteHoldings ? '—' : '+1.82'} suffix="%" tone={remoteHoldings ? undefined : 'positive'} hint={remoteHoldings ? '等待行情报价' : '浮动 + 已实现'} />
        </div>
        <div className="sc-table" role="table" aria-label="持仓股票盈亏">
          <div className="sc-table-row sc-table-head" role="row"><span>股票</span><span>持仓 / 成本</span><span>现价 / 市值</span><span>浮动盈亏</span><span>收益率</span><span /></div>
          {visibleHoldings.map((holding) => (
            <div className="sc-table-row sc-holding-row" key={holding.symbol}>
              <button className="sc-holding-select" onClick={() => void workspace.selectStock(holding.symbol)} type="button"><b>{holding.name}</b><small>{holding.code ?? holding.symbol}</small></button>
              <span>{holding.shares ?? '—'} 股<small>成本 {holding.cost?.toFixed(2) ?? '—'}</small></span>
              <span>{holding.price?.toFixed(2) ?? '—'}<small>市值 {holding.marketValue?.toFixed(2) ?? '—'}</small></span>
              <strong className={(holding.profit ?? 0) >= 0 ? 'sc-positive' : 'sc-negative'}>{formatSigned(holding.profit)}</strong>
              <strong className={(holding.profitRate ?? 0) >= 0 ? 'sc-positive' : 'sc-negative'}>{formatSigned(holding.profitRate, '%')}</strong>
              <Link className="sc-link" href={`/analysis/key-levels?symbol=${holding.symbol}`}>查看详情 →</Link>
            </div>
          ))}
        </div>
        {holdings[0] ? <Link className="sc-link sc-portfolio-analysis-link" href={`/analysis/key-levels?symbol=${holdings[0].symbol}`}>查看个股分析</Link> : null}
      </section>

      <section className="sc-ticker" aria-labelledby="ticker-title">
        <div className="sc-stock-identity"><span className="sc-stock-avatar">华</span><div><div className="sc-stock-title"><h1 id="ticker-title">华芯动力</h1><span>DEMO·001</span><em>深市主板示例</em></div><div className="sc-tags"><span>自选</span><span>半导体设备</span><span className="sc-demo-tag">DEMO</span></div></div></div>
        <div className="sc-price"><strong>32.68</strong><span className="sc-positive">+0.86 <b>+2.70%</b></span><small>收盘后 15:18</small></div>
        <dl className="sc-quote-stats"><Quote label="今开" value="31.92" /><Quote label="最高" value="32.96" tone="positive" /><Quote label="最低" value="31.74" tone="negative" /><Quote label="成交量" value="48.2万手" /><Quote label="换手率" value="4.28%" /></dl>
        <div className="sc-cycle"><span>操作周期 <em>系统推荐</em></span><div><button className={cycle === 'short' ? 'active' : undefined} onClick={() => void changeCycle('short')} type="button">短线</button><button className={cycle === 'swing' ? 'active' : undefined} onClick={() => void changeCycle('swing')} type="button">波段</button><button className={cycle === 'long' ? 'active' : undefined} onClick={() => void changeCycle('long')} type="button">中长线</button></div></div>
      </section>

      <section className="sc-decision" aria-label="方向判断"><div className="sc-decision-primary"><span className="sc-decision-icon">↗</span><div><p><span>多头占优</span><em>未来 1～4 日</em></p><h2>近端均线拐头向上，但 33.48 上方仍需要量能确认；先看共振区是否由压力转为支撑。</h2></div></div><div className="sc-gauge"><div><span>方向强度</span><strong>64<small>/100</small></strong></div><i><b /></i><small>空头　　中性　　多头</small></div><dl className="sc-decision-meta"><div><dt>周期匹配</dt><dd>86<small>/100</small></dd></div><div><dt>可信等级</dt><dd>较高</dd></div><div><dt>规则覆盖</dt><dd>2<small> 条</small></dd></div></dl></section>

      <section className="sc-section sc-mode" aria-labelledby="mode-title"><div className="sc-mode-intro"><SectionHeading eyebrow="盈利模式识别 · 规则匹配" title="当前更适合哪种盈利方式？" titleId="mode-title" /><p>系统把当天的振幅、MA5、BOLL、量能和趋势状态打成多个参数，再按你的经验规则排序。</p><div className="sc-parameter-strip"><span>今日参数 <b>12</b></span><span>振幅匹配 <b>3.8%</b></span><span>规则命中 <b>8/11</b></span></div></div><div className="sc-mode-list" role="tablist" aria-label="盈利模式">{modes.map((mode, index) => <button className={`sc-mode-option ${mode.tone} ${selectedMode === index ? 'selected' : ''}`} key={mode.name} onClick={() => setSelectedMode(index)} role="tab" aria-selected={selectedMode === index} type="button"><span><b>{mode.name}</b><em>{mode.tag}</em></span><strong><i style={{ width: `${mode.score}%` }} />{mode.score}</strong><small>{mode.description}</small></button>)}</div><div className="sc-mode-detail"><div><span className={`sc-mode-badge ${selected.tone}`}>{selected.tag}</span><h3>{selected.name}</h3></div><button onClick={setMainStrategy} type="button">设为主策略</button><p>{selected.description}</p><div className="sc-levels"><span><small>买入关注</small><b>不追高</b></span><span><small>卖出 / 止盈</small><b>33.88～34.12</b></span><span><small>失效条件</small><b>跌破 5日线且放量</b></span></div><div className="sc-evidence"><span>✓ 距离 MA5 偏离 1.7%</span><span>✓ 上轨附近易反复</span><span>✓ 适合已有持仓</span></div></div></section>

      <section className="sc-section" aria-labelledby="actions-title"><SectionHeading eyebrow="历史数据校准 · 公司行为" title="公司行为调整" note="除权除息后再计算 MA / BOLL" titleId="actions-title" /><div className="sc-actions-grid"><div className="sc-table sc-action-table"><div className="sc-table-row sc-table-head"><span>日期</span><span>行为</span><span>说明</span><span>纳入调整</span></div>{['2026-07-21', '2026-06-18'].map((date, index) => <div className="sc-table-row" key={date}><b>{date}</b><strong>{index === 0 ? '现金分红 0.50 元' : '拆分 2:1'}</strong><span>{index === 0 ? '每股现金分红' : '10 转 5'}</span><button className={`sc-switch ${enabledActions[index] ? 'active' : ''}`} aria-label={`${enabledActions[index] ? '取消' : '启用'}公司行为 ${date}`} onClick={() => setEnabledActions((items) => items.map((enabled, itemIndex) => itemIndex === index ? !enabled : enabled))} type="button"><i /></button></div>)}</div><div className="sc-action-result"><p className="sc-eyebrow">调整结果</p><div><span>现价参考</span><strong>32.68</strong></div><div className="active"><span>复权参考价</span><strong>16.09</strong></div><p>当前启用 {enabledActions.filter(Boolean).length} 项公司行为。调整仅影响历史价格与指标计算，不会修改实际成交记录。</p><button onClick={() => setEnabledActions([true, true])} type="button">恢复全部调整</button></div></div></section>

      <section className="sc-ai" aria-labelledby="ai-title"><div className="sc-ai-head"><div><p className="sc-eyebrow">模型编排 · 可解释分析</p><h2 id="ai-title">AI策略分析中心</h2><p>这里展示策略是如何从数值计算、规则匹配和 AI 解释共同得到的。当前仅为演示模型，不代表已调用真实 API。</p></div><span>DEMO · 未接入真实模型</span></div><div className="sc-ai-pipeline"><Pipeline number="01" title="数值计算层" detail="MA · BOLL · ATR · 振幅" value="12 项参数" /><i>→</i><Pipeline number="02" title="规则引擎层" detail="个人经验 · 策略条件" value="8/11 命中" /><i>→</i><Pipeline number="03" title="AI解释层" detail="复杂推理与策略解释" value="86 分" /></div><div className="sc-ai-body"><div className="sc-ai-conclusion"><div className="sc-ai-tabs">{[['conclusion', '策略结论'], ['evidence', '解释依据'], ['pending', '待确认经验']].map(([value, label]) => <button className={aiTab === value ? 'active' : undefined} key={value} onClick={() => setAiTab(value as typeof aiTab)} type="button">{label}</button>)}</div>{aiTab === 'conclusion' ? <div className="sc-conclusion-content"><strong>↗</strong><div><span>当前推荐</span><h3>3天5日线买入 → BOLL上轨止盈</h3><p>当前价格位于 MA5 上方，BOLL 上轨持续抬升，近期振幅适合短线区间策略。建议下个交易日等待 32.98～33.24 回踩，不追高；目标位 33.88～34.12。</p><div className="sc-scores"><span>策略匹配度 <b>86</b></span><span>规则可信度 <b>78</b></span><span>风险等级 <b>中等</b></span></div></div></div> : <div className="sc-conclusion-content"><strong>✓</strong><div><span>{aiTab === 'evidence' ? '解释依据已展开' : '待确认经验已展开'}</span><h3>{aiTab === 'evidence' ? '指标、规则与历史记录共同影响本次结论' : '将本次执行结果沉淀为个人规则'}</h3><p>{aiTab === 'evidence' ? '价格与 MA5、BOLL 中轨的距离、量能变化和已发布规则共同构成当前解释依据。' : '完成交易和复盘后，可以把有效的判断条件保存到规则库，再参与后续分析。'}</p></div></div>}</div><aside className="sc-model-card"><p className="sc-eyebrow">当前分析模型</p><div><button className={model === 'GPT-5' ? 'active' : undefined} onClick={() => setModel('GPT-5')} type="button">GPT-5</button><button className={model === '轻量分类模型' ? 'active' : undefined} onClick={() => setModel('轻量分类模型')} type="button">轻量分类模型</button></div><h3>{model}</h3><span>演示模型</span><p>把指标结果、用户规则和历史案例组织成可解释的下个交易日策略。</p><dl><div><dt>用途</dt><dd>复杂推理与策略解释</dd></div><div><dt>输入</dt><dd>指标、规则、历史复盘</dd></div><div><dt>输出</dt><dd>策略排序与解释</dd></div></dl><button onClick={() => setConfigOpen(true)} type="button">查看模型配置</button></aside></div>{configOpen ? <div className="sc-modal-backdrop" role="presentation"><div className="sc-modal" aria-label="模型配置" role="dialog"><div><p className="sc-eyebrow">当前配置</p><h3>{model}</h3></div><p>当前为演示配置，实际接入后端 AI 服务时，在服务器环境变量中配置模型和密钥。</p><dl><div><dt>模型</dt><dd>{model}</dd></div><div><dt>状态</dt><dd>未接入真实 API</dd></div></dl><button onClick={() => setConfigOpen(false)} type="button">关闭</button></div></div> : null}</section>

      <section className="sc-analysis-grid" aria-labelledby="levels-title"><div className="sc-section sc-levels-panel"><SectionHeading eyebrow="双向价格地图" title="关键区域与目标位" titleId="levels-title" /><div className="sc-zone-grid"><Zone tone="rise" title="上涨关键区" price="33.24" range="33.05～33.48" probability="72%" window="1～2个交易日" expanded /><Zone tone="rise" title="上涨目标区" price="34.12" range="33.88～34.19" probability="48%" window="3～4个交易日" /><Zone tone="fall" title="下跌支撑区" price="32.08" range="31.82～32.34" probability="66%" window="1～2个交易日" /></div></div><aside className="sc-side-stack"><Panel title="日线与未来指标延伸"><div className="sc-mini-chart"><span /><b /><i /></div><div className="sc-chart-legend"><span>MA5 33.18</span><span>BOLL中轨 33.31</span></div><Link href="/chart">打开专业 K 线 →</Link></Panel><Panel title="观察顺序"><ol><li><b>先看</b> 33.24 共振区是否站稳</li><li><b>再看</b> 32.78 是否守住</li><li><b>最后</b> 量能是否同步放大</li></ol><Link href="/analysis/key-levels">进入个股分析 →</Link></Panel></aside></section>

      <section className="sc-bottom-grid"><Panel title="未来三日：多路径，不给单点幻觉"><div className="sc-forecast-row"><span>回踩 MA5 后震荡上移</span><strong className="sc-positive">+62%</strong></div><div className="sc-forecast-row"><span>横盘消化后向上突破</span><strong>+24%</strong></div><div className="sc-forecast-row"><span>跌破支撑转弱</span><strong className="sc-negative">-14%</strong></div></Panel><Panel title="当日总结"><p className="sc-muted-copy">今日观察重点：价格是否在 32.78 上方完成换手，收盘前不追涨。</p><Link href="/review/daily">打开复盘工作区 →</Link></Panel><Panel title="你的经验优先于默认模型"><p className="sc-muted-copy">短线关键位优先参考未来四日日线与周线均线 / BOLL。</p><Link href="/rules">管理经验规则 →</Link></Panel></section>

      {message ? <p className="sc-selected-stock" role="status"><span>{message}</span><small>操作已记录，可继续进入分析、交易或复盘</small></p> : null}{workspace.selectedSymbol ? <p className="sc-selected-stock"><span>当前股票：{workspace.selectedSymbol}</span><small>已同步到分析、K 线与交易工作区</small></p> : null}
    </div>
  )
}

function SectionHeading({ eyebrow, title, note, titleId }: { eyebrow: string; title: string; note?: string; titleId?: string }) {
  return <div className="sc-heading"><div><p className="sc-eyebrow">{eyebrow}</p><h2 id={titleId}>{title}</h2></div>{note ? <span>{note}</span> : null}</div>
}

function Metric({ label, value, suffix, tone, hint }: { label: string; value: string; suffix?: string; tone?: 'positive' | 'negative'; hint?: string }) {
  return <div className={tone ? `sc-metric ${tone}` : 'sc-metric'}><small>{label}</small><strong>{value}</strong><span>{hint ?? suffix}</span></div>
}

function Quote({ label, value, tone }: { label: string; value: string; tone?: 'positive' | 'negative' }) {
  return <div><dt>{label}</dt><dd className={tone ? `sc-${tone}` : undefined}>{value}</dd></div>
}

function Pipeline({ number, title, detail, value }: { number: string; title: string; detail: string; value: string }) {
  return <div className="sc-pipeline-item"><span>{number}</span><div><b>{title}</b><small>{detail}</small></div><strong>{value}</strong></div>
}

function Zone({ tone, title, price, range, probability, window, expanded: initialExpanded = false }: { tone: 'rise' | 'fall'; title: string; price: string; range: string; probability: string; window: string; expanded?: boolean }) {
  const [expanded, setExpanded] = useState(initialExpanded)
  return <article className={`sc-zone ${tone} ${expanded ? 'expanded' : ''}`}><button type="button" aria-expanded={expanded} onClick={() => setExpanded((value) => !value)}><span><b>{title}</b><em>{expanded ? '先看这里' : '观察区'}</em></span><strong>{price}<small>{range}</small></strong><div><span>触达概率 <b>{probability}</b></span><span>观察窗口 <b>{window}</b></span></div><footer><span>共振 · ●●●●</span><span>{expanded ? '收起依据 ⌃' : '展开依据 ⌄'}</span></footer></button>{expanded ? <div className="sc-zone-detail"><p>日线 MA5 上移与周线 BOLL 中轨形成近端共振，经验规则将代表价上调至 {price}。</p><span>触发：放量站稳 33.48，确认向上突破</span><span>失效：回落并收于 32.78 下方</span></div> : null}</article>
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="sc-panel"><div className="sc-panel-heading"><h2>{title}</h2><span>更多 →</span></div>{children}</section>
}

function formatSigned(value?: number, suffix = '') {
  if (value === undefined) return '—'
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}${suffix}`
}

function cycleLabel(cycle: OperationCycle) {
  return cycle === 'short' ? '短线' : cycle === 'long' ? '中长线' : '波段'
}
