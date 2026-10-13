"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DAY, PERIODS, itemChange, portfolioChange, portfolioSeries } from "@/lib/pnl";
import type { Portfolio, ValuedItem } from "@/lib/types";
import { ThemeToggle } from "./ThemeToggle";
import { ValueChart } from "./ValueChart";
import { pct, signedUsd, tone, usd } from "./format";

type Kind = "all" | "graded" | "sealed" | "other";
type SortKey = "name" | "insured" | "market" | "change" | "pctChange" | "vsInsured";

const SOURCE_LABEL: Record<ValuedItem["source"], string> = {
  alt: "alt.xyz",
  "alt-sales": "alt.xyz sales",
  tcgplayer: "TCGplayer",
  insured: "Insured value",
};

function kindOf(it: ValuedItem): Kind {
  if ((it.type ?? "").toLowerCase() === "sealed") return "sealed";
  if (it.gradingID) return "graded";
  return "other";
}

function safeStorage<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

export default function Home() {
  const [wallet, setWallet] = useState("");
  const [data, setData] = useState<Portfolio | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<string>("30D");
  const [customFrom, setCustomFrom] = useState("");
  const [kind, setKind] = useState<Kind>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "market", dir: -1 });

  const load = useCallback(async (w: string) => {
    const addr = w.trim();
    if (!addr) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/portfolio?wallet=${encodeURIComponent(addr)}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
      setData(body);
      safeStorage(() => localStorage.setItem("cc.wallet", addr), undefined);
      const url = new URL(window.location.href);
      url.searchParams.set("wallet", addr);
      window.history.replaceState(null, "", url);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("wallet");
    const saved = fromUrl ?? safeStorage(() => localStorage.getItem("cc.wallet"), null);
    if (saved) {
      setWallet(saved);
      void load(saved);
    }
  }, [load]);

  const now = data?.fetchedAt ?? Date.now();
  const from = useMemo(() => {
    if (period === "custom" && customFrom) return Date.parse(customFrom + "T00:00:00");
    const p = PERIODS.find((x) => x.key === period) ?? PERIODS[2];
    return now - p.days * DAY;
  }, [period, customFrom, now]);

  const items = data?.items ?? [];
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter(
      (it) =>
        (kind === "all" || kindOf(it) === kind) &&
        (!q || `${it.itemName} ${it.category ?? ""} ${it.matchedName ?? ""}`.toLowerCase().includes(q)),
    );
  }, [items, kind, query]);

  const rows = useMemo(() => {
    const withChange = shown.map((it) => {
      const c = itemChange(it, from);
      const vsInsured = it.marketValue !== null && it.insuredValue ? it.marketValue / it.insuredValue - 1 : null;
      return { it, c, vsInsured };
    });
    const val = (r: (typeof withChange)[number]): number | string => {
      switch (sort.key) {
        case "name": return r.it.itemName.toLowerCase();
        case "insured": return r.it.insuredValue ?? -Infinity;
        case "market": return r.it.marketValue ?? -Infinity;
        case "change": return r.c.change ?? -Infinity;
        case "pctChange": return r.c.pct ?? -Infinity;
        case "vsInsured": return r.vsInsured ?? -Infinity;
      }
    };
    return withChange.sort((a, b) => (val(a) > val(b) ? 1 : val(a) < val(b) ? -1 : 0) * sort.dir);
  }, [shown, from, sort]);

  const total = useMemo(() => portfolioChange(shown, from), [shown, from]);
  const insured = shown.reduce((s, it) => s + (it.insuredValue ?? 0), 0);
  const market = shown.reduce((s, it) => s + (it.marketValue ?? 0), 0);
  const series = useMemo(() => portfolioSeries(shown, from, now), [shown, from, now]);
  const counts = useMemo(() => {
    const c = { graded: 0, sealed: 0, other: 0 };
    for (const it of items) c[kindOf(it) as "graded" | "sealed" | "other"]++;
    return c;
  }, [items]);
  const fallbackCount = shown.filter((it) => it.source === "insured").length;

  const th = (key: SortKey, label: string) => (
    <th onClick={() => setSort((s) => ({ key, dir: s.key === key ? (-s.dir as 1 | -1) : -1 }))} aria-sort={sort.key === key ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>
      {label}
      {sort.key === key ? (sort.dir === 1 ? " ▲" : " ▼") : ""}
    </th>
  );

  return (
    <main className="wrap">
      <div className="header">
        <h1>CollectorCrypt Portfolio</h1>
        <ThemeToggle />
      </div>
      <p className="sub">Market value and PnL for your vaulted cards and sealed products. Graded cards are priced from alt.xyz, sealed products from TCGplayer.</p>

      <form
        className="search"
        onSubmit={(e) => {
          e.preventDefault();
          void load(wallet);
        }}
      >
        <input value={wallet} onChange={(e) => setWallet(e.target.value)} placeholder="Solana wallet address" aria-label="Solana wallet address" spellCheck={false} />
        <button className="btn" disabled={loading || !wallet.trim()}>{loading ? "Loading…" : "Analyze"}</button>
      </form>

      {error && <p className="error">{error}</p>}
      {data?.warnings.map((w) => <p key={w} className="warn">{w}</p>)}

      {data && (
        <>
          <div className="toolbar">
            <div className="chips" role="group" aria-label="Period">
              {PERIODS.map((p) => (
                <button key={p.key} className="chip" aria-pressed={period === p.key} onClick={() => setPeriod(p.key)}>{p.label}</button>
              ))}
              <button className="chip" aria-pressed={period === "custom"} onClick={() => setPeriod("custom")}>Custom</button>
              {period === "custom" && (
                <input type="date" value={customFrom} max={new Date(now).toISOString().slice(0, 10)} onChange={(e) => setCustomFrom(e.target.value)} aria-label="Start date" />
              )}
            </div>
            <div className="chips" role="group" aria-label="Item type">
              {(["all", "graded", "sealed", "other"] as Kind[]).map((k) => (
                <button key={k} className="chip" aria-pressed={kind === k} onClick={() => setKind(k)}>
                  {k === "all" ? `All ${items.length}` : `${k[0].toUpperCase()}${k.slice(1)} ${counts[k as "graded"]}`}
                </button>
              ))}
            </div>
          </div>

          <section className="kpis">
            <div className="kpi">
              <div className="label">Market value</div>
              <div className="value">{usd(market)}</div>
              <div className="hint">{shown.length} items</div>
            </div>
            <div className="kpi">
              <div className="label">Period PnL</div>
              <div className={`value ${tone(total.change)}`}>{signedUsd(total.change)}</div>
              <div className={`hint ${tone(total.change)}`}>{pct(total.pct)} since {new Date(from).toLocaleDateString()}</div>
            </div>
            <div className="kpi">
              <div className="label">Insured value</div>
              <div className="value">{usd(insured)}</div>
              <div className="hint">CollectorCrypt</div>
            </div>
            <div className="kpi">
              <div className="label">Market vs insured</div>
              <div className={`value ${tone(market - insured)}`}>{signedUsd(market - insured)}</div>
              <div className="hint">{insured ? pct(market / insured - 1) : "—"}</div>
            </div>
          </section>

          <section className="card">
            <h2>Portfolio value</h2>
            <ValueChart series={series} />
            {(total.partialCount > 0 || fallbackCount > 0) && (
              <p className="muted" style={{ margin: "8px 0 0", fontSize: 12 }}>
                {total.partialCount > 0 && `${total.partialCount} item${total.partialCount > 1 ? "s have" : " has"} less history than this period, so their change is measured from their first known price. `}
                {fallbackCount > 0 && `${fallbackCount} item${fallbackCount > 1 ? "s use" : " uses"} the insured value because no market price was found.`}
              </p>
            )}
          </section>

          <section className="card">
            <div className="filters">
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search items" aria-label="Search items" />
            </div>
            <div className="tablewrap">
              <table>
                <thead>
                  <tr>
                    {th("name", "Item")}
                    {th("insured", "Insured")}
                    {th("market", "Market")}
                    {th("vsInsured", "vs insured")}
                    {th("change", "Period PnL")}
                    {th("pctChange", "%")}
                    <th>Source</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ it, c, vsInsured }) => (
                    <tr key={it.nftAddress}>
                      <td>
                        <div className="item">
                          {it.image ? <img src={it.image} alt="" loading="lazy" /> : <img alt="" />}
                          <div>
                            <a className="name" href={`https://collectorcrypt.com/assets/solana/${it.nftAddress}`} target="_blank" rel="noreferrer">{it.itemName}</a>
                            <div className="meta">
                              {[it.category, it.gradingCompany && `${it.gradingCompany} ${it.grade ?? it.gradeNum ?? ""}`, kindOf(it) === "sealed" && "Sealed"].filter(Boolean).join(" · ")}
                            </div>
                            {it.matchedName && <div className="meta">Matched: {it.matchedName}</div>}
                            {it.note && <div className="meta">{it.note}</div>}
                          </div>
                        </div>
                      </td>
                      <td>{usd(it.insuredValue)}</td>
                      <td>{usd(it.marketValue)}</td>
                      <td className={tone(vsInsured)}>{pct(vsInsured)}</td>
                      <td className={tone(c.change)}>{signedUsd(c.change)}{c.partial && it.history.length ? "*" : ""}</td>
                      <td className={tone(c.pct)}>{pct(c.pct)}</td>
                      <td>
                        {it.sourceUrl ? (
                          <a href={it.sourceUrl} target="_blank" rel="noreferrer"><span className="badge">{SOURCE_LABEL[it.source]}</span></a>
                        ) : (
                          <span className="badge">{SOURCE_LABEL[it.source]}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {!rows.length && (
                    <tr><td colSpan={7} className="muted">No items match.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
          <footer>Updated {new Date(data.fetchedAt).toLocaleString()}. Prices: alt.xyz (graded cards), TCGplayer via tcgcsv.com (sealed). Not financial advice.</footer>
        </>
      )}
    </main>
  );
}
