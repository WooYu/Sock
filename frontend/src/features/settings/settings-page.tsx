export function SettingsPage() {
  return <section className="sc-settings-workspace">
    <header className="sc-settings-header"><p className="sc-eyebrow">StockCal</p><h1>设置</h1><p>查看当前数据状态与本机使用偏好。</p></header>
    <section aria-label="行情与数据" className="sc-settings-section"><h2>行情与数据</h2><div className="sc-settings-row"><div><strong>行情状态</strong><p>进入个股分析后自动请求真实行情，离线时保留明确的等待状态。</p></div><span>自动刷新</span></div><div className="sc-settings-row"><div><strong>数据来源</strong><p>当前来源会在总览、分析和专业 K 线中显示。</p></div><span>随行情展示</span></div></section>
    <section aria-label="本机偏好" className="sc-settings-section"><h2>本机偏好</h2><div className="sc-settings-row"><div><strong>记录同步</strong><p>交易、预测和复盘会优先保存在本机；登录后可使用现有同步能力。</p></div><span>本机优先</span></div></section>
  </section>
}
