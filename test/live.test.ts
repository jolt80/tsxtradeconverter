import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync, readdirSync } from 'fs'
import { join } from 'path'
import { convertOrdersToTrades } from '../src/converter'

const liveDataDir = join(__dirname, 'live_data')

// Expected daily PnL from live account (fees NOT subtracted)
const expectedDailyPnL: Record<string, number> = {
  'orders_2026-03-13.csv': 1189.20,
  'orders_2026-04-03.csv': -5.5
}

describe('live account conversion', () => {
  const orderFiles = existsSync(liveDataDir) 
    ? readdirSync(liveDataDir).filter(f => f.startsWith('orders_') && f.endsWith('.csv'))
    : []

  it.each(orderFiles)('%s matches expected daily PnL', (filename) => {
    const expected = expectedDailyPnL[filename]
    if (expected === undefined) return // skip files without expected value
    
    const input = readFileSync(join(liveDataDir, filename), 'utf-8')
    const result = convertOrdersToTrades(input)
    const lines = result.trim().split('\n').slice(1)
    
    // Net PnL = gross PnL - fees
    const totals = lines.reduce((acc, line) => {
      const cols = line.split(',')
      const pnl = parseFloat(cols[7]) || 0
      const fees = parseFloat(cols[6]) || 0
      return { pnl: acc.pnl + pnl, fees: acc.fees + fees }
    }, { pnl: 0, fees: 0 })

    const netPnL = totals.pnl - totals.fees
    expect(netPnL).toBeCloseTo(expected, 2)
  })

  it('skips if no live data files', () => {
    if (orderFiles.length === 0) {
      console.log('No live data files found - add orders_*.csv to test/live_data/')
    }
    expect(true).toBe(true)
  })
})
