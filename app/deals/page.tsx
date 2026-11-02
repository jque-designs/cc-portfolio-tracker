"use client";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type Deal, type DealPage, type DealRule, type Order, STALE_DAYS, isDeal } from "@/lib/dealMath";
import { demoDeals } from "@/lib/demoDeals";
import type { ValuedItem } from "@/lib/types";
import { pct, usd } from "../format";
import { Art } from "../ui/Art";
import { IconInfo, IconOut, IconRefresh, IconSearch, IconChevron } from "../ui/icons";
import { ago, ccItemUrl, metaLine } from "../ui/model";
import { Stripes } from "../ui/Stripes";
import { TopBar } from "../ui/TopBar";

const PAGE = 40;
const FIRST_PAGES = 3;

const RULES: { key: DealRule | "all"; label: string; long: string }[] = [
  { key: "avg3", label: "Under avg of last 3", long: "the average of the last three sales" },
  { key: "last", label: "Under last sale", long: "the last sale" },
  { key: "both", label: "Under both", long: "both the last sale and the last-three average" },
  { key: "all", label: "Every priced listing", long: "" },
];
const DISCOUNTS = [0, 0.1, 0.2, 0.3];
const ORDER_LABEL: Record<Order, string> = {
  listedDateDesc: "Newest listings",
  listedPriceAsc: "Cheapest first",
  listedPriceDesc: "Priciest first",
};

/** The table and art components take a valued item; a listing has no valuation of its own. */
const asItem = (d: Deal): ValuedItem => ({ ...d.item, marketValue: d.price, source: "insured", sourceUrl: null, matchedName: d.matchedName, history: [] });
const day = (t: number) => new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" });

interface Filters {
  q: string;
  min: string;
  max: string;
  order: Order;
}

export default function Deals() {
  const [filters, setFilters] = useState<Filters>({ q: "", min: "25", max: "", order: "listedDateDesc" });
  const [draft, setDraft] = useState<Filters>(filters);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [matching, setMatching] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scannedAt, setScannedAt] = useState<number | null>(null);
  const [isDemo, setIsDemo] = useState(false);
  const [rule, setRule] = useState<DealRule | "all">("avg3");
  const [minOff, setMinOff] = useState(0);
  const [hideStale, setHideStale] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const run = useRef(0);

  const fetchPage = useCallback(async (f: Filters, c: string | null): Promise<DealPage> => {
    const qs = new URLSearchParams({ step: String(PAGE), order: f.order });
    if (f.q.trim()) qs.set("q", f.q.trim());
    if (Number(f.min) > 0) qs.set("min", f.min);
    if (Number(f.max) > 0) qs.set("max", f.max);
    if (c) qs.set("cursor", c);
    const res = await fetch(`/api/deals?${qs}`);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error ?? `The server answered ${res.status}.`);
    return body as DealPage;
  }, []);

  /** Scan `pages` pages, starting over when `reset` is set, and append as each one lands. */
  const scan = useCallback(
    async (f: Filters, pages: number, reset: boolean, from: string | null) => {
      const id = ++run.current;
      setBusy(true);
      setError(null);
      if (reset) {
        setDeals([]);
        setMatching(null);
        setOpenId(null);
      }
      let c = reset ? null : from;
      try {
        for (let i = 0; i < pages; i++) {
          const p = await fetchPage(f, c);
          if (id !== run.current) return;
          setDeals((d) => {
            const seen = new Set(d.map((x) => x.item.nftAddress));
            return [...d, ...p.deals.filter((x) => !seen.has(x.item.nftAddress))];
          });
          setMatching(p.matching);
          setScannedAt(p.scannedAt);
          c = p.nextCursor;
          setCursor(c);
          if (!c) break;
        }
      } catch (e) {
        if (id === run.current) setError((e as Error).message === "Failed to fetch" ? "The connection dropped mid-scan." : (e as Error).message);
      } finally {
        if (id === run.current) setBusy(false);
      }
    },
    [fetchPage],
  );

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("demo")) {
      setIsDemo(true);
      setDeals(demoDeals());
      setScannedAt(Date.now());
      setMatching(12);
      return;
    }
    void scan(filters, FIRST_PAGES, true, null);
    // First load only; later scans come from the form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const priced = useMemo(() => deals.filter((d) => d.basis !== "none"), [deals]);
  const shown = useMemo(() => {
    const out = priced.filter(
      (d) => (rule === "all" || isDeal(d, rule, minOff)) && !(hideStale && d.stale),
    );
    return out.sort((a, b) => (headline(a, rule) ?? Infinity) - (headline(b, rule) ?? Infinity));
  }, [priced, rule, minOff, hideStale]);
  const savings = shown.reduce((s, d) => {
    const ref = rule === "last" || d.basis === "tcgplayer" ? d.lastSale?.price : (d.avg3 ?? d.lastSale?.price);
    return s + Math.max(0, (ref ?? d.price) - d.price);
  }, 0);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isDemo) return;
    setFilters(draft);
    void scan(draft, FIRST_PAGES, true, null);
  };
  const ruleInfo = RULES.find((r) => r.key === rule)!;

  return (
    <>
      <TopBar wallet={null} onOpen={null} current="deals" />
      <main className="vault wrap deals">
        {isDemo && (
          <div className="notice demo">
            <IconInfo />
            <span>
              Sample results: real catalogue items with made-up asks and sales. <a href="/deals">Scan the live marketplace</a>
            </span>
          </div>
        )}

        <section className="banner deal-banner">
          <Stripes from={50} gap={9} />
          <div className="deal-head">
            <span className="label">Collector Crypt marketplace · live</span>
            <h1>Deal desk</h1>
            <p>
              Every listing priced against what the same card in the same grade actually sold for: the last sale and the
              average of the last three, from alt.xyz&rsquo;s sales record. Sealed product is set against TCGplayer market.
            </p>
          </div>
          <div className="deal-stats">
            <div className="stat hot">
              <span className="big">{shown.length}</span>
              <span className="label">{rule === "all" ? "Priced listings" : "Under comps"}</span>
            </div>
            <div className="ledger-lines">
              <Line k="Listings scanned" v={`${deals.length}${matching ? ` of ${matching.toLocaleString("en-US")}` : ""}`} />
              <Line k="With comps" v={String(priced.length)} />
              <Line k="Total under comps" v={rule === "all" ? "—" : usd(savings, 0)} />
              <Line k="Scanned" v={scannedAt ? ago(scannedAt, Date.now()) : busy ? "now…" : "—"} />
            </div>
          </div>
          <form className="deal-form" onSubmit={submit}>
            <label className="field search">
              <IconSearch />
              <input value={draft.q} onChange={(e) => setDraft({ ...draft, q: e.target.value })} placeholder="Card, set or cert no." aria-label="Search listings" />
            </label>
            <label className="field money">
              <span>$</span>
              <input inputMode="decimal" value={draft.min} onChange={(e) => setDraft({ ...draft, min: e.target.value.replace(/[^0-9.]/g, "") })} placeholder="Min" aria-label="Minimum ask" />
            </label>
            <label className="field money">
              <span>$</span>
              <input inputMode="decimal" value={draft.max} onChange={(e) => setDraft({ ...draft, max: e.target.value.replace(/[^0-9.]/g, "") })} placeholder="Max" aria-label="Maximum ask" />
            </label>
            <label className="field pick">
              <select value={draft.order} onChange={(e) => setDraft({ ...draft, order: e.target.value as Order })} aria-label="Scan order">
                {(Object.keys(ORDER_LABEL) as Order[]).map((o) => (
                  <option key={o} value={o}>
                    {ORDER_LABEL[o]}
                  </option>
                ))}
              </select>
              <IconChevron />
            </label>
            <button className="btn-primary scan-btn" disabled={busy || isDemo}>
              <IconRefresh width={15} height={15} className={busy ? "spin" : ""} />
              {busy ? "Scanning" : "Scan"}
            </button>
          </form>
        </section>

        {error && (
          <div className="notice">
            <IconInfo />
            <span>
              {error} {deals.length ? "Results so far are below." : ""}
            </span>
          </div>
        )}

        <div className="chipbar deal-rules" role="group" aria-label="What counts as a deal">
          {RULES.map((r) => (
            <button key={r.key} aria-pressed={rule === r.key} onClick={() => setRule(r.key)}>
              {r.label}
            </button>
          ))}
          <span className="sep" />
          {DISCOUNTS.map((x) => (
            <button key={x} aria-pressed={minOff === x} disabled={rule === "all"} onClick={() => setMinOff(x)}>
              {x ? `${x * 100}%+ off` : "Any amount"}
            </button>
          ))}
          <span className="sep" />
          <button aria-pressed={hideStale} onClick={() => setHideStale(!hideStale)} title={`Last sale over ${STALE_DAYS} days ago`}>
            Hide stale comps
          </button>
        </div>

        {!shown.length ? (
          <div className="empty small">
            {busy ? (
              <p>Pricing listings against their last sales…</p>
            ) : (
              <p>
                {priced.length
                  ? `None of the ${priced.length} priced listings is under ${ruleInfo.long || "its comps"}${minOff ? ` by ${minOff * 100}% or more` : ""}.`
                  : "No listings with comps yet."}{" "}
                Scan more listings or loosen the filters.
              </p>
            )}
          </div>
        ) : (
          <div className="table-wrap">
            <table className="ledger deal-table">
              <thead>
                <tr>
                  <th>Listing</th>
                  <th>Ask</th>
                  <th className="hide-sm">Last sale</th>
                  <th className="hide-sm">Avg last 3</th>
                  <th className="hide-sm">Vs last</th>
                  <th className="hide-sm">Vs avg 3</th>
                  <th className="show-sm">Off</th>
                  <th className="hide-sm" />
                </tr>
              </thead>
              <tbody>
                {shown.map((d) => {
                  const it = asItem(d);
                  const open = openId === d.item.nftAddress;
                  const toggle = () => setOpenId(open ? null : d.item.nftAddress);
                  return (
                    <Fragment key={d.item.nftAddress}>
                      <tr
                        tabIndex={0}
                        aria-expanded={open}
                        onClick={toggle}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            toggle();
                          }
                        }}
                      >
                        <td>
                          <div className="item-cell">
                            <span className="thumb">
                              <Art item={it} size="thumb" />
                            </span>
                            <span>
                              <span className="item-name">{d.item.itemName}</span>
                              <span className="item-meta">
                                {metaLine(it)}
                                {d.listedAt ? ` · listed ${ago(d.listedAt, Date.now())}` : ""}
                              </span>
                            </span>
                          </div>
                        </td>
                        <td className="strong">{usd(d.price)}</td>
                        <td className="hide-sm">
                          {usd(d.lastSale?.price)}
                          <span className={`sub ${d.stale ? "stale" : ""}`}>
                            {d.basis === "tcgplayer" ? "TCG market" : d.lastSale ? day(d.lastSale.t) : ""}
                          </span>
                        </td>
                        <td className="hide-sm">
                          {usd(d.avg3)}
                          {d.avgOf > 0 && d.avgOf < 3 ? <span className="sub">of {d.avgOf}</span> : null}
                        </td>
                        <td className={`hide-sm ${tone(d.vsLast)}`}>{pct(d.vsLast)}</td>
                        <td className={`hide-sm ${tone(d.vsAvg3)}`}>
                          <span className={d.vsAvg3 !== null && d.vsAvg3 <= -0.2 ? "hot-pill" : ""}>{pct(d.vsAvg3)}</span>
                        </td>
                        <td className={`show-sm ${tone(headline(d, rule))}`}>
                          {pct(headline(d, rule))}
                          <span className="sub">{d.basis === "tcgplayer" ? "vs market" : rule === "last" ? "vs last" : "vs avg 3"}</span>
                        </td>
                        <td className="hide-sm">
                          <a className="buy" href={ccItemUrl(d.item.nftAddress)} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
                            Buy <IconOut width={12} height={12} />
                          </a>
                        </td>
                      </tr>
                      {open && (
                        <tr className="deal-detail">
                          <td colSpan={8}>
                            <DealDetail d={d} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!isDemo && (
          <div className="deal-more">
            {cursor ? (
              <button className="btn-ghost" disabled={busy} onClick={() => void scan(filters, 1, false, cursor)}>
                {busy ? "Scanning…" : `Scan ${PAGE} more listings`}
              </button>
            ) : deals.length ? (
              <span className="label">That&rsquo;s every listing matching these filters</span>
            ) : null}
          </div>
        )}
      </main>

      <footer className="foot">
        <div className="wrap">
          <span className="label">Vault Ledger · not affiliated with Collector Crypt</span>
          <span className="label">Sales from alt.xyz, sealed from TCGplayer · asks exclude fees · not financial advice</span>
        </div>
      </footer>
    </>
  );
}

/** The one discount a row is ranked by: vs the last sale for that rule and for sealed, else vs the last-3 average. */
const headline = (d: Deal, rule: DealRule | "all") => (rule === "last" || d.basis === "tcgplayer" ? d.vsLast : (d.vsAvg3 ?? d.vsLast));

// Under comps is good news here, so it reads green.
const tone = (v: number | null) => (v === null ? "flat" : v < 0 ? "up" : v > 0 ? "down" : "flat");

function Line({ k, v }: { k: string; v: string }) {
  return (
    <div className="ledger-line">
      <span className="k">{k}</span>
      <span className="dots" />
      <span className="v">{v}</span>
    </div>
  );
}

function DealDetail({ d }: { d: Deal }) {
  return (
    <div className="deal-detail-body">
      <div>
        <span className="label">{d.basis === "tcgplayer" ? "Market price" : "Recent sales, newest first"}</span>
        <ol className="sales">
          {d.recent.map((s, i) => (
            <li key={`${s.t}-${i}`} className={i < 3 && d.basis === "sales" ? "in-avg" : ""}>
              <span>{d.basis === "tcgplayer" ? "TCGplayer today" : day(s.t)}</span>
              <span className="dots" />
              <span className={s.price > d.price ? "up" : "down"}>{usd(s.price)}</span>
            </li>
          ))}
        </ol>
        {d.stale && <p className="fine">The last sale is over {STALE_DAYS} days old, so treat this comp with care.</p>}
      </div>
      <div>
        <span className="label">Matched to</span>
        <p className="match">{d.matchedName ?? "—"}</p>
        {d.note && <p className="fine">{d.note}</p>}
        <div className="links">
          <a href={ccItemUrl(d.item.nftAddress)} target="_blank" rel="noreferrer">
            Listing on Collector Crypt <IconOut width={12} height={12} />
          </a>
          {d.compUrl && (
            <a href={d.compUrl} target="_blank" rel="noreferrer">
              {d.basis === "tcgplayer" ? "TCGplayer" : "Sales on alt.xyz"} <IconOut width={12} height={12} />
            </a>
          )}
          {d.item.gradingID && <span className="label">Cert {d.item.gradingID}</span>}
        </div>
      </div>
    </div>
  );
}
