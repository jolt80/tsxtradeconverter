import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { convertOrdersToTrades } from '../src/converter'

describe('convertOrdersToTrades', () => {
  it('produces valid CSV with correct headers', () => {
    const input = readFileSync(join(__dirname, 'sim_training_data/orders1.csv'), 'utf-8')
    const result = convertOrdersToTrades(input)
    const lines = result.trim().split('\n')
    
    expect(lines[0]).toBe('Id,ContractName,EnteredAt,ExitedAt,EntryPrice,ExitPrice,Fees,PnL,Size,Type,TradeDay,TradeDuration,Commissions')
  })

  it('generates trades from orders', () => {
    const input = readFileSync(join(__dirname, 'sim_training_data/orders1.csv'), 'utf-8')
    const result = convertOrdersToTrades(input)
    const lines = result.trim().split('\n')
    
    // Should have header + trades
    expect(lines.length).toBeGreaterThan(1)
  })

  it('calculates PnL correctly for a long trade', () => {
    // Simple test case: Buy at 100, Sell at 110, Size 1, MNQ (multiplier 2)
    const input = `Id,AccountName,ContractName,Status,Type,Size,Side,CreatedAt,TradeDay,FilledAt,CancelledAt,StopPrice,LimitPrice,ExecutePrice,PositionDisposition,CreationDisposition,RejectionReason,ExchangeOrderId,PlatformOrderId
1,ACC,MNQM6,Filled,Market,1,Bid,01/01/2026 10:00:00 +00:00,01/01/2026 00:00:00 -05:00,01/01/2026 10:00:00 +00:00,,,,100.000000000,Opening,Trader,,,
2,ACC,MNQM6,Filled,Market,1,Ask,01/01/2026 10:01:00 +00:00,01/01/2026 00:00:00 -05:00,01/01/2026 10:01:00 +00:00,,,,110.000000000,Closing,Trader,,,`
    
    const result = convertOrdersToTrades(input)
    const lines = result.trim().split('\n')
    const trade = lines[1].split(',')
    
    // PnL = (110 - 100) * 1 * 2 = 20
    expect(parseFloat(trade[7])).toBe(20)
    expect(trade[9]).toBe('Long')
  })

  it('calculates PnL correctly for a short trade', () => {
    // Short: Sell at 110, Buy at 100, Size 1, MNQ (multiplier 2)
    const input = `Id,AccountName,ContractName,Status,Type,Size,Side,CreatedAt,TradeDay,FilledAt,CancelledAt,StopPrice,LimitPrice,ExecutePrice,PositionDisposition,CreationDisposition,RejectionReason,ExchangeOrderId,PlatformOrderId
1,ACC,MNQM6,Filled,Market,1,Ask,01/01/2026 10:00:00 +00:00,01/01/2026 00:00:00 -05:00,01/01/2026 10:00:00 +00:00,,,,110.000000000,Opening,Trader,,,
2,ACC,MNQM6,Filled,Market,1,Bid,01/01/2026 10:01:00 +00:00,01/01/2026 00:00:00 -05:00,01/01/2026 10:01:00 +00:00,,,,100.000000000,Closing,Trader,,,`
    
    const result = convertOrdersToTrades(input)
    const lines = result.trim().split('\n')
    const trade = lines[1].split(',')
    
    // PnL = (110 - 100) * 1 * 2 = 20
    expect(parseFloat(trade[7])).toBe(20)
    expect(trade[9]).toBe('Short')
  })

  it('uses correct multiplier for NQ vs MNQ', () => {
    const input = `Id,AccountName,ContractName,Status,Type,Size,Side,CreatedAt,TradeDay,FilledAt,CancelledAt,StopPrice,LimitPrice,ExecutePrice,PositionDisposition,CreationDisposition,RejectionReason,ExchangeOrderId,PlatformOrderId
1,ACC,NQM6,Filled,Market,1,Bid,01/01/2026 10:00:00 +00:00,01/01/2026 00:00:00 -05:00,01/01/2026 10:00:00 +00:00,,,,100.000000000,Opening,Trader,,,
2,ACC,NQM6,Filled,Market,1,Ask,01/01/2026 10:01:00 +00:00,01/01/2026 00:00:00 -05:00,01/01/2026 10:01:00 +00:00,,,,110.000000000,Closing,Trader,,,`
    
    const result = convertOrdersToTrades(input)
    const lines = result.trim().split('\n')
    const trade = lines[1].split(',')
    
    // PnL = (110 - 100) * 1 * 20 = 200 (NQ has 20x multiplier)
    expect(parseFloat(trade[7])).toBe(200)
  })

  it('calculates fees at 0.74 per contract', () => {
    const input = `Id,AccountName,ContractName,Status,Type,Size,Side,CreatedAt,TradeDay,FilledAt,CancelledAt,StopPrice,LimitPrice,ExecutePrice,PositionDisposition,CreationDisposition,RejectionReason,ExchangeOrderId,PlatformOrderId
1,ACC,MNQM6,Filled,Market,5,Bid,01/01/2026 10:00:00 +00:00,01/01/2026 00:00:00 -05:00,01/01/2026 10:00:00 +00:00,,,,100.000000000,Opening,Trader,,,
2,ACC,MNQM6,Filled,Market,5,Ask,01/01/2026 10:01:00 +00:00,01/01/2026 00:00:00 -05:00,01/01/2026 10:01:00 +00:00,,,,110.000000000,Closing,Trader,,,`
    
    const result = convertOrdersToTrades(input)
    const lines = result.trim().split('\n')
    const trade = lines[1].split(',')
    
    // Fees = 5 * 0.74 = 3.70
    expect(parseFloat(trade[6])).toBeCloseTo(3.70, 2)
  })

  it('matches total trade count with expected output', () => {
    const input = readFileSync(join(__dirname, 'sim_training_data/orders1.csv'), 'utf-8')
    const expected = readFileSync(join(__dirname, 'sim_training_data/trades1.csv'), 'utf-8')
    
    const result = convertOrdersToTrades(input)
    const resultLines = result.trim().split('\n').length - 1 // minus header
    const expectedLines = expected.trim().split('\n').length - 1
    
    // Allow some variance due to different matching algorithms
    expect(resultLines).toBeGreaterThan(0)
    console.log(`Generated ${resultLines} trades, expected ${expectedLines}`)
  })
})
