import { DAY, PERIODS, earliestPoint } from "@/lib/pnl";
import type { ValueSource, ValuedItem } from "@/lib/types";

export type Kind = "graded" | "sealed" | "other";
export type PeriodKey = (typeof PERIODS)[number]["key"] | "ALL" | "custom";
export type SortKey = "market" | "pctChange" | "change" | "vsInsured" | "insured" | "name";
export interface Sort {
  key: SortKey;
  dir: 1 | -1;
}

export function kindOf(it: ValuedItem): Kind {
  if ((it.type ?? "").toLowerCase() === "sealed") return "sealed";
  if (it.gradingID || it.gradingCompany) return "graded";
  return "other";
}

export const KIND_LABEL: Record<Kind, string> = { graded: "Graded", sealed: "Sealed", other: "Other" };

export const SOURCE: Record<ValueSource, { short: string; long: string; cls: string }> = {
  alt: { short: "Alt", long: "alt.xyz Alt Value", cls: "src-alt" },
  "alt-sales": { short: "Alt sales", long: "alt.xyz recent sales", cls: "src-alt" },
  tcgplayer: { short: "TCG", long: "TCGplayer market price", cls: "src-tcg" },
  insured: { short: "Insured", long: "Collector Crypt insured value", cls: "src-ins" },
};

export const SORT_LABEL: Record<SortKey, string> = {
  market: "Market value",
  pctChange: "Change %",
  change: "Change $",
  vsInsured: "Vs insured",
  insured: "Insured value",
  name: "Name",
};

export const PERIOD_TABS: { key: PeriodKey; label: string }[] = [
  ...PERIODS.map((p) => ({ key: p.key as PeriodKey, label: p.label })),
  { key: "ALL", label: "ALL" },
];

const PHRASE: Record<string, string> = {
  "1D": "past day",
  "7D": "past week",
  "30D": "past month",
  "90D": "past 3 months",
  "180D": "past 6 months",
  "365D": "past year",
  ALL: "all time",
};

export function periodPhrase(key: PeriodKey, from: number) {
  return PHRASE[key] ?? `since ${new Date(from).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
}

export function periodStart(key: PeriodKey, customFrom: string, now: number, items: ValuedItem[]) {
  if (key === "custom" && customFrom) return Date.parse(`${customFrom}T00:00:00`);
  if (key === "ALL") return Math.min(earliestPoint(items) ?? now - 365 * DAY, now - DAY);
  const p = PERIODS.find((x) => x.key === key) ?? PERIODS[2];
  return now - p.days * DAY;
}

/** Collector Crypt category names, tidied for display. */
export function categoryLabel(c: string | null) {
  if (!c) return "Other";
  if (c.toLowerCase().includes("pok")) return "Pokémon";
  return c;
}

/** The grade as printed: CGC's "6.0" stays "6.0"; PSA's "GEM MT 10" becomes 10. */
export function gradeText(it: ValuedItem) {
  if (/^\d+(\.\d+)?$/.test(it.grade ?? "")) return it.grade!;
  return it.gradeNum !== null ? String(it.gradeNum) : (it.grade ?? "");
}

export function metaLine(it: ValuedItem) {
  const k = kindOf(it);
  if (k === "graded") return [`${it.gradingCompany ?? ""} ${gradeText(it)}`.trim(), it.year].filter(Boolean).join(" · ");
  if (k === "sealed")
    return ["Sealed", it.format, it.packCount ? `${it.packCount} packs` : null].filter(Boolean).join(" · ");
  return [categoryLabel(it.category), it.year].filter(Boolean).join(" · ");
}

export const short = (s: string, a = 4, b = 4) => (s.length > a + b + 1 ? `${s.slice(0, a)}…${s.slice(-b)}` : s);

export const isSolanaAddress = (s: string) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s);

export function ago(t: number, now: number) {
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hr ago`;
  return new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export const ccItemUrl = (mint: string) => `https://collectorcrypt.com/assets/solana/${mint}`;
export const solscanUrl = (addr: string) => `https://solscan.io/account/${addr}`;
