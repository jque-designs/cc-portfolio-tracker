import { findAssetByName, getAltValue, getSales, historyFromSales, lookupCert, normaliseCompany, normaliseGrade, researchUrl, valueFromSales } from "./alt";
import { getItems, getOwnerRecords } from "./collectorcrypt";
import { mapPool } from "./http";
import { categoryIds, getGroups, getHistory, getMarketPrices, getProducts, matchGroup, matchProduct } from "./sealed";
import { type WalletScan, rpcUrl, scanWallet } from "./solana";
import type { CCItem, Portfolio, ValuedItem } from "./types";

function insuredOnly(item: CCItem, note?: string): ValuedItem {
  return {
    ...item,
    marketValue: item.insuredValue,
    source: "insured",
    sourceUrl: null,
    matchedName: null,
    history: [],
    note,
  };
}

export async function valueGraded(item: CCItem): Promise<ValuedItem> {
  if (!item.gradingID || !item.gradingCompany) return insuredOnly(item, "Not graded");
  // alt.xyz is trading cards only, and a name search would happily match a comic to a card.
  if ((item.type ?? "").toLowerCase() === "comic") return insuredOnly(item, "No market source for graded comics yet");
  const cert = await lookupCert(item.gradingID);
  let assetId: string;
  let assetName: string;
  let company: string;
  let grade: string;
  let note: string | undefined;
  if (cert) {
    ({ assetId, assetName } = cert);
    company = cert.gradingCompany || normaliseCompany(item.gradingCompany);
    grade = cert.gradeNumber || normaliseGrade(item.gradeNum ?? item.grade) || "";
  } else {
    // alt.xyz doesn't know many CGC certs, so find the card by name and use the slab's own grade.
    const { hit, nearest } = await findAssetByName(item.itemName);
    grade = normaliseGrade(item.gradeNum ?? item.grade) ?? "";
    if (!hit || !grade) {
      const closest = nearest.length ? ` Closest alt.xyz cards: ${nearest.join("; ")}.` : "";
      return insuredOnly(item, `Not found on alt.xyz by cert number or card name.${closest}`);
    }
    assetId = hit.id;
    assetName = hit.name ?? item.itemName;
    company = normaliseCompany(item.gradingCompany);
    note = "alt.xyz doesn't know this cert number, so the card was matched by name.";
  }
  const [altValue, sales] = await Promise.all([
    getAltValue(assetId, company, grade),
    getSales(assetId, company, grade).catch(() => []),
  ]);
  const history = historyFromSales(sales);
  const fromSales = valueFromSales(sales, Date.now());
  const marketValue = altValue ?? fromSales;
  if (marketValue === null) return insuredOnly(item, `No alt.xyz value or sales for ${company} ${grade}`);
  if (altValue !== null) history.push({ t: Date.now(), v: altValue });
  return {
    ...item,
    marketValue,
    source: altValue !== null ? "alt" : "alt-sales",
    sourceUrl: researchUrl(assetId),
    matchedName: `${assetName} · ${company} ${grade}`,
    history,
    note,
  };
}

export async function valueSealed(item: CCItem): Promise<ValuedItem> {
  for (const cat of categoryIds(item.category, item.language)) {
    const group = matchGroup(item, await getGroups(cat));
    if (!group) continue;
    const product = matchProduct(item, await getProducts(cat, group.groupId));
    if (!product) continue;
    const [prices, history] = await Promise.all([
      getMarketPrices(cat, group.groupId),
      getHistory(product.productId).catch(() => []),
    ]);
    const marketValue = prices.get(product.productId) ?? history.at(-1)?.v ?? null;
    if (marketValue === null) continue;
    return {
      ...item,
      marketValue,
      source: "tcgplayer",
      sourceUrl: product.url,
      matchedName: `${group.name} · ${product.name}`,
      history,
    };
  }
  return insuredOnly(item, "No TCGplayer match found");
}

export async function valueItem(item: CCItem): Promise<ValuedItem> {
  try {
    if ((item.type ?? "").toLowerCase() === "sealed") return await valueSealed(item);
    if (item.gradingID) return await valueGraded(item);
    return insuredOnly(item, "No market source for this item type yet");
  } catch (e) {
    return insuredOnly(item, `Market lookup failed: ${(e as Error).message.slice(0, 120)}`);
  }
}

/**
 * The wallet's CollectorCrypt items. The on-chain scan decides what the wallet holds.
 * CollectorCrypt's records fill in items the scan's filter doesn't recognise (a new mint
 * format, as happened with Core assets), but only when the wallet really holds them.
 */
export async function mergeHoldings(
  scan: WalletScan,
  records: CCItem[],
  lookup: (mints: string[]) => Promise<CCItem[]>,
): Promise<{ items: CCItem[]; recordsOnly: number }> {
  const known = new Map(records.filter((r) => scan.held.has(r.nftAddress)).map((r) => [r.nftAddress, r]));
  const looked = await lookup([...new Set(scan.matched)].filter((m) => !known.has(m)));
  const matched = new Set(scan.matched);
  const recordsOnly = [...known.keys()].filter((m) => !matched.has(m)).length;
  return { items: [...known.values(), ...looked], recordsOnly };
}

export async function buildPortfolio(wallet: string): Promise<Portfolio> {
  const warnings: string[] = [];
  let items: CCItem[];
  if (rpcUrl()) {
    const [scan, records] = await Promise.all([
      scanWallet(wallet),
      getOwnerRecords(wallet).catch((e) => {
        console.warn("CollectorCrypt owner records failed:", (e as Error).message);
        return [] as CCItem[];
      }),
    ]);
    const merged = await mergeHoldings(scan, records, getItems);
    // Worth a look in the logs: the on-chain filter is missing a kind of CollectorCrypt asset.
    if (merged.recordsOnly) console.info(`holdings: ${merged.recordsOnly} item(s) found only through CollectorCrypt's records`);
    items = merged.items;
  } else {
    warnings.push(
      "No Solana RPC is configured, so holdings come from Collector Crypt's own records, which can lag behind recent transfers. Set HELIUS_API_KEY to read the wallet on-chain.",
    );
    items = await getOwnerRecords(wallet);
  }
  const valued = await mapPool(items, 6, valueItem);
  return { wallet, fetchedAt: Date.now(), items: valued, warnings };
}
