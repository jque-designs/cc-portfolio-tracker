import { DAY } from "./pnl";
import type { CCItem, Portfolio, PricePoint, ValuedItem } from "./types";

/**
 * A sample vault for trying the app without a wallet. Item names, images and the
 * TCGplayer matches are real catalogue entries; the prices and histories are made up.
 */

// Small seeded PRNG so the sample looks the same on every load.
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

function walk(seed: number, end: number, drift: number, vol: number, now: number): PricePoint[] {
  const r = rng(seed);
  const days = 400;
  const pts: number[] = [end];
  for (let i = 1; i < days; i++) pts.push(pts[i - 1] / (1 + drift / days + (r() - 0.5) * vol));
  return pts
    .reverse()
    .map((v, i) => ({ t: now - (days - 1 - i) * DAY, v: Math.round(v * 100) / 100 }))
    .filter((_, i) => i % (i > days - 35 ? 1 : 7) === 0 || i === days - 1);
}

const tcgImg = (id: number) => `https://tcgplayer-cdn.tcgplayer.com/product/${id}_400w.jpg`;
const tcgUrl = (id: number) => `https://www.tcgplayer.com/product/${id}`;

const base: Omit<CCItem, "id" | "nftAddress" | "itemName"> = {
  type: "Sealed",
  category: "Pokemon",
  year: 2025,
  gradingCompany: null,
  gradingID: null,
  grade: null,
  gradeNum: null,
  insuredValue: null,
  listedPriceUsd: null,
  set: null,
  productCode: null,
  format: null,
  packCount: null,
  language: "English",
  image: null,
};

export function demoPortfolio(now = Date.now()): Portfolio {
  const items: ValuedItem[] = [
    {
      ...base,
      id: "demo-1",
      nftAddress: "HzFpAM9FNPP5JF8tckLbcuQEv2m2ZTexx2C3GSBatUn9",
      itemName: "ME01 Mega Evolution Booster Box",
      productCode: "ME01",
      set: "ME",
      format: "Box",
      packCount: 36,
      insuredValue: 333,
      image: "https://d1xpxki1g4htqu.cloudfront.net/nvCEaZCOVJYAQ0ppu3rv3rWn6vypQoHZlF5SwL2eg68",
      marketValue: 303.71,
      source: "tcgplayer",
      sourceUrl: tcgUrl(644298),
      matchedName: "ME01: Mega Evolution · Mega Evolution Booster Box",
      history: walk(11, 303.71, 0.19, 0.03, now),
    },
    {
      ...base,
      id: "demo-2",
      nftAddress: "demo-charizard",
      itemName: "2023 Pokemon 151 Charizard ex #006 PSA 10",
      type: "Card",
      year: 2023,
      gradingCompany: "PSA",
      gradingID: "00000000",
      grade: "GEM MT 10",
      gradeNum: 10,
      insuredValue: 140,
      image: tcgImg(502558),
      marketValue: 162.5,
      source: "alt",
      sourceUrl: null,
      matchedName: "Charizard ex 006/165 · PSA 10.0",
      history: walk(23, 162.5, 0.31, 0.05, now),
    },
    {
      ...base,
      id: "demo-3",
      nftAddress: "demo-pe-etb",
      itemName: "Prismatic Evolutions Elite Trainer Box",
      productCode: "PRE",
      format: "Box",
      packCount: 9,
      insuredValue: 120,
      image: tcgImg(593355),
      marketValue: 138.4,
      source: "tcgplayer",
      sourceUrl: tcgUrl(593355),
      matchedName: "SV: Prismatic Evolutions · Prismatic Evolutions Elite Trainer Box",
      history: walk(37, 138.4, 0.12, 0.04, now),
    },
    {
      ...base,
      id: "demo-4",
      nftAddress: "demo-op01-box",
      itemName: "OP01 Romance Dawn Booster Box",
      category: "One Piece",
      year: 2022,
      productCode: "OP01",
      format: "Box",
      packCount: 24,
      insuredValue: 900,
      image: tcgImg(450086),
      marketValue: 846.2,
      source: "tcgplayer",
      sourceUrl: tcgUrl(450086),
      matchedName: "Romance Dawn · Romance Dawn - Booster Box (Wave 1 - Blue)",
      history: walk(41, 846.2, -0.08, 0.025, now),
    },
    {
      ...base,
      id: "demo-5",
      nftAddress: "demo-luffy",
      itemName: "2022 One Piece Romance Dawn Monkey.D.Luffy #024 Parallel PSA 10",
      category: "One Piece",
      type: "Card",
      year: 2022,
      gradingCompany: "PSA",
      gradingID: "00000001",
      grade: "GEM MT 10",
      gradeNum: 10,
      insuredValue: 210,
      image: tcgImg(453509),
      marketValue: 188,
      source: "alt-sales",
      sourceUrl: null,
      matchedName: "Monkey.D.Luffy OP01-024 (Parallel) · PSA 10.0",
      history: walk(53, 188, -0.15, 0.06, now),
    },
    {
      ...base,
      id: "demo-6",
      nftAddress: "demo-151-bundle",
      itemName: "151 Booster Bundle",
      year: 2023,
      productCode: "MEW",
      format: "Bundle",
      packCount: 6,
      insuredValue: 60,
      image: tcgImg(502000),
      marketValue: 71.35,
      source: "tcgplayer",
      sourceUrl: tcgUrl(502000),
      matchedName: "SV: Scarlet & Violet 151 · 151 Booster Bundle",
      history: walk(67, 71.35, 0.22, 0.03, now),
    },
    {
      ...base,
      id: "demo-7",
      nftAddress: "demo-blister",
      itemName: "ME01 Mega Evolution 3 Pack Blister [Golduck]",
      productCode: "ME01",
      format: "Blister",
      packCount: 3,
      insuredValue: 28,
      image: tcgImg(644356),
      marketValue: 26.1,
      source: "tcgplayer",
      sourceUrl: tcgUrl(644356),
      matchedName: "ME01: Mega Evolution · Mega Evolution 3 Pack Blister [Golduck]",
      history: walk(71, 26.1, 0.04, 0.035, now),
    },
    {
      ...base,
      id: "demo-8",
      nftAddress: "demo-comic",
      itemName: "1984 Teenage Mutant Ninja Turtles #1 CGC 6.0",
      category: "Comics",
      type: "Comic",
      year: 1984,
      gradingCompany: "CGC",
      grade: "6.0",
      gradeNum: 6,
      insuredValue: 2400,
      marketValue: 2400,
      source: "insured",
      sourceUrl: null,
      matchedName: null,
      history: [],
      note: "No market source for comics yet",
    },
  ];
  return { wallet: "SampLeVau1t1111111111111111111111111111111", fetchedAt: now, items, warnings: [] };
}
