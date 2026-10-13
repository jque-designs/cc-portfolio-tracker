"use client";
import { useEffect, useRef } from "react";
import { itemChange, itemSeries } from "@/lib/pnl";
import type { ValuedItem } from "@/lib/types";
import { pct, signedUsd, splitUsd, tone, usd } from "../format";
import { Art, CategoryBadge } from "./Art";
import { Chart } from "./Chart";
import { IconOut, IconX, Tri } from "./icons";
import { SOURCE, categoryLabel, ccItemUrl, gradeText, kindOf } from "./model";

/** Where market value sits against insured value, on a shared scale. */
function PremiumMeter({ market, insured }: { market: number; insured: number }) {
  const max = Math.max(market, insured) * 1.18;
  const m = (market / max) * 100;
  const i = (insured / max) * 100;
  const diff = market / insured - 1;
  const above = diff >= 0;
  return (
    <div className="meter">
      <div className="meter-head">
        <span className="label">Market vs insured</span>
        <span className={`mono ${above ? "up" : "down"}`}>
          {pct(Math.abs(diff)).slice(1)} {above ? "above" : "below"}
        </span>
      </div>
      <div className="meter-track">
        <div className="meter-fill" style={{ width: `${m}%`, background: above ? "var(--up)" : "var(--accent)" }} />
        <div className="meter-tick" style={{ left: `calc(${i}% - 1px)` }} title="Insured value" />
      </div>
      <div className="meter-legend">
        <span className="label">
          Market <b className="mono">{usd(market)}</b>
        </span>
        <span className="label">
          Insured <b className="mono">{usd(insured)}</b>
        </span>
      </div>
    </div>
  );
}

export function ItemSheet({
  item,
  from,
  now,
  phrase,
  onClose,
}: {
  item: ValuedItem;
  from: number;
  now: number;
  phrase: string;
  onClose: () => void;
}) {
  const closeBtn = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeBtn.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const c = itemChange(item, from);
  const series = itemSeries(item, from, now);
  const src = SOURCE[item.source];
  const k = kindOf(item);
  const t = item.history.length ? tone(c.change) : "";
  const { whole, cents } = splitUsd(item.marketValue ?? 0);
  const facts = [
    categoryLabel(item.category),
    k === "graded" ? `${item.gradingCompany ?? ""} ${gradeText(item)}`.trim() : null,
    k === "graded" && item.gradingID ? `Cert ${item.gradingID}` : null,
    k === "sealed" ? "Sealed" : null,
    item.format,
    item.packCount ? `${item.packCount} packs` : null,
    item.year ? String(item.year) : null,
    item.language && item.language !== "English" ? item.language : null,
  ].filter(Boolean) as string[];

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <aside className="sheet" role="dialog" aria-modal="true" aria-label={item.itemName}>
        <div className="sheet-top">
          <span className={`src-chip ${src.cls}`}>{src.long}</span>
          <button ref={closeBtn} className="icon-btn" onClick={onClose} aria-label="Close">
            <IconX />
          </button>
        </div>
        <div className="sheet-art">
          <Art item={item} size="sheet" />
          <CategoryBadge category={item.category} />
        </div>
        <div className="sheet-body">
          <h2>{item.itemName}</h2>
          <div className="facts">
            {facts.map((f) => (
              <span key={f} className="fact">
                {f}
              </span>
            ))}
          </div>

          <div className="sheet-value">
            <div>
              <span className="label">Market value</span>
              <div className="v">
                {item.marketValue === null ? "—" : whole}
                <span className="cents">{item.marketValue === null ? "" : cents}</span>
              </div>
            </div>
            {item.history.length ? (
              <span className={`pill ${t || "flat"}`}>
                {t && <Tri down={t === "down"} />}
                {signedUsd(c.change)} · {pct(c.pct)}
              </span>
            ) : (
              <span className="pill flat">No price history</span>
            )}
          </div>

          {item.source !== "insured" && item.marketValue !== null && item.insuredValue ? <PremiumMeter market={item.marketValue} insured={item.insuredValue} /> : null}

          <div className="sheet-section">
            <span className="label">
              Price, {phrase}
              {c.partial && item.history.length ? " · history starts later" : ""}
            </span>
            {series.length >= 2 ? (
              <Chart series={series} label={`${item.itemName} price, ${phrase}`} />
            ) : (
              <div className="chart-empty short">
                {item.source === "insured" ? "Held at insured value, so there is no market history." : "No price history from this source yet."}
              </div>
            )}
          </div>

          <div className="sheet-section">
            <span className="label">How it&rsquo;s priced</span>
            <div className="source-box">
              <div className="s-name">{src.long}</div>
              {item.matchedName && (
                <div className="s-match">
                  Matched to <b>{item.matchedName}</b>
                </div>
              )}
              {item.note && <div className="s-note">{item.note}</div>}
              {item.source === "alt-sales" && <div className="s-note">No Alt Value for this grade, so this is the median of the last three sales.</div>}
            </div>
            <div className="link-row">
              {!item.nftAddress.startsWith("demo") && (
                <a className="link-btn" href={ccItemUrl(item.nftAddress)} target="_blank" rel="noreferrer">
                  Collector Crypt <IconOut width={13} height={13} />
                </a>
              )}
              {item.sourceUrl && (
                <a className="link-btn" href={item.sourceUrl} target="_blank" rel="noreferrer">
                  {item.source === "tcgplayer" ? "TCGplayer" : "alt.xyz"} <IconOut width={13} height={13} />
                </a>
              )}
              {!item.nftAddress.startsWith("demo") && (
                <a className="link-btn" href={`https://solscan.io/token/${item.nftAddress}`} target="_blank" rel="noreferrer">
                  Solscan <IconOut width={13} height={13} />
                </a>
              )}
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
