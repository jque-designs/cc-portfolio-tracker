import { test } from "node:test";
import assert from "node:assert/strict";
import { compare, isDeal } from "../lib/dealMath";

const DAY = 86_400_000;
const now = Date.UTC(2026, 10, 2);
const sales = [
  { t: now - 90 * DAY, price: 300 },
  { t: now - 30 * DAY, price: 100 },
  { t: now - 20 * DAY, price: 120 },
  { t: now - 5 * DAY, price: 110 },
];

test("compare uses the newest sale and the mean of the last three", () => {
  const c = compare(99, sales, now);
  assert.equal(c.lastSale?.price, 110);
  assert.equal(c.avg3, 110);
  assert.equal(c.avgOf, 3);
  assert.equal(c.recent.length, 4);
  assert.ok(Math.abs(c.vsLast! - -0.1) < 1e-9);
  assert.equal(c.stale, false);
});

test("compare with few or old sales", () => {
  const one = compare(50, [{ t: now - 400 * DAY, price: 100 }], now);
  assert.equal(one.avgOf, 1);
  assert.equal(one.avg3, 100);
  assert.equal(one.stale, true);
  const none = compare(50, [], now);
  assert.equal(none.lastSale, null);
  assert.equal(none.vsAvg3, null);
});

test("isDeal rules and minimum discount", () => {
  const d = { basis: "sales" as const, vsLast: -0.05, vsAvg3: 0.1 };
  assert.equal(isDeal(d, "last"), true);
  assert.equal(isDeal(d, "avg3"), false);
  assert.equal(isDeal(d, "either"), true);
  assert.equal(isDeal(d, "both"), false);
  assert.equal(isDeal(d, "last", 0.1), false);
  assert.equal(isDeal({ basis: "none", vsLast: null, vsAvg3: null }, "either"), false);
  // Sealed has one market number, whatever the rule.
  assert.equal(isDeal({ basis: "tcgplayer", vsLast: -0.2, vsAvg3: null }, "avg3"), true);
});
