/**
 * Live check of every upstream source. Usage:
 *   npm run probe -- [walletAddress] [certNumber]
 * Prints what each source returns so field-shape changes are caught early.
 */
import { gql, lookupCert, getAltValue, getSales } from "../lib/alt";
import { getItem } from "../lib/collectorcrypt";
import { getGroups, getHistory } from "../lib/sealed";
import { buildPortfolio } from "../lib/portfolio";

const [wallet, cert] = process.argv.slice(2);

async function step(name: string, fn: () => Promise<unknown>) {
  try {
    const out = await fn();
    console.log(`OK   ${name}:`, JSON.stringify(out, null, 0).slice(0, 600));
  } catch (e) {
    console.log(`FAIL ${name}:`, (e as Error).message);
  }
}

async function main() {
await step("CollectorCrypt item", () => getItem("HzFpAM9FNPP5JF8tckLbcuQEv2m2ZTexx2C3GSBatUn9"));
await step("tcgcsv groups", async () => (await getGroups(3)).filter((g) => g.name.startsWith("ME01")));
await step("TCGplayer history", async () => (await getHistory(644298)).slice(-3));
await step("alt.xyz schema: Query.cert", () =>
  gql("IntrospectQuery", `query IntrospectQuery { __type(name: "Query") { fields { name args { name type { name kind ofType { name } } } } } }`, {}).then(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (d: any) => d.__type.fields.filter((f: any) => /cert|asset/i.test(f.name)),
  ),
);
await step("alt.xyz schema: Asset alt value fields", () =>
  gql("IntrospectAsset", `query IntrospectAsset { __type(name: "Asset") { fields { name args { name } } } }`, {}).then(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (d: any) => d.__type.fields.filter((f: any) => /value|price/i.test(f.name)),
  ),
);
if (cert) {
  await step(`alt.xyz cert ${cert}`, async () => {
    const c = await lookupCert(cert);
    if (!c) return null;
    return { c, altValue: await getAltValue(c.assetId, c.gradingCompany, c.gradeNumber), sales: (await getSales(c.assetId, c.gradingCompany, c.gradeNumber)).slice(-3) };
  });
}
if (wallet) {
  await step(`portfolio ${wallet}`, async () => {
    const p = await buildPortfolio(wallet);
    return { warnings: p.warnings, items: p.items.map((i) => [i.itemName, i.source, i.insuredValue, i.marketValue, i.matchedName, i.note]) };
  });
}
}

void main();
