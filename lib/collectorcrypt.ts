import { fetchJson, HttpError, mapPool, num } from "./http";
import type { CCItem } from "./types";

const API = "https://api.collectorcrypt.com";

function authHeaders(): Record<string, string> {
  const key = process.env.COLLECTORCRYPT_API_KEY;
  return key ? { authorization: `Bearer ${key}` } : {};
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function toCCItem(r: any): CCItem {
  return {
    id: String(r.id ?? r.nftAddress),
    nftAddress: r.nftAddress,
    itemName: r.itemName ?? "Unknown item",
    type: r.type ?? null,
    category: r.category ?? null,
    year: num(r.year),
    gradingCompany: r.gradingCompany ?? null,
    gradingID: r.gradingID ? String(r.gradingID) : null,
    grade: r.grade ?? null,
    gradeNum: num(r.gradeNum),
    insuredValue: num(r.insuredValue),
    listedPriceUsd: num(r.listedPriceUsd ?? r.listing?.price),
    set: r.set ?? null,
    productCode: r.productCode ?? null,
    format: r.format ?? null,
    packCount: num(r.packCount),
    language: r.language ?? null,
    image: r.images?.frontM ?? r.images?.frontS ?? r.images?.front ?? r.frontImage ?? null,
  };
}

/** Catalogue record for one mint. Returns null when CollectorCrypt doesn't know the mint. */
export async function getItem(mint: string): Promise<CCItem | null> {
  try {
    const r = await fetchJson(`${API}/cards/publicNft/${encodeURIComponent(mint)}`, {
      headers: authHeaders(),
      revalidate: 600,
    });
    return toCCItem(r);
  } catch (e) {
    if (e instanceof HttpError && (e.status === 404 || e.status === 400)) return null;
    throw e;
  }
}

export async function getItems(mints: string[]): Promise<CCItem[]> {
  const rows = await mapPool(mints, 8, (m) => getItem(m).catch(() => null));
  return rows.filter((r): r is CCItem => r !== null);
}

/**
 * Items the wallet has listed on the CollectorCrypt marketplace. The browse endpoint only
 * returns listed items, so this is a partial view used when no Solana RPC is configured.
 */
export async function getListedByOwner(wallet: string): Promise<CCItem[]> {
  const out: CCItem[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < 20; page++) {
    const qs = new URLSearchParams({ ownerAddress: wallet, step: "1000" });
    if (cursor) qs.set("cursor", cursor);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = await fetchJson<any>(`${API}/marketplace?${qs}`, { headers: authHeaders() });
    for (const row of r.filterNFtCard ?? []) out.push(toCCItem(row));
    cursor = r.nextCursor;
    if (!cursor || !(r.filterNFtCard ?? []).length) break;
  }
  return out;
}
