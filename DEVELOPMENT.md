# TopstepX Trade Converter - Development Guide

## Project Overview

Firebase-hosted React app that converts TopstepX order exports to trade exports. TopstepX live accounts lack trade export functionality, so this app reconstructs trades from the orders export.

## Tech Stack

- **Frontend**: React + TypeScript + Vite
- **Styling**: Tailwind CSS (dark/grey theme)
- **Hosting**: Firebase Hosting (static site)
- **Processing**: Client-side CSV conversion

## Development Setup

```bash
module load nodejs/22.15.1  # Or use nvm/local node 20.19+
npm install
npm run dev      # Start dev server
npm test         # Run tests
npm run build    # Production build
```

## Deployment

```bash
npm run build && npx firebase deploy
```

Live URL: https://tsxtradeconverter.web.app

## Project Structure

```
src/
  App.tsx          # Main UI with drag & drop file input
  converter.ts     # Core conversion logic (testable)
  index.css        # Tailwind imports
  main.tsx         # React entry point
test/
  converter.test.ts       # Unit tests against sim data
  live.test.ts            # Tests against live account exports (PnL only)
  sim_training_data/      # Training data from sim environment (where both exports available)
    orders1.csv           # Sample input (orders export from sim)
    trades1.csv           # Expected output (trades export from sim, used as ground truth)
  live_data/              # Live account exports (orders only, no trades export available)
    orders_YYYY-MM-DD.csv # Add live order exports here
```

## Conversion Logic

### Input: Orders CSV
Key columns: `Id, ContractName, Status, Size, Side, FilledAt, ExecutePrice, PositionDisposition, TradeDay`

### Output: Trades CSV
Columns: `Id, ContractName, EnteredAt, ExitedAt, EntryPrice, ExitPrice, Fees, PnL, Size, Type, TradeDay, TradeDuration, Commissions`

### Algorithm

1. **Filter** to `Status === 'Filled'` orders only
2. **Group** by contract + trade day
3. **Track position** via FIFO: opposite-side fills close existing lots
4. **Calculate** per trade:
   - **Type**: `Short` if entry `Side === 'Ask'`, else `Long`
   - **PnL**: `(EntryPrice - ExitPrice) * Size * Multiplier` for shorts (opposite for longs)
   - **Fees**: `Size * FeePerContract` (varies by account type)
   - **Duration**: `ExitedAt - EnteredAt`
5. **Detect account type**: `TOPX` prefix = live (all others = sim)

### Contract Specifications

Fees are per round-turn (RT) from [official TopstepX documentation](https://help.topstep.com/en/articles/8284231-what-are-the-commissions-and-fees-in-the-live-funded-account).

| Contract | Multiplier | Fee/RT |
|----------|------------|--------|
| MNQ*     | 2          | $0.74  |
| NQ*      | 20         | $2.80  |
| MES*     | 5          | $0.74  |
| ES*      | 50         | $2.80  |
| M2K*     | 5          | $0.74  |
| RTY*     | 50         | $2.80  |
| MYM*     | 5          | $0.74  |
| YM*      | 50         | $2.80  |

### Key Rules

- PnL does NOT include fees (fees reported separately)
- Commissions column is always empty
- Orders with `PositionDisposition: 'ClosePosition'` are closing fills
- Match within same `TradeDay` only

## Adding New Contracts

Edit `src/converter.ts`:

```typescript
function getFeePerRoundTurn(contract: string): number {
  // Micros: $0.74/RT
  if (contract.startsWith('MNQ') || contract.startsWith('MES') || contract.startsWith('M2K') || contract.startsWith('MYM')) return 0.74
  // Full-size: $2.80/RT
  if (contract.startsWith('NQ') || contract.startsWith('ES') || contract.startsWith('RTY') || contract.startsWith('YM')) return 2.80
  return 0.74 // default to micro
}

function getMultiplier(contract: string): number {
  if (contract.startsWith('MNQ')) return 2
  if (contract.startsWith('NQ')) return 20
  // Add other contracts as needed
  return 1
}
```

## Testing

```bash
npm test              # Run once
npm run test:watch    # Watch mode
```

Tests validate:
- CSV header format
- PnL calculation (long/short)
- Multiplier per contract type
- Fee calculation
- Trade count matches expected

## Firebase Setup

Project: `tsxtradeconverter`
Config files: `firebase.json`, `.firebaserc`

To deploy to a different project:
1. Create project at https://console.firebase.google.com
2. Update `.firebaserc` with new project ID
3. `npx firebase login` (if needed)
4. `npm run build && npx firebase deploy`
