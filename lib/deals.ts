import { getSales, researchUrl, type Sale } from "./alt";
import { type Deal, type DealBasis, type DealPage, type Order, compare } from "./dealMath";
import { authHeaders, toCCItem } from "./collectorcrypt";
import { fetchJson, mapPool, num } from "./http";
import { resolveAltAsset, valueSealed } from "./portfolio";
import type { CCItem } from "./types";

export * from "./dealMath";

/**
 * The deal engine: walk Collector Crypt's live marketplace listings and set each asking price
 * against what the same card in the same grade last sold for (alt.xyz's sales record, which
 * pools eBay, Goldin, Fanatics, PWCC and the other big auction houses), or, for sealed
 * product, against TCGplayer's market price. Collector Crypt's public API has listings but no
 * sales history (docs.collectorcrypt.com/marketplace/api), so alt.xyz is the comp source.
 */

const API = "https://api.collectorcrypt.com";

// Comps don't move minute to minute, and a scan asks for the same popular cards over and over.
const TTL = 60 * 60 * 1000;
const cache = new Map<string, { at: number; v: Promise<Comps> }>();

interface Comps {
  basis: DealBasis;
  sales: Sale[];
  matchedName: string | null;
  compUrl: string | null;
  note?: string;
}

function cached(key: string, load: () => Promise<Comps>): Promise<Comps> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.v;
  const v = load().catch((e) => {
    cache.delete(key);
    throw e;
  });
  cache.set(key, { at: Date.now(), v });
  if (cache.size > 5000) cache.delete(cache.keys().next().value!);
  return v;
}

async function gradedComps(item: CCItem): Promise<Comps> {
  const m = await resolveAltAsset(item);
  if (!m.ok) return { basis: "none", sales: [], matchedName: null, compUrl: null, note: m.note };
  const sales = await getSales(m.assetId, m.company, m.grade);
  return {
    basis: sales.length ? "sales" : "none",
    sales,
    matchedName: `${m.assetName} · ${m.company} ${m.grade}`,
    compUrl: researchUrl(m.assetId),
    note: sales.length ? m.note : `alt.xyz has no recorded sales for ${m.company} ${m.grade}`,
  };
}

async function sealedComps(item: CCItem): Promise<Comps> {
  const v = await valueSealed(item);
  if (v.source !== "tcgplayer" || v.marketValue === null) {
    return { basis: "none", sales: [], matchedName: null, compUrl: null, note: v.note };
  }
  // TCGplayer's market price is itself a rolling average of recent sales.
  return { basis: "tcgplayer", sales: [{ t: Date.now(), price: v.marketValue }], matchedName: v.matchedName, compUrl: v.sourceUrl };
}

export function compsFor(item: CCItem): Promise<Comps> {
  if ((item.type ?? "").toLowerCase() === "sealed") {
    return cached(`s|${item.category}|${item.language}|${item.productCode}|${item.itemName}`, () => sealedComps(item));
  }
  if (item.gradingID && item.gradingCompany) return cached(`g|${item.gradingCompany}|${item.gradingID}`, () => gradedComps(item));
  return Promise.resolve({ basis: "none", sales: [], matchedName: null, compUrl: null, note: "Raw card: no graded comps" });
}

export interface ScanOptions {
  cursor?: string;
  step?: number;
  min?: number;
  max?: number;
  search?: string;
  order?: Order;
}

export async function scanDeals(o: ScanOptions): Promise<DealPage> {
  // A minimum list price keeps unlisted vault items out: without one the endpoint returns all ~195k.
  const qs = new URLSearchParams({
    step: String(Math.min(Math.max(o.step ?? 40, 1), 60)),
    orderBy: o.order ?? "listedDateDesc",
    listPriceMin: String(Math.max(o.min ?? 1, 1)),
  });
  if (o.max) qs.set("listPriceMax", String(o.max));
  if (o.search?.trim()) qs.set("search", o.search.trim());
  if (o.cursor) qs.set("cursor", o.cursor);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = await fetchJson<any>(`${API}/marketplace?${qs}`, { headers: authHeaders() });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows: any[] = (r.filterNFtCard ?? []).filter((row: any) => num(row.listing?.price) !== null);
  const now = Date.now();
  const deals = await mapPool(rows, 6, async (row) => {
    const item = toCCItem(row);
    const price = num(row.listing.price)!;
    let comps: Comps;
    try {
      comps = await compsFor(item);
    } catch (e) {
      comps = { basis: "none", sales: [], matchedName: null, compUrl: null, note: `Comp lookup failed: ${(e as Error).message.slice(0, 100)}` };
    }
    const c = compare(price, comps.sales, now);
    const deal: Deal = {
      item,
      price,
      marketplace: row.listing.marketplace ?? null,
      listedAt: Date.parse(row.listing.createdAt ?? row.listedAt ?? "") || null,
      basis: comps.basis,
      ...c,
      // For sealed there is one market number, not a run of sales.
      ...(comps.basis === "tcgplayer" ? { avg3: null, avgOf: 0, vsAvg3: null, stale: false } : {}),
      matchedName: comps.matchedName,
      compUrl: comps.compUrl,
      note: comps.note,
    };
    return deal;
  });
  return { scannedAt: now, deals, nextCursor: r.nextCursor ?? null, matching: num(r.findTotal) };
}
