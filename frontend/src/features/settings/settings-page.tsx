import { ThemePicker } from './theme-picker'
import { RecordSyncButton } from '../records/record-sync-button'

export function SettingsPage() {
  return <section className="sc-settings-workspace">
    <header className="sc-settings-header"><p className="sc-eyebrow">StockCal</p><h1>设置</h1><p>调整阅读外观，查看数据与同步方式。</p></header>
    <div className="sc-settings-grid">
      <ThemePicker />
      <section aria-label="行情与数据" className="sc-settings-section"><h2>行情与数据</h2><div className="sc-settings-row"><div><strong>行情状态</strong><p>进入个股分析后自动请求真实行情，离线时保留明确的等待状态。</p></div><span className="sc-settings-status">自动刷新</span></div><div className="sc-settings-row"><div><strong>数据来源</strong><p>当前来源会在总览、分析和专业 K 线中显示。</p></div><span className="sc-settings-status">随行情展示</span></div></section>
      <section aria-label="记录与同步" className="sc-settings-section"><h2>记录与同步</h2><div className="sc-settings-row"><div><strong>共享研究记录</strong><p>自选、研究、图表、笔记和交易在所有账号间共享。在线时自动同步，断网编辑先保存在本机。</p></div></div><div className="sc-settings-sync"><RecordSyncButton /></div></section>
    </div>
  </section>
}
