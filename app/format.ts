export const usd = (v: number | null | undefined, digits = 2) =>
  v === null || v === undefined
    ? "—"
    : v.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: digits, maximumFractionDigits: digits });

export const signedUsd = (v: number | null | undefined) => (v === null || v === undefined ? "—" : `${v >= 0 ? "+" : "−"}${usd(Math.abs(v))}`);

export const pct = (v: number | null | undefined) =>
  v === null || v === undefined || !Number.isFinite(v) ? "—" : `${v >= 0 ? "+" : "−"}${Math.abs(v * 100).toFixed(1)}%`;

export const tone = (v: number | null | undefined) => (!v ? "" : v > 0 ? "up" : "down");

/** "$4,136.19" split into "$4,136" and ".19" so the cents can be set smaller. */
export function splitUsd(v: number) {
  const s = usd(v);
  const i = s.lastIndexOf(".");
  return i < 0 ? { whole: s, cents: "" } : { whole: s.slice(0, i), cents: s.slice(i) };
}

/** Axis-friendly money: $950, $4.2k, $1.3M. */
export function compactUsd(v: number) {
  const a = Math.abs(v);
  const sign = v < 0 ? "−" : "";
  if (a >= 1e6) return `${sign}$${(a / 1e6).toFixed(a >= 1e7 ? 0 : 1)}M`;
  if (a >= 1e4) return `${sign}$${(a / 1e3).toFixed(0)}k`;
  if (a >= 1e3) return `${sign}$${(a / 1e3).toFixed(1)}k`;
  return `${sign}$${a.toFixed(0)}`;
}
