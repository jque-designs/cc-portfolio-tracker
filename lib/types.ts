/** A point in a price series. `t` is a unix ms timestamp, `v` a USD value. */
export interface PricePoint {
  t: number;
  v: number;
}

/** The subset of CollectorCrypt's `/cards/publicNft/:id` record this app uses. */
export interface CCItem {
  id: string;
  nftAddress: string;
  itemName: string;
  type: string | null; // "Sealed", "Card", "Comic", ...
  category: string | null; // "Pokemon", "One Piece", ...
  year: number | null;
  gradingCompany: string | null;
  gradingID: string | null;
  grade: string | null;
  gradeNum: number | null;
  insuredValue: number | null;
  listedPriceUsd: number | null;
  set: string | null;
  productCode: string | null;
  format: string | null;
  packCount: number | null;
  language: string | null;
  image: string | null;
}

export type ValueSource = "alt" | "alt-sales" | "tcgplayer" | "insured";

export interface ValuedItem extends CCItem {
  /** Current market value in USD (falls back to insured value). */
  marketValue: number | null;
  source: ValueSource;
  /** Where to see the market price. */
  sourceUrl: string | null;
  /** Name of the matched market product/asset, so a wrong match is easy to spot. */
  matchedName: string | null;
  /** Price history, oldest first. Empty when the source has none. */
  history: PricePoint[];
  note?: string;
}

export interface Portfolio {
  wallet: string;
  fetchedAt: number;
  items: ValuedItem[];
  warnings: string[];
}
