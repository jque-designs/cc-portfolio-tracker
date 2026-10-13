import { getAltValue, getSales, historyFromSales, lookupCert, normaliseCompany, normaliseGrade, researchUrl, valueFromSales } from "./alt";
import { getItems, getListedByOwner } from "./collectorcrypt";
import { mapPool } from "./http";
import { categoryIds, getGroups, getHistory, getMarketPrices, getProducts, matchGroup, matchProduct } from "./sealed";
import { getCollectorCryptMints, rpcUrl } from "./solana";
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
  const cert = await lookupCert(item.gradingID);
  if (!cert) return insuredOnly(item, "Cert not found on alt.xyz");
  const company = cert.gradingCompany || normaliseCompany(item.gradingCompany);
  const grade = cert.gradeNumber || normaliseGrade(item.gradeNum ?? item.grade) || "";
  const [altValue, sales] = await Promise.all([
    getAltValue(cert.assetId, company, grade),
    getSales(cert.assetId, company, grade).catch(() => []),
  ]);
  const history = historyFromSales(sales);
  const fromSales = valueFromSales(sales, Date.now());
  const marketValue = altValue ?? fromSales;
  if (marketValue === null) return insuredOnly(item, "No alt.xyz value or sales for this grade");
  if (altValue !== null) history.push({ t: Date.now(), v: altValue });
  return {
    ...item,
    marketValue,
    source: altValue !== null ? "alt" : "alt-sales",
    sourceUrl: researchUrl(cert.assetId),
    matchedName: `${cert.assetName} · ${company} ${grade}`,
    history,
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

export async function buildPortfolio(wallet: string): Promise<Portfolio> {
  const warnings: string[] = [];
  let items: CCItem[];
  if (rpcUrl()) {
    const mints = await getCollectorCryptMints(wallet);
    items = await getItems(mints);
  } else {
    warnings.push(
      "No Solana RPC is configured, so only items listed on the CollectorCrypt marketplace are shown. Set HELIUS_API_KEY to see the whole wallet.",
    );
    items = await getListedByOwner(wallet);
  }
  const valued = await mapPool(items, 6, valueItem);
  return { wallet, fetchedAt: Date.now(), items: valued, warnings };
}
