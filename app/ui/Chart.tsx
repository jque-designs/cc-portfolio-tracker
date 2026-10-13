"use client";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { PricePoint } from "@/lib/types";
import { compactUsd, pct, signedUsd, tone, usd } from "../format";

const PAD = { t: 18, r: 10, b: 8, l: 0 };

function niceTicks(lo: number, hi: number, n = 3) {
  const raw = (hi - lo) / n;
  if (!(raw > 0)) return { ticks: [], step: 0 };
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const ticks: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) ticks.push(v);
  return { ticks, step };
}

function dateFmt(span: number) {
  if (span <= 2 * 86_400_000) return (t: number) => new Date(t).toLocaleTimeString("en-US", { hour: "numeric" });
  if (span <= 200 * 86_400_000) return (t: number) => new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return (t: number) => new Date(t).toLocaleDateString("en-US", { month: "short", year: "2-digit" }).replace(" ", " '");
}

/** Area chart drawn at the container's real pixel width, with a start line and a scrubbing tooltip. */
export function Chart({ series, label }: { series: PricePoint[]; label: string }) {
  const box = useRef<HTMLDivElement>(null);
  // Size comes from CSS (.chart-box), so phones and the item sheet get shorter charts.
  const [{ w, h: height }, setSize] = useState({ w: 0, h: 0 });
  const [hover, setHover] = useState<number | null>(null);
  const gid = `g${useId().replace(/[^a-z0-9]/gi, "")}`;

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    setSize({ w: el.clientWidth, h: el.clientHeight });
    const ro = new ResizeObserver(([e]) => setSize({ w: Math.round(e.contentRect.width), h: Math.round(e.contentRect.height) }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const geo = useMemo(() => {
    if (w <= 0 || height <= 0 || series.length < 2) return null;
    const t0 = series[0].t;
    const t1 = series[series.length - 1].t;
    const vs = series.map((p) => p.v);
    let lo = Math.min(...vs);
    let hi = Math.max(...vs);
    if (hi - lo < Math.max(1, hi * 0.01)) {
      const mid = (hi + lo) / 2;
      const d = Math.max(1, mid * 0.02);
      lo = mid - d;
      hi = mid + d;
    }
    const padV = (hi - lo) * 0.14;
    lo -= padV;
    hi += padV;
    const x = (t: number) => PAD.l + ((t - t0) / (t1 - t0 || 1)) * (w - PAD.l - PAD.r);
    const y = (v: number) => PAD.t + (1 - (v - lo) / (hi - lo)) * (height - PAD.t - PAD.b);
    const line = series.map((p, i) => `${i ? "L" : "M"}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join("");
    const area = `${line}L${x(t1).toFixed(1)},${height}L${x(t0).toFixed(1)},${height}Z`;
    const fmt = dateFmt(t1 - t0);
    const axis = [0, 1 / 3, 2 / 3, 1].map((k) => fmt(t0 + k * (t1 - t0)));
    return { x, y, line, area, t0, t1, axis, ...niceTicks(lo, hi) };
  }, [series, w, height]);

  const onMove = (e: React.PointerEvent) => {
    if (!geo || !box.current) return;
    const r = box.current.getBoundingClientRect();
    const t = geo.t0 + ((e.clientX - r.left) / r.width) * (geo.t1 - geo.t0);
    let best = 0;
    for (let i = 1; i < series.length; i++) if (Math.abs(series[i].t - t) < Math.abs(series[best].t - t)) best = i;
    setHover(best);
  };

  const start = series[0]?.v ?? 0;
  const last = series[series.length - 1];
  const hp = hover !== null ? series[hover] : null;
  const drawKey = `${series[0]?.t}-${series.length}-${Math.round(last?.v ?? 0)}`;

  return (
    <div className="chart">
      <div
        ref={box}
        className="chart-box"
        onPointerMove={onMove}
        onPointerDown={onMove}
        onPointerLeave={() => setHover(null)}
        role="img"
        aria-label={label}
      >
        {geo && (
          <svg width={w} height={height} viewBox={`0 0 ${w} ${height}`}>
            <defs>
              <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor="var(--accent)" stopOpacity="0.26" />
                <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
              </linearGradient>
            </defs>
            {geo.ticks.map((v) => (
              <g key={v} className="grid-line">
                <line x1={0} x2={w} y1={geo.y(v)} y2={geo.y(v)} />
                <text x={2} y={geo.y(v) - 5}>
                  {geo.step < 100 ? usd(v, 0) : compactUsd(v)}
                </text>
              </g>
            ))}
            <line className="start-line" x1={0} x2={w} y1={geo.y(start)} y2={geo.y(start)} />
            <path key={`a${drawKey}`} className="area" d={geo.area} fill={`url(#${gid})`} />
            <path key={`l${drawKey}`} className="draw" d={geo.line} pathLength={1} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinejoin="round" />
            {last && !hp && (
              <g transform={`translate(${geo.x(last.t)} ${geo.y(last.v)})`}>
                <circle className="halo" r={10} fill="var(--accent)" />
                <circle r={4} fill="var(--accent)" stroke="var(--panel)" strokeWidth={2} />
              </g>
            )}
            {hp && (
              <>
                <line className="cross" x1={geo.x(hp.t)} x2={geo.x(hp.t)} y1={6} y2={height} />
                <circle cx={geo.x(hp.t)} cy={geo.y(hp.v)} r={4.5} fill="var(--accent)" stroke="var(--panel)" strokeWidth={2} />
              </>
            )}
          </svg>
        )}
        {geo && hp && (
          <div className="tip" style={{ left: Math.min(Math.max(geo.x(hp.t), 78), w - 78) }}>
            <span className="d">{new Date(hp.t).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
            <b>{usd(hp.v)}</b>
            {hover! > 0 && <span className={tone(hp.v - start)}> {signedUsd(hp.v - start)} · {pct(start ? hp.v / start - 1 : null)}</span>}
          </div>
        )}
      </div>
      {geo ? (
        <div className="axis">
          {geo.axis.map((a, i) => (
            <span key={i} className="label">
              {a}
            </span>
          ))}
        </div>
      ) : (
        series.length < 2 && <div className="chart-empty">No price history for this selection yet.</div>
      )}
    </div>
  );
}

/** Tiny trend line for an asset card. */
export function Spark({ series, dir }: { series: PricePoint[]; dir: "up" | "down" | "" }) {
  const gid = `s${useId().replace(/[^a-z0-9]/gi, "")}`;
  const color = dir === "up" ? "var(--up)" : dir === "down" ? "var(--down)" : "var(--ink-3)";
  if (series.length < 2) {
    return (
      <svg viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden>
        <line x1="0" x2="100" y1="20" y2="20" stroke="var(--line-2)" strokeDasharray="2 3" vectorEffect="non-scaling-stroke" />
      </svg>
    );
  }
  const t0 = series[0].t;
  const t1 = series[series.length - 1].t;
  const vs = series.map((p) => p.v);
  const lo = Math.min(...vs);
  const hi = Math.max(...vs);
  const span = hi - lo || 1;
  const x = (t: number) => ((t - t0) / (t1 - t0 || 1)) * 100;
  const y = (v: number) => 26 - ((v - lo) / span) * 22;
  const line = series.map((p, i) => `${i ? "L" : "M"}${x(p.t).toFixed(2)},${y(p.v).toFixed(2)}`).join("");
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.22" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line}L100,30L0,30Z`} fill={`url(#${gid})`} />
      <path d={line} fill="none" stroke={color} strokeWidth={1.5} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  );
}
