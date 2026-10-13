import { test } from "node:test";
import assert from "node:assert/strict";
import { DAY, itemChange, portfolioChange, valueAt } from "../lib/pnl";
import { historyFromSales, valueFromSales } from "../lib/alt";
import type { ValuedItem } from "../lib/types";

const now = Date.UTC(2026, 9, 13);
const item = (marketValue: number, history: { t: number; v: number }[], insuredValue = 100): ValuedItem => ({
  id: "x", nftAddress: String(Math.random()), itemName: "x", type: null, category: null, year: null,
  gradingCompany: null, gradingID: null, grade: null, gradeNum: null, insuredValue, listedPriceUsd: null,
  set: null, productCode: null, format: null, packCount: null, language: null, image: null,
  marketValue, source: "tcgplayer", sourceUrl: null, matchedName: null, history,
});

test("valueAt takes the last point at or before t", () => {
  const h = [{ t: 1, v: 10 }, { t: 5, v: 20 }];
  assert.equal(valueAt(h, 0), null);
  assert.equal(valueAt(h, 3), 10);
  assert.equal(valueAt(h, 9), 20);
});

test("item and portfolio change", () => {
  const a = item(300, [{ t: now - 40 * DAY, v: 250 }, { t: now - 10 * DAY, v: 280 }, { t: now, v: 300 }]);
  const b = item(50, []); // insured fallback: flat
  assert.deepEqual(itemChange(a, now - 30 * DAY), { start: 250, end: 300, change: 50, pct: 0.2, partial: false });
  const c = itemChange(a, now - 365 * DAY);
  assert.equal(c.partial, true);
  assert.equal(c.start, 250);
  const p = portfolioChange([a, b], now - 30 * DAY);
  assert.equal(p.start, 300);
  assert.equal(p.end, 350);
  assert.equal(p.change, 50);
});

test("sales-based value uses the median of the last three recent sales", () => {
  const sales = [
    { t: now - 300 * DAY, price: 50 },
    { t: now - 20 * DAY, price: 100 },
    { t: now - 10 * DAY, price: 140 },
    { t: now - 5 * DAY, price: 120 },
  ];
  assert.equal(valueFromSales(sales, now), 120);
  assert.equal(valueFromSales(sales, now - 200 * DAY), 50); // nothing recent: last sale
  assert.equal(valueFromSales(sales, now - 400 * DAY), null);
  assert.equal(historyFromSales(sales).length, 4);
});
