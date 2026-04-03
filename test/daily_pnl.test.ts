import { describe, it } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { convertOrdersToTrades } from '../src/converter'

const FILE = 'test/live_data/orders_full.csv'

function parseCsv(csv: string) {
  const lines = csv.trim().split('\n')
  const headers = lines[0].split(',')
  return lines.slice(1).map(line => {
    const vals = line.split(',')
    return Object.fromEntries(headers.map((h, i) => [h, vals[i]]))
  })
}

describe('daily PnL report', () => {
  it('prints closed PnL per trading day', () => {
    if (!existsSync(FILE)) {
      console.log('No orders_full.csv found')
      return
    }

    const csv = readFileSync(FILE, 'utf-8')
    const tradesCsv = convertOrdersToTrades(csv)
    const trades = parseCsv(tradesCsv)

    const byDay = new Map<string, { gross: number; fees: number }>()
    for (const t of trades) {
      const day = t.ExitedAt.split(' ')[0]
      const cur = byDay.get(day) || { gross: 0, fees: 0 }
      cur.gross += parseFloat(t.PnL)
      cur.fees += parseFloat(t.Fees)
      byDay.set(day, cur)
    }

    console.log('\nDaily Closed PnL:')
    console.log('Date        Gross      Fees       Net        Cumulative')
    console.log('─'.repeat(60))
    let cumulative = 0
    for (const [day, { gross, fees }] of [...byDay].sort()) {
      const net = gross - fees
      cumulative += net
      console.log(`${day}  ${gross.toFixed(2).padStart(9)}  ${fees.toFixed(2).padStart(8)}  ${net.toFixed(2).padStart(9)}  ${cumulative.toFixed(2).padStart(10)}`)
    }
  })
})
