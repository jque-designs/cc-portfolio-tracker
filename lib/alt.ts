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

export function researchUrl(assetId: string): string {
  return `https://alt.xyz/research/${assetId}`;
}
