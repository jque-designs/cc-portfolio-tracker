"use client";
import type { ItemChange } from "@/lib/pnl";
import type { PricePoint, ValuedItem } from "@/lib/types";
import { pct, signedUsd, tone, usd } from "../format";
import { Art, CategoryBadge } from "./Art";
import { Spark } from "./Chart";
import { IconChevron, IconSearch, IconSortDown, IconSortUp, Tri } from "./icons";
import { KIND_LABEL, type Kind, SORT_LABEL, SOURCE, type Sort, type SortKey, metaLine } from "./model";

export interface Row {
  it: ValuedItem;
  c: ItemChange;
  vsInsured: number | null;
  series: PricePoint[];
}

export type Tab = "vault" | "ledger";

export function Collection(props: {
  rows: Row[];
  total: number;
  tab: Tab;
  setTab: (t: Tab) => void;
  kind: Kind | "all";
  setKind: (k: Kind | "all") => void;
  counts: Record<Kind, number>;
  category: string;
  setCategory: (c: string) => void;
  categories: [string, number][];
  query: string;
  setQuery: (q: string) => void;
  sort: Sort;
  setSort: (s: Sort) => void;
  phrase: string;
  onOpen: (it: ValuedItem) => void;
}) {
  const { rows, sort, setSort } = props;
  const kinds = (["graded", "sealed", "other"] as Kind[]).filter((k) => k !== "other" || props.counts.other > 0);

  return (
    <section className="collection">
      <div className="tabs-row">
        <div className="tabs" role="tablist" aria-label="View">
          <button role="tab" aria-selected={props.tab === "vault"} onClick={() => props.setTab("vault")}>
            Vault<span className="count">{props.total}</span>
          </button>
          <button role="tab" aria-selected={props.tab === "ledger"} onClick={() => props.setTab("ledger")}>
            Ledger
          </button>
        </div>
        <div className="tools">
          <label className="field search">
            <IconSearch />
            <input value={props.query} onChange={(e) => props.setQuery(e.target.value)} placeholder="Search this vault" aria-label="Search this vault" />
          </label>
          {props.categories.length > 1 && (
            <label className="field pick">
              <select value={props.category} onChange={(e) => props.setCategory(e.target.value)} aria-label="Game or category">
                <option value="">All games</option>
                {props.categories.map(([c, n]) => (
                  <option key={c} value={c}>
                    {c} ({n})
                  </option>
                ))}
              </select>
              <IconChevron />
            </label>
          )}
          <label className="field pick">
            <select value={sort.key} onChange={(e) => setSort({ key: e.target.value as SortKey, dir: e.target.value === "name" ? 1 : -1 })} aria-label="Sort by">
              {(Object.keys(SORT_LABEL) as SortKey[]).map((k) => (
                <option key={k} value={k}>
                  {SORT_LABEL[k]}
                </option>
              ))}
            </select>
            <IconChevron />
          </label>
          <button
            className="icon-btn"
            onClick={() => setSort({ ...sort, dir: sort.dir === 1 ? -1 : 1 })}
            aria-label={sort.dir === 1 ? "Ascending, switch to descending" : "Descending, switch to ascending"}
            title={sort.dir === 1 ? "Ascending" : "Descending"}
          >
            {sort.dir === 1 ? <IconSortUp /> : <IconSortDown />}
          </button>
        </div>
      </div>

      <div className="chipbar" role="group" aria-label="Item type">
        <button aria-pressed={props.kind === "all"} onClick={() => props.setKind("all")}>
          All <span className="n">{props.counts.graded + props.counts.sealed + props.counts.other}</span>
        </button>
        {kinds.map((k) => (
          <button key={k} aria-pressed={props.kind === k} disabled={!props.counts[k]} onClick={() => props.setKind(k)}>
            {KIND_LABEL[k]} <span className="n">{props.counts[k]}</span>
          </button>
        ))}
      </div>

      {!rows.length ? (
        <div className="empty small">
          <p>Nothing in this vault matches{props.query ? ` “${props.query}”` : " these filters"}.</p>
          <button
            className="btn-ghost"
            onClick={() => {
              props.setQuery("");
              props.setKind("all");
              props.setCategory("");
            }}
          >
            Clear filters
          </button>
        </div>
      ) : props.tab === "vault" ? (
        <div className="grid">
          {rows.map((r, i) => (
            <AssetCard key={r.it.nftAddress} row={r} index={i} onOpen={props.onOpen} />
          ))}
        </div>
      ) : (
        <Ledger rows={rows} sort={sort} setSort={setSort} phrase={props.phrase} onOpen={props.onOpen} />
      )}
    </section>
  );
}

function AssetCard({ row, index, onOpen }: { row: Row; index: number; onOpen: (it: ValuedItem) => void }) {
  const { it, c, series } = row;
  const hasHistory = it.history.length > 0;
  const t = hasHistory ? tone(c.pct) : "";
  return (
    <button className="asset" style={{ animationDelay: `${Math.min(index, 16) * 35}ms` }} onClick={() => onOpen(it)}>
      <span className="art">
        <Art item={it} />
        <span className={`src-tag ${SOURCE[it.source].cls}`} title={SOURCE[it.source].long}>
          {SOURCE[it.source].short}
        </span>
        <CategoryBadge category={it.category} />
      </span>
      <span className="asset-body">
        <span className="asset-name">{it.itemName}</span>
        <span className="asset-meta">{metaLine(it)}</span>
        <span className="asset-foot">
          <span className="asset-value">{usd(it.marketValue)}</span>
          <span className={`asset-change ${t || "flat"}`}>
            {hasHistory ? (
              <>
                {t && <Tri down={t === "down"} />}
                {pct(c.pct).replace(/^[+−]/, "")}
              </>
            ) : (
              "No history"
            )}
          </span>
        </span>
        <span className="asset-spark">
          <Spark series={series} dir={t as "up" | "down" | ""} />
        </span>
      </span>
    </button>
  );
}

function Ledger({
  rows,
  sort,
  setSort,
  phrase,
  onOpen,
}: {
  rows: Row[];
  sort: Sort;
  setSort: (s: Sort) => void;
  phrase: string;
  onOpen: (it: ValuedItem) => void;
}) {
  const th = (key: SortKey, label: string, cls = "") => (
    <th
      className={cls}
      aria-sort={sort.key === key ? (sort.dir === 1 ? "ascending" : "descending") : "none"}
      onClick={() => setSort({ key, dir: sort.key === key ? (sort.dir === 1 ? -1 : 1) : key === "name" ? 1 : -1 })}
    >
      {label}
      <span className="caret">{sort.key === key ? (sort.dir === 1 ? "↑" : "↓") : ""}</span>
    </th>
  );
  const sum = (f: (r: Row) => number | null) => rows.reduce((s, r) => s + (f(r) ?? 0), 0);
  const ins = sum((r) => r.it.insuredValue);
  const mkt = sum((r) => r.it.marketValue);
  const start = sum((r) => r.c.start);
  const chg = sum((r) => r.c.change);

  return (
    <div className="table-wrap">
      <table className="ledger">
        <thead>
          <tr>
            {th("name", "Item")}
            {th("insured", "Insured", "hide-sm")}
            {th("market", "Market")}
            {th("vsInsured", "Vs insured", "hide-sm")}
            {th("change", phrase)}
            {th("pctChange", "%")}
            <th className="hide-sm">Source</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ it, c, vsInsured }) => (
            <tr
              key={it.nftAddress}
              tabIndex={0}
              onClick={() => onOpen(it)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onOpen(it);
                }
              }}
            >
              <td>
                <div className="item-cell">
                  <span className="thumb">
                    <Art item={it} size="thumb" />
                  </span>
                  <span>
                    <span className="item-name">{it.itemName}</span>
                    <span className="item-meta">{metaLine(it)}</span>
                  </span>
                </div>
              </td>
              <td className="hide-sm">{usd(it.insuredValue)}</td>
              <td className="strong">{usd(it.marketValue)}</td>
              <td className={`hide-sm ${tone(vsInsured)}`}>{pct(vsInsured)}</td>
              <td className={it.history.length ? tone(c.change) : "flat"}>
                {it.history.length ? signedUsd(c.change) : "—"}
                {c.partial && it.history.length ? <sup title="Less history than this period">*</sup> : null}
              </td>
              <td className={it.history.length ? tone(c.pct) : "flat"}>{it.history.length ? pct(c.pct) : "—"}</td>
              <td className="hide-sm">
                <span className={`src-chip ${SOURCE[it.source].cls}`}>{SOURCE[it.source].short}</span>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td>
              Total · {rows.length} item{rows.length === 1 ? "" : "s"}
            </td>
            <td className="hide-sm">{usd(ins)}</td>
            <td>{usd(mkt)}</td>
            <td className={`hide-sm ${tone(mkt - ins)}`}>{pct(ins ? mkt / ins - 1 : null)}</td>
            <td className={tone(chg)}>{signedUsd(chg)}</td>
            <td className={tone(chg)}>{pct(start ? chg / start : null)}</td>
            <td className="hide-sm" />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
