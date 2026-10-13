import { fetchJson, num } from "./http";
import type { PricePoint } from "./types";

/**
 * alt.xyz's own GraphQL API (the one its website calls). Requests go out from our server
 * with an honest user-agent: since 2026-10-02 alt.xyz refuses scripts that pretend to be a
 * browser. Operation names and the AssetMarketTransactions document are taken from
 * github.com/samaygodika/pokemon-psa10-history; the Cert operation name and its
 * `certNumber` variable are from alt.xyz's own requests. Field shapes marked UNVERIFIED
 * still need a live check (run `npm run probe`).
 */
const ENDPOINT = "https://alt-platform-server.production.internal.onlyalt.com/graphql/";

export async function gql<T>(operation: string, query: string, variables: object): Promise<T> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = await fetchJson<any>(ENDPOINT + operation, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "allow-read-replica": "true",
      origin: "https://alt.xyz",
      referer: "https://alt.xyz/",
      "idempotency-key": crypto.randomUUID(),
    },
    body: JSON.stringify({ operationName: operation, query, variables }),
  });
  if (r.errors?.length) throw new Error(`alt.xyz ${operation}: ${r.errors[0].message}`);
  return r.data as T;
}

// UNVERIFIED field names inside `cert`.
const Q_CERT = `
query Cert($certNumber: String!) {
  cert(certNumber: $certNumber) {
    certNumber
    gradingCompany
    gradeNumber
    asset { id name }
  }
}`;

// UNVERIFIED: the Alt Value field. Failure here falls back to recent sales.
const Q_ALT_VALUE = `
query AssetAltValue($id: ID!, $tsFilter: TimeSeriesFilter!) {
  asset(id: $id) {
    id
    altValueInfo(tsFilter: $tsFilter) { currentAltValue }
  }
}`;

const Q_TRANSACTIONS = `
query AssetMarketTransactions($id: ID!, $marketTransactionFilter: MarketTransactionFilter!) {
  asset(id: $id) {
    id
    marketTransactions(marketTransactionFilter: $marketTransactionFilter) {
      id date auctionHouse price
      attributes { gradeNumber gradingCompany }
      consolidatedSkippedReason
    }
  }
}`;

export function normaliseGrade(g: string | number | null | undefined): string | null {
  const n = num(typeof g === "string" ? g.replace(/[^0-9.]/g, "") : g);
  return n === null ? null : n.toFixed(1);
}

export function normaliseCompany(c: string): string {
  const u = c.trim().toUpperCase();
  if (u.startsWith("PSA")) return "PSA";
  if (u.startsWith("BGS") || u.startsWith("BECKETT")) return "BGS";
  if (u.startsWith("CGC")) return "CGC";
  if (u.startsWith("SGC")) return "SGC";
  return u;
}

export interface AltCert {
  assetId: string;
  assetName: string;
  gradingCompany: string;
  gradeNumber: string;
}

export async function lookupCert(certNumber: string): Promise<AltCert | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = await gql<any>("Cert", Q_CERT, { certNumber });
  const c = d?.cert;
  if (!c?.asset?.id) return null;
  return {
    assetId: c.asset.id,
    assetName: c.asset.name,
    gradingCompany: normaliseCompany(c.gradingCompany ?? ""),
    gradeNumber: normaliseGrade(c.gradeNumber) ?? "",
  };
}

export async function getAltValue(assetId: string, company: string, grade: string): Promise<number | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d = await gql<any>("AssetAltValue", Q_ALT_VALUE, {
      id: assetId,
      tsFilter: { gradingCompany: company, gradeNumber: grade },
    });
    return num(d?.asset?.altValueInfo?.currentAltValue);
  } catch {
    return null;
  }
}

export interface Sale {
  t: number;
  price: number;
}

export async function getSales(assetId: string, company: string, grade: string): Promise<Sale[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = await gql<any>("AssetMarketTransactions", Q_TRANSACTIONS, {
    id: assetId,
    marketTransactionFilter: { allGrades: false, gradingCompany: company, gradeNumber: grade, showSkipped: false },
  });
  const rows = d?.asset?.marketTransactions ?? [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return rows
    .filter((r: any) => !r.consolidatedSkippedReason)
    .map((r: any) => ({ t: Date.parse(r.date), price: num(r.price) }))
    .filter((s: { t: number; price: number | null }) => Number.isFinite(s.t) && s.price !== null && s.price > 0)
    .sort((a: Sale, b: Sale) => a.t - b.t) as Sale[];
}

const DAY = 86_400_000;

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/**
 * Market value implied by sales up to time `t`: the median of the last three sales in the
 * 180 days before `t`, else the most recent sale before `t`, else null.
 */
export function valueFromSales(sales: Sale[], t: number): number | null {
  const before = sales.filter((s) => s.t <= t);
  if (!before.length) return null;
  const recent = before.filter((s) => s.t >= t - 180 * DAY).slice(-3);
  return recent.length ? median(recent.map((s) => s.price)) : before[before.length - 1].price;
}

/** One history point per sale date, valued with `valueFromSales`. */
export function historyFromSales(sales: Sale[]): PricePoint[] {
  const days = [...new Set(sales.map((s) => Math.floor(s.t / DAY) * DAY + DAY - 1))];
  return days.map((t) => ({ t, v: valueFromSales(sales, t)! }));
}

/**
 * Name search, for graded cards whose cert alt.xyz doesn't know (often CGC). alt.xyz's site
 * searches a Typesense index with a short-lived read key that SearchServiceConfig hands to
 * every visitor (shape from github.com/samaygodika/pokemon-psa10-history).
 */
const Q_SEARCH_CONFIG = `
query SearchServiceConfig {
  serviceConfig { search { assetSearch {
    clientConfig { nodes { host port protocol } apiKey }
    collectionName expiresAt
  } } }
}`;

interface SearchConfig {
  clientConfig: { nodes: { host: string; port: number; protocol: string }[]; apiKey: string };
  collectionName: string;
  expiresAt: number; // unix seconds
}

let searchConfig: SearchConfig | null = null;

async function getSearchConfig(): Promise<SearchConfig> {
  if (searchConfig && searchConfig.expiresAt - 60 > Date.now() / 1000) return searchConfig;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = await gql<any>("SearchServiceConfig", Q_SEARCH_CONFIG, {});
  const cfg = d?.serviceConfig?.search?.assetSearch as SearchConfig | undefined;
  if (!cfg?.clientConfig?.nodes?.length) throw new Error("alt.xyz search config missing");
  searchConfig = cfg;
  return cfg;
}

export interface AltSearchHit {
  id: string;
  name?: string;
  year?: number | string;
  cardNumber?: string;
  externalTransactionCount?: number;
}

export async function searchAssets(text: string, limit = 25): Promise<AltSearchHit[]> {
  const cfg = await getSearchConfig();
  const node = cfg.clientConfig.nodes[0];
  const qs = new URLSearchParams({ q: text, query_by: "name,subject,brand,cardNumber", per_page: String(limit) });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = await fetchJson<any>(`${node.protocol}://${node.host}:${node.port}/collections/${cfg.collectionName}/documents/search?${qs}`, {
    headers: { "x-typesense-api-key": cfg.clientConfig.apiKey, origin: "https://alt.xyz" },
    revalidate: 86_400,
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (r.hits ?? []).map((h: any) => h.document as AltSearchHit);
}

/** Collector Crypt's item name without the slab: "... Light Jolteon #48 CGC 9 MINT" -> "... Light Jolteon 48". */
export function searchText(itemName: string): string {
  return itemName
    .replace(/\b(PSA|BGS|CGC|SGC|Beckett)\s+\d+(\.\d+)?(\s+(GEM[\s-]*MT|GEM MINT|MINT|NM-MT|PRISTINE|PERFECT))?\b/gi, " ")
    .replace(/#/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const words = (s: string) =>
  s
    .toLowerCase()
    .replace(/&/g, " and ")
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

// "048", "48" and "48/105" are the same card number.
const bareNumber = (s: string) =>
  s
    .split("/")[0]
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .replace(/^0+(?=.)/, "");

// A hit with one of these is a different print from the plain card unless the item says so too.
const VARIANTS = [
  "1st",
  "shadowless",
  "reverse",
  "staff",
  "prerelease",
  "error",
  // Foreign-language prints: the live check matched a CGC 9 English Jolteon to the German one.
  "japanese",
  "german",
  "french",
  "italian",
  "spanish",
  "portuguese",
  "dutch",
  "polish",
  "korean",
  "chinese",
  "thai",
  "indonesian",
];

/**
 * The search hit that is the same card as the Collector Crypt item, or null. Card number and
 * year must agree when both sides have them, a variant word on only one side rules a hit
 * out, and at least three quarters of the hit's name must appear in the item name.
 */
export function pickAsset(itemName: string, hits: AltSearchHit[]): AltSearchHit | null {
  const want = new Set(words(searchText(itemName)));
  const number = itemName.match(/#\s*([A-Za-z0-9-]+)/)?.[1];
  const year = itemName.match(/\b(19|20)\d{2}\b/)?.[0];
  let best: AltSearchHit | null = null;
  let bestScore = 0;
  for (const h of hits) {
    if (!h?.id || !h.name) continue;
    if (number && h.cardNumber && bareNumber(h.cardNumber) !== bareNumber(number)) continue;
    if (year && h.year && String(h.year) !== year) continue;
    const have = words(h.name);
    if (!have.length || VARIANTS.some((v) => have.includes(v) !== want.has(v))) continue;
    const score = have.filter((w) => want.has(w)).length / have.length;
    const busier = (h.externalTransactionCount ?? 0) > (best?.externalTransactionCount ?? 0);
    if (score > bestScore || (score === bestScore && busier)) {
      best = h;
      bestScore = score;
    }
  }
  return bestScore >= 0.75 ? best : null;
}

/** The matching alt.xyz card, plus the top search results so a miss can say what alt.xyz does have. */
/** A narrower query, the card's own name and number: "... Neo Destiny Light Jolteon #48" -> "Light Jolteon 48". */
export function shortSearchText(itemName: string): string | null {
  const m = itemName.match(/((?:[A-Za-z][\w'.-]*\s+){1,2})#\s*([A-Za-z0-9-]+)/);
  return m ? `${m[1].trim()} ${m[2]}` : null;
}

export async function findAssetByName(itemName: string): Promise<{ hit: AltSearchHit | null; nearest: string[] }> {
  let hits = await searchAssets(searchText(itemName));
  let hit = pickAsset(itemName, hits);
  // Foreign prints can crowd the plain card out of the first page; try once more with just the card.
  const short = shortSearchText(itemName);
  if (!hit && short) {
    const more = await searchAssets(short);
    hits = [...hits, ...more.filter((m) => !hits.some((h) => h.id === m.id))];
    hit = pickAsset(itemName, hits);
  }
  // Same-print results first, so the note shows a near miss rather than three foreign editions.
  const want = new Set(words(itemName));
  const samePrint = hits.filter((h) => !VARIANTS.some((v) => words(h.name ?? "").includes(v) !== want.has(v)));
  const nearest = [...samePrint, ...hits.filter((h) => !samePrint.includes(h))]
    .slice(0, 3)
    .map((h) => `${h.name ?? h.id}${h.cardNumber ? ` (no. ${h.cardNumber})` : ""}`);
  return { hit, nearest };
}

export function researchUrl(assetId: string): string {
  return `https://alt.xyz/research/${assetId}`;
}
