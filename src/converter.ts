interface Trade {
  Id: string
  ContractName: string
  EnteredAt: string
  ExitedAt: string
  EntryPrice: string
  ExitPrice: string
  Fees: string
  PnL: string
  Size: number
  Type: string
  TradeDay: string
  TradeDuration: string
  Commissions: string
}

function parseCSV(csv: string): Record<string, string>[] {
  const lines = csv.trim().split('\n')
  const headers = lines[0].split(',')
  return lines.slice(1).map(line => {
    const values = line.split(',')
    const row: Record<string, string> = {}
    headers.forEach((h, i) => row[h] = values[i] || '')
    return row
  })
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const millis = ms % 1000
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${millis.toString().padStart(3, '0')}0000`
}

function getFeePerRoundTurn(contract: string): number {
  // TopstepX fees per round-turn (RT) from official docs
  // https://help.topstep.com/en/articles/8284231-what-are-the-commissions-and-fees-in-the-live-funded-account
  // Micros: $0.74/RT
  if (contract.startsWith('MNQ') || contract.startsWith('MES') || contract.startsWith('M2K') || contract.startsWith('MYM') ||
      contract.startsWith('MCL') || contract.startsWith('MGC') || contract.startsWith('MHG') || contract.startsWith('MSI') ||
      contract.startsWith('M6A') || contract.startsWith('M6B') || contract.startsWith('M6E') || contract.startsWith('MJY')) return 0.74
  // Full-size: $2.80/RT
  if (contract.startsWith('NQ') || contract.startsWith('ES') || contract.startsWith('RTY') || contract.startsWith('YM') ||
      contract.startsWith('CL') || contract.startsWith('GC') || contract.startsWith('HG') || contract.startsWith('SI') ||
      contract.startsWith('6A') || contract.startsWith('6B') || contract.startsWith('6E') || contract.startsWith('6J')) return 2.80
  return 0.74 // default to micro
}

function getMultiplier(contract: string): number {
  if (contract.startsWith('MNQ')) return 2
  if (contract.startsWith('NQ')) return 20
  if (contract.startsWith('MES')) return 5
  if (contract.startsWith('ES')) return 50
  if (contract.startsWith('M2K')) return 5
  if (contract.startsWith('RTY')) return 50
  if (contract.startsWith('MYM')) return 0.5
  if (contract.startsWith('YM')) return 5
  if (contract.startsWith('MCL')) return 100
  if (contract.startsWith('CL')) return 1000
  if (contract.startsWith('MGC')) return 10
  if (contract.startsWith('GC')) return 100
  return 1
}

export function convertOrdersToTrades(csvContent: string): string {
  const rows = parseCSV(csvContent)
  
  const fills = rows
    .filter(r => r.Status === 'Filled')
    .map(r => ({
      Id: r.Id,
      ContractName: r.ContractName,
      Size: parseInt(r.Size),
      Side: r.Side,
      FilledAt: r.FilledAt,
      ExecutePrice: parseFloat(r.ExecutePrice),
      TradeDay: r.TradeDay
    }))
    .sort((a, b) => new Date(a.FilledAt).getTime() - new Date(b.FilledAt).getTime())

  const trades: Trade[] = []
  
  // Group by contract + trade day
  const groups = new Map<string, typeof fills>()
  for (const f of fills) {
    const key = `${f.ContractName}|${f.TradeDay}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(f)
  }

  const idCount = new Map<string, number>()
  
  for (const [, groupFills] of groups) {
    // Track position: positive = long, negative = short
    // openLots: array of { size, price, time, side } for FIFO matching
    const openLots: { size: number, price: number, time: string, side: string }[] = []
    
    for (const fill of groupFills) {
      const fillDir = fill.Side === 'Bid' ? 1 : -1 // Bid=buy=+1, Ask=sell=-1
      let remaining = fill.Size
      
      // Check if this fill closes existing position (opposite direction)
      while (remaining > 0 && openLots.length > 0) {
        const lot = openLots[0]
        const lotDir = lot.side === 'Bid' ? 1 : -1
        
        if (lotDir === fillDir) break // Same direction, not closing
        
        const matchSize = Math.min(lot.size, remaining)
        lot.size -= matchSize
        remaining -= matchSize
        
        if (lot.size === 0) openLots.shift()
        
        // Create trade
        const isShort = lot.side === 'Ask'
        const multiplier = getMultiplier(fill.ContractName)
        const priceDiff = isShort 
          ? (lot.price - fill.ExecutePrice) 
          : (fill.ExecutePrice - lot.price)
        const fees = matchSize * getFeePerRoundTurn(fill.ContractName)
        const pnl = priceDiff * matchSize * multiplier

        const entryTime = new Date(lot.time)
        const exitTime = new Date(fill.FilledAt)
        const durationMs = exitTime.getTime() - entryTime.getTime()

        const count = idCount.get(fill.Id) || 0
        idCount.set(fill.Id, count + 1)
        const tradeId = `${fill.Id}${String(count).padStart(2, '0')}`

        trades.push({
          Id: tradeId,
          ContractName: fill.ContractName,
          EnteredAt: lot.time,
          ExitedAt: fill.FilledAt,
          EntryPrice: lot.price.toFixed(9),
          ExitPrice: fill.ExecutePrice.toFixed(9),
          Fees: fees.toFixed(5),
          PnL: pnl.toFixed(9),
          Size: matchSize,
          Type: isShort ? 'Short' : 'Long',
          TradeDay: fill.TradeDay,
          TradeDuration: formatDuration(durationMs),
          Commissions: ''
        })
      }
      
      // Any remaining size opens new position
      if (remaining > 0) {
        openLots.push({ size: remaining, price: fill.ExecutePrice, time: fill.FilledAt, side: fill.Side })
      }
    }
  }

  trades.sort((a, b) => new Date(a.ExitedAt).getTime() - new Date(b.ExitedAt).getTime())

  const header = 'Id,ContractName,EnteredAt,ExitedAt,EntryPrice,ExitPrice,Fees,PnL,Size,Type,TradeDay,TradeDuration,Commissions'
  const lines = trades.map(t => 
    `${t.Id},${t.ContractName},${t.EnteredAt},${t.ExitedAt},${t.EntryPrice},${t.ExitPrice},${t.Fees},${t.PnL},${t.Size},${t.Type},${t.TradeDay},${t.TradeDuration},${t.Commissions}`
  )
  
  return header + '\n' + lines.join('\n') + '\n'
}
