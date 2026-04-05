# TopstepX Trade Converter

Converts TopstepX order exports to trade exports for import into journaling tools like Tradezella.

**Live app:** https://tsxtradeconverter.web.app

## Why?

TopstepX live funded accounts lack trade export functionality. This tool reconstructs trades from order exports using FIFO position matching, reverse-engineered from sim account data where both exports are available.

## Features

- Client-side processing - no data uploaded or stored
- Drag & drop CSV interface
- Supports NQ, MNQ, ES, MES, RTY, M2K, YM, MYM, CL, MCL, GC, MGC and more
- Fees calculated from [official TopstepX rates](https://help.topstep.com/en/articles/8284231-what-are-the-commissions-and-fees-in-the-live-funded-account)

## Limitations

- Trade IDs generated from order IDs (not original platform IDs)
- Entry/exit timestamps have lower resolution than platform
- Only tested with NQ and MNQ contracts

## Development

```bash
npm install
npm run dev      # Dev server
npm test         # Run tests
npm run build    # Production build
```

## Deployment

```bash
npm run build && npx firebase deploy
```

## License

MIT
