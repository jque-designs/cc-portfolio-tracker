import { fetchJson, num } from "./http";
import type { CCItem, PricePoint } from "./types";

/**
 * Sealed product prices from TCGplayer: the catalogue and today's market price come from
 * tcgcsv.com (a free daily mirror of TCGplayer's catalogue), and the price history from
 * TCGplayer's public product price-history endpoint.
 */
const TCGCSV = "https://tcgcsv.com/tcgplayer";
const HISTORY = "https://infinite-api.tcgplayer.com/price/history";
const SIX_HOURS = 6 * 3600;

export interface TcgGroup {
  groupId: number;
  name: string;
  abbreviation: string | null;
}
export interface TcgProduct {
  productId: number;
  name: string;
  url: string;
  imageUrl?: string;
  groupId: number;
}

/** TCGplayer category ids to try for a CollectorCrypt category + language, best first. */
export function categoryIds(category: string | null, language: string | null): number[] {
  const c = (category ?? "").toLowerCase();
  const jp = (language ?? "").toLowerCase().startsWith("jap");
  if (c.includes("pok")) return jp ? [85, 3] : [3, 85];
  if (c.includes("one piece")) return [68];
  if (c.includes("dragon")) return [80, 27];
  if (c.includes("magic")) return [1];
  if (c.includes("yu")) return [2];
  if (c.includes("lorcana")) return [71];
  if (c.includes("digimon")) return [63];
  if (c.includes("union arena")) return [81];
  if (c.includes("gundam")) return [86];
  if (c.includes("star wars")) return [79];
  if (c.includes("flesh")) return [62];
  if (c.includes("weiss")) return [20];
  return [];
}

export async function getGroups(categoryId: number): Promise<TcgGroup[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = await fetchJson<any>(`${TCGCSV}/${categoryId}/groups`, { revalidate: SIX_HOURS });
  return r.results ?? [];
}

export async function getProducts(categoryId: number, groupId: number): Promise<TcgProduct[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = await fetchJson<any>(`${TCGCSV}/${categoryId}/${groupId}/products`, { revalidate: SIX_HOURS });
  // Sealed products have no card "Number" in extendedData.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (r.results ?? []).filter((p: any) => !(p.extendedData ?? []).some((e: any) => e.name === "Number"));
}

export async function getMarketPrices(categoryId: number, groupId: number): Promise<Map<number, number>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = await fetchJson<any>(`${TCGCSV}/${categoryId}/${groupId}/prices`, { revalidate: SIX_HOURS });
  const m = new Map<number, number>();
  for (const p of r.results ?? []) {
    const v = num(p.marketPrice) ?? num(p.midPrice);
    if (v !== null && !m.has(p.productId)) m.set(p.productId, v);
  }
  return m;
}

const tokens = (s: string) =>
  s
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((w) => w.length > 1);

/** Find the TCGplayer set (group) for a CollectorCrypt sealed item. */
export function matchGroup(item: Pick<CCItem, "productCode" | "set" | "itemName">, groups: TcgGroup[]): TcgGroup | null {
  // CollectorCrypt writes "EB-03" where TCGplayer writes "EB03", so compare letters and digits only.
  const bare = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const code = bare(item.productCode ?? "");
  if (code) {
    const byPrefix = groups.find((g) => bare(g.name.split(":")[0]) === code && g.name.includes(":"));
    if (byPrefix) return byPrefix;
    const byAbbr = groups.find((g) => bare(g.abbreviation ?? "") === code);
    if (byAbbr) return byAbbr;
  }
  // Fall back to word overlap between the item name and the set name.
  const want = new Set(tokens(item.itemName));
  let best: TcgGroup | null = null;
  let bestScore = 0;
  for (const g of groups) {
    const gt = tokens(g.name.replace(/^[^:]*:\s*/, ""));
    if (!gt.length) continue;
    const hit = gt.filter((w) => want.has(w)).length;
    const score = hit / gt.length;
    if (hit >= 1 && score > bestScore) {
      best = g;
      bestScore = score;
    }
  }
  return bestScore >= 0.6 ? best : null;
}

// Words that make a product a different SKU from the plain one; a product that has one
// of these is only a match when the CollectorCrypt item name has it too.
const QUALIFIERS = [
  "case",
  "half",
  "enhanced",
  "sleeved",
  "display",
  "center",
  "exclusive",
  "mini",
  "art",
  "checklane",
  "premium",
  "single",
  "3",
  "build",
  "bundle",
  "elite",
  "blister",
  "tin",
  "collection",
  "pack",
  "box",
];

/** Pick the TCGplayer product that is the same SKU as the CollectorCrypt sealed item. */
export function matchProduct(
  item: Pick<CCItem, "itemName" | "format" | "packCount" | "productCode">,
  products: TcgProduct[],
): TcgProduct | null {
  const name = item.itemName.toLowerCase();
  const want = new Set(tokens(name));
  if ((item.format ?? "").toLowerCase() === "box") want.add("box");
  if ((item.format ?? "").toLowerCase() === "pack") want.add("pack");
  const isBoosterBox = want.has("box") && want.has("booster") && (item.packCount ?? 36) >= 18;
  let best: TcgProduct | null = null;
  let bestScore = -Infinity;
  for (const p of products) {
    const pt = tokens(p.name);
    let score = 0;
    for (const w of pt) {
      if (want.has(w)) score += QUALIFIERS.includes(w) ? 3 : 1;
      else if (QUALIFIERS.includes(w)) score -= 4;
    }
    for (const q of ["box", "pack", "bundle", "tin", "blister", "elite", "case"]) {
      if (want.has(q) && !pt.includes(q)) score -= 3;
    }
    if (isBoosterBox && /booster box$/i.test(p.name.trim())) score += 2;
    if (score > bestScore) {
      best = p;
      bestScore = score;
    }
  }
  return bestScore > 2 ? best : null;
}

interface HistoryBucket {
  bucketStartDate: string;
  marketPrice: string;
}

/** Daily points for the last month plus weekly points for the year before, oldest first. */
export async function getHistory(productId: number): Promise<PricePoint[]> {
  const get = async (range: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = await fetchJson<any>(`${HISTORY}/${productId}/detailed?range=${range}`, { revalidate: SIX_HOURS });
    const buckets: HistoryBucket[] = r.result?.[0]?.buckets ?? [];
    return buckets
      .map((b) => ({ t: Date.parse(b.bucketStartDate + "T23:59:59Z"), v: num(b.marketPrice) ?? 0 }))
      .filter((p) => Number.isFinite(p.t) && p.v > 0);
  };
  const [month, year] = await Promise.all([get("month").catch(() => []), get("annual").catch(() => [])]);
  const cutoff = month.length ? Math.min(...month.map((p) => p.t)) : Infinity;
  return [...year.filter((p) => p.t < cutoff), ...month].sort((a, b) => a.t - b.t);
}
