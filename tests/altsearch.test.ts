import { test } from "node:test";
import assert from "node:assert/strict";
import { pickAsset, searchText, shortSearchText } from "../lib/alt";

// Real Collector Crypt item names (2026-10-13).
const JOLTEON = "2002 Pokemon Neo Destiny Light Jolteon #48 CGC 9 MINT";
const SHAYMIN = "2017 #77a Full Art/Shaymin EX PSA 8 Premium Trainer XY Collection Promo";

test("search text drops the slab but keeps the card", () => {
  assert.equal(searchText(JOLTEON), "2002 Pokemon Neo Destiny Light Jolteon 48");
  assert.equal(searchText(SHAYMIN), "2017 77a Full Art/Shaymin EX Premium Trainer XY Collection Promo");
  assert.equal(searchText("2025 #081 Team Rocket's Mewtwo EX PSA 10 Dri EN-Destined Rivals Pokemon"), "2025 081 Team Rocket's Mewtwo EX Dri EN-Destined Rivals Pokemon");
  assert.equal(searchText("2024 #FB01139 Son Goku FOIL SCR BGS 10 Dragon Ball Super"), "2024 FB01139 Son Goku FOIL SCR Dragon Ball Super");
});

test("short search text is the card's own name and number", () => {
  assert.equal(shortSearchText(JOLTEON), "Light Jolteon 48");
  assert.equal(shortSearchText("2025 Pokemon Destined Rivals Team Rocket's Mewtwo ex #231 CGC 10"), "Mewtwo ex 231");
  assert.equal(shortSearchText("2012 #186 Jolteon PSA 9 Japanese Black & White Promo Pokemon"), null);
});

test("picks the same card, not the 1st edition, a foreign print or a different number", () => {
  const hits = [
    // alt.xyz's real name for the German print, which the first live check wrongly picked.
    { id: "german", name: "2002 Pokemon Neo Destiny German Light Jolteon #48", year: 2002 },
    { id: "first-ed", name: "2002 Pokemon Neo Destiny 1st Edition Light Jolteon #48", year: 2002, cardNumber: "48" },
    { id: "holo", name: "2002 Pokemon Neo Destiny Light Jolteon #12", year: 2002, cardNumber: "12" },
    { id: "right", name: "2002 Pokemon Neo Destiny Light Jolteon #48", year: 2002, cardNumber: "48/105" },
  ];
  assert.equal(pickAsset(JOLTEON, hits)?.id, "right");
  assert.equal(pickAsset(JOLTEON, hits.slice(0, 3)), null);
});

test("rejects weak or mismatched hits", () => {
  assert.equal(pickAsset(JOLTEON, [{ id: "x", name: "2002 Pokemon Neo Destiny Dark Espeon #4", year: 2002, cardNumber: "4" }]), null);
  assert.equal(pickAsset(JOLTEON, [{ id: "x", name: "2021 Pokemon Light Jolteon #48", year: 2021, cardNumber: "48" }]), null);
  assert.equal(pickAsset(JOLTEON, [{ id: "x", name: "2002 Pokemon Neo Destiny Japanese Light Jolteon #48", year: 2002 }]), null);
  assert.equal(pickAsset(JOLTEON, []), null);
});

test("ties go to the asset with more recorded sales", () => {
  const hits = [
    { id: "quiet", name: "Light Jolteon", externalTransactionCount: 3 },
    { id: "busy", name: "Light Jolteon", externalTransactionCount: 40 },
  ];
  assert.equal(pickAsset(JOLTEON, hits)?.id, "busy");
});
