export const usd = (v: number | null | undefined, digits = 2) =>
  v === null || v === undefined
    ? "—"
    : v.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: digits, maximumFractionDigits: digits });

export const signedUsd = (v: number | null | undefined) => (v === null || v === undefined ? "—" : `${v >= 0 ? "+" : "−"}${usd(Math.abs(v))}`);

export const pct = (v: number | null | undefined) =>
  v === null || v === undefined || !Number.isFinite(v) ? "—" : `${v >= 0 ? "+" : "−"}${Math.abs(v * 100).toFixed(1)}%`;

export const tone = (v: number | null | undefined) => (!v ? "" : v > 0 ? "up" : "down");
