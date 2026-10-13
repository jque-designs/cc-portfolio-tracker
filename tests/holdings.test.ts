import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeHoldings } from "../lib/portfolio";
import { type DasAsset, isCollectorCryptAsset } from "../lib/solana";
import type { CCItem } from "../lib/types";

const CORE_AUTHORITY = "CCryptUfeFSZ3Fgc9FLeKrhLVAP67FSqi1GuVoj9CRac";

test("legacy pNFTs are matched by their COLLECTOR symbol", () => {
  assert.equal(isCollectorCryptAsset({ id: "a", content: { json_uri: "https://arweave.net/x", metadata: { symbol: "COLLECTOR" } } }), true);
  assert.equal(isCollectorCryptAsset({ id: "a", content: { json_uri: "https://nft.collectorcrypt.com/metadata/a" } }), true);
});

test("Core assets with no symbol are matched by CollectorCrypt's authority or collection", () => {
  // The shape of the Dragon Ball cards that went missing: Core, no symbol, Arweave metadata.
  const core: DasAsset = {
    id: "b",
    content: { json_uri: "https://arweave.net/XdQY", metadata: { name: "SSB Vegeta PSA 10", symbol: "" } },
    authorities: [{ address: CORE_AUTHORITY }],
    grouping: [],
  };
  assert.equal(isCollectorCryptAsset(core), true);
  assert.equal(isCollectorCryptAsset({ ...core, authorities: [], grouping: [{ group_key: "collection", group_value: CORE_AUTHORITY }] }), true);
});

test("other NFTs and burnt assets are left out", () => {
  assert.equal(isCollectorCryptAsset({ id: "c", content: { json_uri: "https://arweave.net/y", metadata: { symbol: "MADLAD" } }, authorities: [{ address: "Other111" }] }), false);
  assert.equal(isCollectorCryptAsset({ id: "d", burnt: true, content: { metadata: { symbol: "COLLECTOR" } } }), false);
});

const cc = (nftAddress: string): CCItem => ({
  id: nftAddress, nftAddress, itemName: nftAddress, type: "Card", category: null, year: null,
  gradingCompany: null, gradingID: null, grade: null, gradeNum: null, insuredValue: 10, listedPriceUsd: null,
  set: null, productCode: null, format: null, packCount: null, language: null, image: null,
});

test("CollectorCrypt's records fill gaps, but only for items the wallet holds on-chain", async () => {
  const asked: string[][] = [];
  const lookup = async (mints: string[]) => {
    asked.push(mints);
    return mints.map(cc);
  };
  const scan = { held: new Set(["matched", "core-missed", "listed", "unrelated"]), matched: ["matched", "listed"] };
  // "sold" is still on CollectorCrypt's books but no longer in the wallet.
  const { items, recordsOnly } = await mergeHoldings(scan, [cc("core-missed"), cc("listed"), cc("sold")], lookup);
  assert.deepEqual(items.map((i) => i.nftAddress).sort(), ["core-missed", "listed", "matched"]);
  assert.deepEqual(asked, [["matched"]]); // records already cover the rest
  assert.equal(recordsOnly, 1);
});

test("without CollectorCrypt's records the on-chain matches still come through", async () => {
  const scan = { held: new Set(["a", "b"]), matched: ["a", "b", "a"] };
  const { items, recordsOnly } = await mergeHoldings(scan, [], async (m) => m.map(cc));
  assert.deepEqual(items.map((i) => i.nftAddress), ["a", "b"]);
  assert.equal(recordsOnly, 0);
});
