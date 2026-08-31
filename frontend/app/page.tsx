import Link from 'next/link'

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--sc-background)] p-6 text-[var(--sc-foreground)]">
      <section className="w-full max-w-xl rounded-2xl border border-[var(--sc-border)] bg-[var(--sc-surface)] p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--sc-primary)]">
          StockCal
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">
          面向手机浏览器的股票分析工作区
        </h1>
        <p className="mt-4 text-[var(--sc-muted)]">
          从组合状态、关键位到 K 线和复盘，围绕同一只股票连续决策。
        </p>
        <Link
          className="mt-8 inline-flex min-h-12 items-center justify-center rounded-xl bg-[var(--sc-primary)] px-5 font-semibold text-white transition hover:opacity-90"
          href="/overview"
        >
          进入总览
        </Link>
      </section>
    </main>
  )
}
