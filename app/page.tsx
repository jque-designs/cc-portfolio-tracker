"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { demoPortfolio } from "@/lib/demo";
import { DAY, itemChange, itemSeries } from "@/lib/pnl";
import type { Portfolio } from "@/lib/types";
import { Banner, BannerHead } from "./ui/Banner";
import { Collection, type Row, type Tab } from "./ui/Collection";
import { IconInfo } from "./ui/icons";
import { ItemSheet } from "./ui/ItemSheet";
import { Landing } from "./ui/Landing";
import {
  KIND_LABEL,
  type Kind,
  type PeriodKey,
  type Sort,
  categoryLabel,
  isSolanaAddress,
  kindOf,
  periodPhrase,
  periodStart,
} from "./ui/model";
import { EmptyVault, ErrorPanel, LoadingVault } from "./ui/States";
import { Stripes } from "./ui/Stripes";
import { TopBar } from "./ui/TopBar";

type Status =
  | { s: "landing" }
  | { s: "loading"; wallet: string }
  | { s: "error"; wallet: string; message: string }
  | { s: "ready" };

const BAD_ADDRESS = "That doesn’t look like a Solana wallet address. It should be 32 to 44 letters and numbers.";

function setUrl(params: Record<string, string> | null) {
  const url = new URL(window.location.href);
  url.search = "";
  if (params) for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  window.history.replaceState(null, "", url);
}

export default function Home() {
  const [status, setStatus] = useState<Status>({ s: "landing" });
  const [data, setData] = useState<Portfolio | null>(null);
  const [isDemo, setIsDemo] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [lastWallet, setLastWallet] = useState<string | null>(null);

  const [period, setPeriodRaw] = useState<PeriodKey>("30D");
  const [customFrom, setCustomFrom] = useState("");
  const [kind, setKind] = useState<Kind | "all">("all");
  const [category, setCategory] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>({ key: "market", dir: -1 });
  const [tab, setTab] = useState<Tab>("vault");
  const [openId, setOpenId] = useState<string | null>(null);

  const topInput = useRef<HTMLInputElement>(null);
  const req = useRef(0);

  const resetView = () => {
    setKind("all");
    setCategory("");
    setQuery("");
    setOpenId(null);
    setRefreshError(null);
  };

  const open = useCallback(async (raw: string, refresh = false) => {
    const addr = raw.trim();
    if (!addr) {
      setFormError("Paste a Solana wallet address to open its vault.");
      return;
    }
    if (!isSolanaAddress(addr)) {
      setFormError(BAD_ADDRESS);
      setStatus((s) => (s.s === "landing" ? s : { s: "error", wallet: addr, message: BAD_ADDRESS }));
      return;
    }
    setFormError(null);
    const id = ++req.current;
    if (refresh) {
      setRefreshing(true);
      setRefreshError(null);
    } else {
      setStatus({ s: "loading", wallet: addr });
      resetView();
      window.scrollTo({ top: 0 });
    }
    try {
      const res = await fetch(`/api/portfolio?wallet=${encodeURIComponent(addr)}`, refresh ? { cache: "no-store" } : undefined);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? `The server answered ${res.status}.`);
      if (id !== req.current) return;
      setData(body as Portfolio);
      setIsDemo(false);
      setStatus({ s: "ready" });
      setUrl({ wallet: addr });
      setLastWallet(addr);
      try {
        localStorage.setItem("cc.wallet", addr);
      } catch {
        // Storage blocked: the "reopen" shortcut just won't appear next time.
      }
    } catch (e) {
      if (id !== req.current) return;
      const msg = (e as Error).message === "Failed to fetch" ? "The connection dropped before prices came back." : (e as Error).message;
      if (refresh) setRefreshError(msg);
      else setStatus({ s: "error", wallet: addr, message: msg });
    } finally {
      if (id === req.current) setRefreshing(false);
    }
  }, []);

  const openDemo = useCallback(() => {
    req.current++;
    setFormError(null);
    resetView();
    setData(demoPortfolio());
    setIsDemo(true);
    setStatus({ s: "ready" });
    setUrl({ demo: "1" });
    window.scrollTo({ top: 0 });
  }, []);

  useEffect(() => {
    try {
      setLastWallet(localStorage.getItem("cc.wallet"));
    } catch {
      // ignore
    }
    const q = new URLSearchParams(window.location.search);
    if (q.get("demo")) openDemo();
    else if (q.get("wallet")) void open(q.get("wallet")!);
  }, [open, openDemo]);

  const items = useMemo(() => data?.items ?? [], [data]);
  const now = data?.fetchedAt ?? 0;
  const from = useMemo(() => periodStart(period, customFrom, now, items), [period, customFrom, now, items]);
  const phrase = periodPhrase(period, from);

  const setPeriod = (p: PeriodKey) => {
    if (p === "custom" && !customFrom) setCustomFrom(new Date(now - 90 * DAY).toISOString().slice(0, 10));
    setPeriodRaw(p);
  };

  const categories = useMemo(() => {
    const m = new Map<string, number>();
    for (const it of items) m.set(categoryLabel(it.category), (m.get(categoryLabel(it.category)) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [items]);

  // Category and search narrow everything; the kind chips then split what's left.
  const scoped = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter(
      (it) =>
        (!category || categoryLabel(it.category) === category) &&
        (!q || `${it.itemName} ${it.category ?? ""} ${it.matchedName ?? ""} ${it.productCode ?? ""}`.toLowerCase().includes(q)),
    );
  }, [items, category, query]);

  const counts = useMemo(() => {
    const c: Record<Kind, number> = { graded: 0, sealed: 0, other: 0 };
    for (const it of scoped) c[kindOf(it)]++;
    return c;
  }, [scoped]);

  const shown = useMemo(() => scoped.filter((it) => kind === "all" || kindOf(it) === kind), [scoped, kind]);

  const rows: Row[] = useMemo(() => {
    const out = shown.map((it) => ({
      it,
      c: itemChange(it, from),
      vsInsured: it.source !== "insured" && it.marketValue !== null && it.insuredValue ? it.marketValue / it.insuredValue - 1 : null,
      series: itemSeries(it, from, now),
    }));
    const val = (r: Row): number | string => {
      switch (sort.key) {
        case "name":
          return r.it.itemName.toLowerCase();
        case "insured":
          return r.it.insuredValue ?? -Infinity;
        case "market":
          return r.it.marketValue ?? -Infinity;
        case "change":
          return r.it.history.length ? (r.c.change ?? -Infinity) : -Infinity;
        case "pctChange":
          return r.it.history.length ? (r.c.pct ?? -Infinity) : -Infinity;
        case "vsInsured":
          return r.vsInsured ?? -Infinity;
      }
    };
    return out.sort((a, b) => {
      const x = val(a);
      const y = val(b);
      return (x > y ? 1 : x < y ? -1 : 0) * sort.dir;
    });
  }, [shown, from, now, sort]);

  const scope = [category, kind !== "all" ? KIND_LABEL[kind] : null, query.trim() ? `“${query.trim()}”` : null].filter(Boolean).join(" · ") || null;
  const openItem = openId ? items.find((it) => it.nftAddress === openId) ?? null : null;
  const closeSheet = useCallback(() => setOpenId(null), []);

  const topWallet = status.s === "landing" ? null : status.s === "ready" ? (isDemo ? "" : data?.wallet ?? "") : status.wallet;

  return (
    <>
      <TopBar ref={topInput} wallet={topWallet} onOpen={status.s === "landing" ? null : (w) => void open(w)} />

      {status.s === "landing" && <Landing onOpen={(w) => void open(w)} onDemo={openDemo} lastWallet={lastWallet} error={formError} />}

      {status.s === "loading" && <LoadingVault wallet={status.wallet} />}

      {status.s === "error" && (
        <ErrorPanel wallet={status.wallet} message={status.message} onRetry={() => void open(status.wallet)} onDemo={openDemo} />
      )}

      {status.s === "ready" && data && (
        <main className="vault wrap">
          {isDemo && (
            <div className="notice demo">
              <IconInfo />
              <span>
                This is a sample vault: real catalogue items with made-up prices.{" "}
                <button onClick={() => topInput.current?.focus()}>Value your own wallet</button>
              </span>
            </div>
          )}
          {data.warnings.map((w) => (
            <div key={w} className="notice">
              <IconInfo />
              <span>{w}</span>
            </div>
          ))}
          {refreshError && (
            <div className="notice">
              <IconInfo />
              <span>Couldn&rsquo;t refresh: {refreshError} The prices below are from the last successful load.</span>
            </div>
          )}

          {items.length ? (
            <>
              <Banner
                wallet={data.wallet}
                isDemo={isDemo}
                fetchedAt={data.fetchedAt}
                refreshing={refreshing}
                onRefresh={() => void open(data.wallet, true)}
                items={shown}
                scope={scope}
                period={period}
                setPeriod={setPeriod}
                customFrom={customFrom}
                setCustomFrom={setCustomFrom}
                from={from}
                now={now}
                onOpenItem={(it) => setOpenId(it.nftAddress)}
              />
              <Collection
                rows={rows}
                total={items.length}
                tab={tab}
                setTab={setTab}
                kind={kind}
                setKind={setKind}
                counts={counts}
                category={category}
                setCategory={setCategory}
                categories={categories}
                query={query}
                setQuery={setQuery}
                sort={sort}
                setSort={setSort}
                phrase={phrase.charAt(0).toUpperCase() + phrase.slice(1)}
                onOpen={(it) => setOpenId(it.nftAddress)}
              />
            </>
          ) : (
            <>
              <section className="banner">
                <Stripes from={50} gap={9} />
                <BannerHead wallet={data.wallet} isDemo={false} />
                <div style={{ height: 22 }} />
              </section>
              <EmptyVault />
            </>
          )}
        </main>
      )}

      {openItem && <ItemSheet item={openItem} from={from} now={now} phrase={phrase} onClose={closeSheet} />}

      <footer className="foot">
        <div className="wrap">
          <span className="label">Vault Ledger · not affiliated with Collector Crypt</span>
          <span className="label">Prices from alt.xyz and TCGplayer (via tcgcsv.com) · not financial advice</span>
        </div>
      </footer>
    </>
  );
}
