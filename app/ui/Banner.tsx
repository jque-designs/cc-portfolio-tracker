"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { itemChange, portfolioChange, portfolioSeries } from "@/lib/pnl";
import type { ValuedItem } from "@/lib/types";
import { pct, signedUsd, splitUsd, tone, usd } from "../format";
import { Chart } from "./Chart";
import { IconCheck, IconCopy, IconOut, IconRefresh, Tri } from "./icons";
import { PERIOD_TABS, type PeriodKey, ago, periodPhrase, short, solscanUrl } from "./model";
import { Identicon, Stripes } from "./Stripes";

/** Animates a number toward its target (count-up on first show, glide on filter changes). */
function useTween(target: number, ms = 750) {
  const [v, setV] = useState(0);
  const cur = useRef(0);
  useEffect(() => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const from = cur.current;
    if (reduce || from === target) {
      cur.current = target;
      setV(target);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / ms);
      const next = from + (target - from) * (1 - (1 - k) ** 3);
      cur.current = next;
      setV(next);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

function useClock(ms = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

export function BannerHead({ wallet, isDemo, children }: { wallet: string; isDemo: boolean; children?: React.ReactNode }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(wallet);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      // Clipboard blocked; nothing else to do.
    }
  };
  return (
    <div className="banner-head">
      <div className="avatar">
        <Identicon seed={wallet} />
      </div>
      <div className="who">
        <div className="who-name">
          <span className="mono" title={wallet}>
            {isDemo ? "Sample vault" : short(wallet, 5, 5)}
          </span>
          {!isDemo && (
            <button className="copy" onClick={copy} aria-label={copied ? "Copied" : "Copy wallet address"} title="Copy address">
              {copied ? <IconCheck /> : <IconCopy />}
            </button>
          )}
        </div>
        <div className="who-meta">{children}</div>
      </div>
    </div>
  );
}

export function Banner(props: {
  wallet: string;
  isDemo: boolean;
  fetchedAt: number;
  refreshing: boolean;
  onRefresh: () => void;
  items: ValuedItem[];
  scope: string | null;
  period: PeriodKey;
  setPeriod: (p: PeriodKey) => void;
  customFrom: string;
  setCustomFrom: (d: string) => void;
  from: number;
  now: number;
  onOpenItem: (it: ValuedItem) => void;
}) {
  const { items, from, now, period } = props;
  const clock = useClock();
  const total = useMemo(() => portfolioChange(items, from), [items, from]);
  const series = useMemo(() => portfolioSeries(items, from, now), [items, from, now]);
  const market = items.reduce((s, it) => s + (it.marketValue ?? 0), 0);
  const insured = items.reduce((s, it) => s + (it.insuredValue ?? 0), 0);
  const priced = items.filter((it) => it.source !== "insured").length;
  const fallback = items.length - priced;

  const mover = useMemo(() => {
    let best: { it: ValuedItem; p: number } | null = null;
    for (const it of items) {
      const c = itemChange(it, from);
      if (c.pct === null || !it.history.length) continue;
      if (!best || Math.abs(c.pct) > Math.abs(best.p)) best = { it, p: c.pct };
    }
    return best;
  }, [items, from]);

  const shown = useTween(market);
  const { whole, cents } = splitUsd(shown);
  const t = tone(total.change);
  const prem = insured ? market / insured - 1 : null;
  const today = new Date(now).toISOString().slice(0, 10);

  return (
    <section className={`banner${props.refreshing ? " is-refreshing" : ""}`}>
      <Stripes from={50} gap={9} />
      <BannerHead wallet={props.wallet} isDemo={props.isDemo}>
        {!props.isDemo && (
          <a href={solscanUrl(props.wallet)} target="_blank" rel="noreferrer">
            Solscan <IconOut width={12} height={12} />
          </a>
        )}
        <span>{props.refreshing ? "Refreshing…" : `Priced ${ago(props.fetchedAt, Math.max(clock, props.fetchedAt))}`}</span>
        {!props.isDemo && (
          <button onClick={props.onRefresh} disabled={props.refreshing}>
            <IconRefresh width={12} height={12} className={props.refreshing ? "spin" : undefined} /> Refresh
          </button>
        )}
      </BannerHead>

      <div className="banner-body">
        <div>
          <span className="label">Market value{props.scope ? ` · ${props.scope}` : ""}</span>
          <div className="big-value" aria-label={usd(market)}>
            {whole}
            <span className="cents">{cents}</span>
          </div>
          <div className="change-row">
            <span className={`pill ${t || "flat"}`}>
              {t && <Tri down={t === "down"} />}
              {signedUsd(total.change)} · {pct(total.pct)}
            </span>
            <span className="label">{periodPhrase(period, from)}</span>
          </div>
        </div>
        <div className="ledger-lines">
          <div className="ledger-line">
            <span className="k">Insured value</span>
            <span className="dots" />
            <span className="v">{usd(insured)}</span>
          </div>
          <div className="ledger-line">
            <span className="k">Market vs insured</span>
            <span className="dots" />
            <span className={`v ${tone(market - insured)}`}>
              {signedUsd(market - insured)} · {pct(prem)}
            </span>
          </div>
          <div className="ledger-line">
            <span className="k">Priced at market</span>
            <span className="dots" />
            <span className="v">
              {priced} of {items.length}
            </span>
          </div>
          <div className="ledger-line">
            <span className="k">Top mover</span>
            <span className="dots" />
            {mover ? (
              <button className="v trunc" onClick={() => props.onOpenItem(mover.it)} title={mover.it.itemName}>
                <span className="trunc-name">{mover.it.itemName}</span>
                <span className={tone(mover.p)}> {pct(mover.p)}</span>
              </button>
            ) : (
              <span className="v flat">—</span>
            )}
          </div>
        </div>
      </div>

      <div className="chart-wrap">
        <div className="periods" role="group" aria-label="Period">
          {PERIOD_TABS.map((p) => (
            <button key={p.key} aria-pressed={period === p.key} onClick={() => props.setPeriod(p.key)}>
              {p.label}
            </button>
          ))}
          <span className="spacer" />
          <button aria-pressed={period === "custom"} onClick={() => props.setPeriod("custom")}>
            Custom
          </button>
          {period === "custom" && (
            <input
              type="date"
              value={props.customFrom}
              max={today}
              onChange={(e) => props.setCustomFrom(e.target.value)}
              aria-label="Start date"
            />
          )}
        </div>
        <Chart series={series} label={`Vault market value, ${periodPhrase(period, from)}`} />
        {(total.partialCount > 0 || fallback > 0) && (
          <p className="chart-note">
            {total.partialCount > 0 &&
              `${total.partialCount} item${total.partialCount > 1 ? "s have" : " has"} less history than this period, so ${total.partialCount > 1 ? "their" : "its"} change counts from the first known price. `}
            {fallback > 0 &&
              `${fallback} item${fallback > 1 ? "s are" : " is"} held at insured value because no market price was found.`}
          </p>
        )}
      </div>
    </section>
  );
}
