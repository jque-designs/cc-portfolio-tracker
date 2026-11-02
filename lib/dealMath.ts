import type { Sale } from "./alt";
import type { CCItem } from "./types";

/** The deal engine's pure parts, shared by the server scan and the browser page. */

const DAY = 86_400_000;
/** A last sale older than this is shown, but flagged as a weak comp. */
export const STALE_DAYS = 180;

export type DealBasis = "sales" | "tcgplayer" | "none";

export interface Deal {
  item: CCItem;
  price: number;
  marketplace: string | null;
  listedAt: number | null;
  basis: DealBasis;
  /** Most recent comparable sale. For sealed, TCGplayer's market price stands in for it. */
  lastSale: Sale | null;
  /** Mean of the last three sales (or of however many there are, see `avgOf`). */
  avg3: number | null;
  avgOf: number;
  /** Up to five most recent sales, newest first. */
  recent: Sale[];
  /** price / lastSale - 1, so -0.2 is 20% under the last sale. */
  vsLast: number | null;
  vsAvg3: number | null;
  /** The last sale is older than STALE_DAYS. */
  stale: boolean;
  matchedName: string | null;
  compUrl: string | null;
  note?: string;
}

export interface DealPage {
  scannedAt: number;
  deals: Deal[];
  nextCursor: string | null;
  /** Listings that match the filters, across all pages. */
  matching: number | null;
}

/** Compare one asking price with a sales record (oldest first, as getSales returns it). */
export function compare(price: number, sales: Sale[], now: number) {
  const recent = [...sales].sort((a, b) => b.t - a.t).slice(0, 5);
  const last = recent[0] ?? null;
  const three = recent.slice(0, 3);
  const avg3 = three.length ? three.reduce((s, x) => s + x.price, 0) / three.length : null;
  return {
    lastSale: last,
    avg3,
    avgOf: three.length,
    recent,
    vsLast: last ? price / last.price - 1 : null,
    vsAvg3: avg3 ? price / avg3 - 1 : null,
    stale: last ? now - last.t > STALE_DAYS * DAY : false,
  };
}

export type DealRule = "avg3" | "last" | "both" | "either";

/** Is this listing under its comps by at least `minDiscount` (0.1 = 10%)? */
export function isDeal(d: Pick<Deal, "vsLast" | "vsAvg3" | "basis">, rule: DealRule, minDiscount = 0): boolean {
  const under = (v: number | null) => v !== null && v <= -minDiscount && v < 0;
  if (d.basis === "tcgplayer") return under(d.vsLast);
  switch (rule) {
    case "avg3":
      return under(d.vsAvg3);
    case "last":
      return under(d.vsLast);
    case "both":
      return under(d.vsAvg3) && under(d.vsLast);
    case "either":
      return under(d.vsAvg3) || under(d.vsLast);
  }
}

export const ORDERS = ["listedDateDesc", "listedPriceAsc", "listedPriceDesc"] as const;
export type Order = (typeof ORDERS)[number];

