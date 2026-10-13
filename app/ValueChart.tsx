"use client";
import { useMemo, useRef, useState } from "react";
import type { PricePoint } from "@/lib/types";
import { usd } from "./format";

const W = 800;
const H = 220;
const PAD = { l: 8, r: 8, t: 24, b: 4 };

export function ValueChart({ series }: { series: PricePoint[] }) {
  const ref = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const geo = useMemo(() => {
    if (series.length < 2) return null;
    const t0 = series[0].t;
    const t1 = series[series.length - 1].t;
    const vs = series.map((p) => p.v);
    let lo = Math.min(...vs);
    let hi = Math.max(...vs);
    if (hi === lo) {
      hi += 1;
      lo -= 1;
    }
    const pad = (hi - lo) * 0.1;
    lo -= pad;
    hi += pad;
    const x = (t: number) => PAD.l + ((t - t0) / (t1 - t0 || 1)) * (W - PAD.l - PAD.r);
    const y = (v: number) => PAD.t + (1 - (v - lo) / (hi - lo)) * (H - PAD.t - PAD.b);
    const line = series.map((p, i) => `${i ? "L" : "M"}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join("");
    const area = `${line}L${x(t1)},${H - PAD.b}L${x(t0)},${H - PAD.b}Z`;
    return { x, y, line, area, t0, t1 };
  }, [series]);

  if (!geo) return <p className="muted">Not enough price history for a chart yet.</p>;

  const onMove = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    const t = geo.t0 + ((e.clientX - r.left) / r.width) * (geo.t1 - geo.t0);
    let best = 0;
    for (let i = 1; i < series.length; i++) if (Math.abs(series[i].t - t) < Math.abs(series[best].t - t)) best = i;
    setHover(best);
  };
  const hp = hover !== null ? series[hover] : null;
  const fmtDate = (t: number) => new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "2-digit" });

  return (
    <div className="chart">
      <svg
        ref={ref}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
        role="img"
        aria-label="Portfolio market value over the selected period"
      >
        <path d={geo.area} fill="var(--area)" />
        <path d={geo.line} fill="none" stroke="var(--line)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
        <line x1={PAD.l} x2={W - PAD.r} y1={H - PAD.b} y2={H - PAD.b} stroke="var(--border)" vectorEffect="non-scaling-stroke" />
        {hp && (
          <>
            <line x1={geo.x(hp.t)} x2={geo.x(hp.t)} y1={PAD.t} y2={H - PAD.b} stroke="var(--text-3)" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
            <circle cx={geo.x(hp.t)} cy={geo.y(hp.v)} r={4} fill="var(--line)" stroke="var(--surface)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
          </>
        )}
      </svg>
      <div className="axis">
        <span>{fmtDate(geo.t0)}</span>
        <span>{fmtDate(geo.t1)}</span>
      </div>
      {hp && (
        <div className="tip" style={{ left: `${(geo.x(hp.t) / W) * 100}%` }}>
          {fmtDate(hp.t)} · {usd(hp.v)}
        </div>
      )}
    </div>
  );
}
