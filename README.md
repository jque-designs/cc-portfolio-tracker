# Vault Ledger

Enter a Solana wallet and see the market value and PnL of everything it holds on
[CollectorCrypt](https://collectorcrypt.com): graded cards, sealed booster boxes, blisters
and the rest, with daily, weekly, monthly, yearly or custom-period performance per item
and for the whole portfolio.

The look borrows from Collector Crypt's new site: dark by default with a light theme, the
retro five-band stripe, a serif for big numbers and mono labels. `/?demo=1` opens a sample
vault (real catalogue items, made-up prices) so the UI can be tried without a wallet.

## Where the numbers come from

| What | Source |
| --- | --- |
| Holdings | Solana DAS `getAssetsByOwner`, keeping legacy pNFTs (symbol `COLLECTOR`) and Core assets under CollectorCrypt's authority, confirmed against `api.collectorcrypt.com/cards/publicNft/:mint`. CollectorCrypt's own owner records (`/marketplace?ownerAddress=`) fill gaps for anything the wallet holds on-chain. Without an RPC key, those records are used on their own. |
| Insured value | CollectorCrypt catalogue (`insuredValue`). |
| Graded cards | alt.xyz: cert number -> asset, then Alt Value, falling back to the median of the last three sales in that grade. History comes from the sales. |
| Sealed products | TCGplayer market price via [tcgcsv.com](https://tcgcsv.com). The CollectorCrypt `productCode` (e.g. `ME01`) maps to the TCGplayer set, and the format/name to the SKU. History comes from TCGplayer's price-history endpoint (daily for the last month, weekly for a year). |
| Anything else | Insured value, flagged in the table. |

Every row shows what it was matched to, so a wrong match is easy to spot.

All upstream calls happen in `app/api/portfolio` on the server: alt.xyz refuses requests
from scripts that pose as a browser, and the browser can't call these APIs cross-origin.

## Run it

```bash
cp .env.example .env.local   # add HELIUS_API_KEY (free at helius.dev)
npm install
npm run dev                   # http://localhost:3000
npm test                      # matching and PnL unit tests
npm run probe -- <wallet> <certNumber>   # live check of every upstream source
```

Deploy: import the repo in Vercel and set `HELIUS_API_KEY`.

## Known gaps

- The alt.xyz `Cert` and Alt Value query field names are inferred and need one live
  check with `npm run probe` (it also introspects the schema).
- Ungraded single cards fall back to insured value.
