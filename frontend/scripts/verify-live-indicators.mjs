// Independent arithmetic audit, plus retrospective errors (not calibrated probabilities).
import { createServer } from 'vite'
import { writeFile, mkdir } from 'node:fs/promises'
const base = process.env.VERIFY_BASE_URL ?? 'http://localhost:3000'
const server = await createServer({ configFile: false, server: { middlewareMode: true, watch: null }, appType: 'custom' })
try {
  const { movingAverage, bollinger } = await server.ssrLoadModule('/src/features/chart/chart-math.ts')
  const { projectIndicators } = await server.ssrLoadModule('/src/features/chart/indicator-projection.ts')
  const started = performance.now()
  const response = await fetch(`${base}/api/market/stocks/600519/candles?period=day&adjustment=qfq`)
  if (!response.ok) throw Error(`Live source: ${response.status}`)
  const series = await response.json(), bars = series.bars
  if (series.adjustment !== 'qfq' || bars.length < 254) throw Error('Insufficient or mismatched source')
  const values = Object.fromEntries([5,10,20,30,60,90,120,250].map(n => {
    const independent = bars.slice(-n).reduce((s, b) => s + b.close, 0) / n
    const calculated = movingAverage(bars, n).at(-1)
    if (Math.abs(independent - calculated) > 1e-7) throw Error(`MA${n} mismatch`)
    return [`MA${n}`, calculated]
  }))
  const tail = bars.slice(-20).map(b => b.close), mean = tail.reduce((a,b) => a+b) / 20
  const upper = mean + 2 * Math.sqrt(tail.reduce((s,x) => s + (x-mean)**2, 0) / 20)
  if (Math.abs(bollinger(bars,20,2).upper.at(-1) - upper) > 1e-7) throw Error('BOLL mismatch')
  const errors = {}
  for(let end = Math.max(253, bars.length - 64); end <= bars.length - 4; end++) {
    const points = projectIndicators(bars.slice(0,end),'day',null)
    for(const [index,point] of points.entries()) for(const n of [5,10,20,30,60,90,120,250]) {
      const actual = bars.slice(end+index-n+1,end+index+1).reduce((s,b) => s+b.close,0) / n
      const key = `MA${n}/h${index+1}`, row = errors[key] ??= {count:0,absoluteError:0,baselineError:0}
      row.count++; row.absoluteError += Math.abs(point.values[`ma${n}`]-actual)
      row.baselineError += Math.abs(movingAverage(bars.slice(0,end),n).at(-1)-actual)
    }
  }
  for(const row of Object.values(errors)) { row.mae = row.absoluteError/row.count; row.baselineMae = row.baselineError/row.count; delete row.absoluteError; delete row.baselineError }
  const report = {symbol:'600519',adjustment:series.adjustment,lastDay:bars.at(-1).day,bars:bars.length,elapsedMs:Math.round(performance.now()-started),values,errors,
    limitation:'Current forward-adjusted history; retrospective diagnostic only. Future corporate-action knowledge may affect adjusted history. Not live forward validation or a calibrated interval.'}
  await mkdir('artifacts/indicator-audit',{recursive:true})
  await writeFile('artifacts/indicator-audit/600519.json',JSON.stringify(report,null,2))
  console.log(JSON.stringify({lastDay:report.lastDay,bars:report.bars,values,ma250FourBarError:errors['MA250/h4']}))
} finally { await server.close() }
