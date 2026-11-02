import { compare, type Deal } from "./dealMath";
import { demoPortfolio } from "./demo";
import { DAY } from "./pnl";

/** Sample deal-desk results from the sample vault: real catalogue items, made-up asks and sales. */
export function demoDeals(now = Date.now()): Deal[] {
  const factors = [0.74, 0.88, 1.06, 0.93, 0.81, 1.12, 0.97, 0.69, 1.02, 0.9, 0.85, 1.18];
  return demoPortfolio(now).items.map((it, i) => {
    const market = it.marketValue ?? 100;
    const price = Math.round(market * factors[i % factors.length] * 100) / 100;
    const sealed = (it.type ?? "").toLowerCase() === "sealed";
    const sales = sealed
      ? [{ t: now, price: market }]
      : it.history.slice(-5).map((p, k) => ({ t: now - (5 - k) * (6 + i) * DAY, price: p.v }));
    const c = compare(price, sales, now);
    return {
      item: it,
      price,
      marketplace: "CC",
      listedAt: now - (i * 3 + 1) * 3600_000,
      basis: sealed ? "tcgplayer" : "sales",
      ...c,
      ...(sealed ? { avg3: null, avgOf: 0, vsAvg3: null, stale: false } : {}),
      matchedName: it.matchedName,
      compUrl: it.sourceUrl,
    } satisfies Deal;
  });
}
