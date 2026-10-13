import type { PricePoint, ValuedItem } from "./types";

export const DAY = 86_400_000;

export const PERIODS = [
  { key: "1D", label: "1D", days: 1 },
  { key: "7D", label: "1W", days: 7 },
  { key: "30D", label: "1M", days: 30 },
  { key: "90D", label: "3M", days: 90 },
  { key: "180D", label: "6M", days: 180 },
  { key: "365D", label: "1Y", days: 365 },
] as const;

/** Value of a series at time t: the last point at or before t, or null if t predates it. */
export function valueAt(history: PricePoint[], t: number): number | null {
  let v: number | null = null;
  for (const p of history) {
    if (p.t <= t) v = p.v;
    else break;
  }
  return v;
}

export interface ItemChange {
  start: number | null;
  end: number | null;
  change: number | null;
  pct: number | null;
  /** True when the item's history doesn't reach back to the period start. */
  partial: boolean;
}

export function itemChange(item: ValuedItem, from: number): ItemChange {
  const end = item.marketValue;
  if (end === null) return { start: null, end: null, change: null, pct: null, partial: true };
  if (!item.history.length) return { start: end, end, change: 0, pct: 0, partial: true };
  let start = valueAt(item.history, from);
  let partial = false;
  if (start === null) {
    start = item.history[0].v;
    partial = true;
  }
  const change = end - start;
  return { start, end, change, pct: start ? change / start : null, partial };
}

export interface PortfolioChange {
  start: number;
  end: number;
  change: number;
  pct: number | null;
  partialCount: number;
}

export function portfolioChange(items: ValuedItem[], from: number): PortfolioChange {
  let start = 0;
  let end = 0;
  let partialCount = 0;
  for (const it of items) {
    const c = itemChange(it, from);
    if (c.end === null || c.start === null) continue;
    start += c.start;
    end += c.end;
    if (c.partial && it.history.length) partialCount++;
  }
  const change = end - start;
  return { start, end, change, pct: start ? change / start : null, partialCount };
}

/** Daily total portfolio value from `from` to `to`, valuing each item from its own series. */
export function portfolioSeries(items: ValuedItem[], from: number, to: number): PricePoint[] {
  // Daily for short periods; weekly beyond four months, where sources only report weekly prices anyway.
  const span = to - from;
  const step = span > 800 * DAY ? 14 * DAY : span > 120 * DAY ? 7 * DAY : DAY;
  const out: PricePoint[] = [];
  for (let t = from; t <= to + 1; t += step) {
    let v = 0;
    for (const it of items) {
      if (it.marketValue === null) continue;
      if (!it.history.length) v += it.marketValue;
      else v += valueAt(it.history, t) ?? it.history[0].v;
    }
    out.push({ t, v });
  }
  // Last point is today's live value.
  out.push({ t: to, v: items.reduce((s, it) => s + (it.marketValue ?? 0), 0) });
  return out;
}

/** One item's value from `from` to `to`, starting at its value on `from` (or its first known price). */
export function itemSeries(item: ValuedItem, from: number, to: number): PricePoint[] {
  if (item.marketValue === null || !item.history.length) return [];
  const start = valueAt(item.history, from) ?? item.history[0].v;
  const mid = item.history.filter((p) => p.t > from && p.t < to);
  return [{ t: from, v: start }, ...mid, { t: to, v: item.marketValue }];
}

/** Timestamp of the oldest price point across the items, or null when none has history. */
export function earliestPoint(items: ValuedItem[]): number | null {
  let t: number | null = null;
  for (const it of items) if (it.history.length && (t === null || it.history[0].t < t)) t = it.history[0].t;
  return t;
}
