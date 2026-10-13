import { test } from "node:test";
import assert from "node:assert/strict";
import { categoryIds, matchGroup, matchProduct } from "../lib/sealed";

// Real rows from tcgcsv.com (Pokemon, 2026-10-13).
const groups = [
  { groupId: 24451, name: "ME: Mega Evolution Promo", abbreviation: "MEP" },
  { groupId: 24380, name: "ME01: Mega Evolution", abbreviation: "MEG" },
  { groupId: 24461, name: "MEE: Mega Evolution Energies", abbreviation: "MEE" },
  { groupId: 24831, name: "ME06: Delta Reign", abbreviation: "DLR" },
];
const p = (productId: number, name: string) => ({ productId, name, url: `https://www.tcgplayer.com/product/${productId}`, groupId: 24380 });
const products = [
  p(644279, "Mega Evolution Elite Trainer Box [Mega Gardevoir]"),
  p(644282, "Mega Evolution Pokemon Center Elite Trainer Box (Exclusive) [Mega Lucario]"),
  p(644298, "Mega Evolution Booster Box"),
  p(644300, "Mega Evolution Enhanced Booster Box"),
  p(644351, "Mega Evolution Half Booster Box"),
  p(644352, "Mega Evolution Booster Pack"),
  p(644354, "Mega Evolution Sleeved Booster Pack"),
  p(644356, "Mega Evolution 3 Pack Blister [Golduck]"),
  p(644358, "Mega Evolution Single Pack Blister [Drifloon]"),
  p(644362, "Mega Evolution Booster Bundle"),
  p(644363, "Mega Evolution Build & Battle Box"),
  p(644727, "Mega Evolution Elite Trainer Box Case"),
  p(644730, "Mega Evolution Booster Bundle Case"),
  p(644731, "Mega Evolution Booster Box Case"),
];

// Real CollectorCrypt record (api.collectorcrypt.com/cards/publicNft/HzFp...).
const box = { itemName: "ME01 Mega Evolution Booster Box", productCode: "ME01", set: "ME", format: "Box", packCount: 36 };

test("set code maps to the TCGplayer group", () => {
  assert.equal(matchGroup(box, groups)?.groupId, 24380);
});

test("booster box matches the plain booster box, not the case/half/enhanced", () => {
  assert.equal(matchProduct(box, products)?.productId, 644298);
});

test("other sealed formats", () => {
  const m = (itemName: string, format: string | null = null, packCount: number | null = null) =>
    matchProduct({ itemName, productCode: "ME01", format, packCount }, products)?.productId;
  assert.equal(m("ME01 Mega Evolution Booster Box Case", "Case"), 644731);
  assert.equal(m("ME01 Mega Evolution Booster Bundle", "Bundle", 6), 644362);
  assert.equal(m("ME01 Mega Evolution Elite Trainer Box [Mega Gardevoir]", "Box", 9), 644279);
  assert.equal(m("ME01 Mega Evolution 3 Pack Blister Golduck", "Blister", 3), 644356);
  assert.equal(m("ME01 Mega Evolution Booster Pack", "Pack", 1), 644352);
});

test("set name fallback when there is no product code", () => {
  assert.equal(matchGroup({ itemName: "Delta Reign Booster Box", productCode: null, set: null }, groups)?.groupId, 24831);
});

test("category routing", () => {
  assert.deepEqual(categoryIds("Pokemon", "English"), [3, 85]);
  assert.deepEqual(categoryIds("Pokemon", "Japanese"), [85, 3]);
  assert.deepEqual(categoryIds("One Piece", null), [68]);
});
