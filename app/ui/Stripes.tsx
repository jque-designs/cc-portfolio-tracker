const BANDS = ["var(--stripe-1)", "var(--stripe-2)", "var(--stripe-3)", "var(--stripe-4)", "var(--stripe-5)"];

/**
 * The retro five-band sash from Collector Crypt's new look, drawn in a 100×100 box.
 * Bands run diagonally; `from` sets how far the first band sits from the top-right corner
 * (higher is closer), `gap` their spacing, and `rise` mirrors them to run bottom-left to top-right.
 */
export function Sash({ from = 30, gap = 12, rise = false }: { from?: number; gap?: number; rise?: boolean }) {
  const w = gap / Math.SQRT2 + 0.25;
  return (
    <g transform={rise ? "translate(100 0) scale(-1 1)" : undefined}>
      {BANDS.map((c, i) => {
        const a = from + i * gap;
        return <path key={i} d={`M${a - 30} -30L130 ${130 - a}`} stroke={c} strokeWidth={w} fill="none" />;
      })}
    </g>
  );
}

export function Stripes({ className = "", from, gap }: { className?: string; from?: number; gap?: number }) {
  return (
    <div className={`stripes ${className}`} aria-hidden>
      <svg viewBox="0 0 100 100" preserveAspectRatio="xMaxYMin slice">
        <Sash from={from} gap={gap} />
      </svg>
    </div>
  );
}

export function BrandMark() {
  return (
    <svg viewBox="0 0 100 100" aria-hidden>
      <rect width="100" height="100" fill="#141518" />
      <Sash from={-24} gap={12} rise />
    </svg>
  );
}

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const AVATAR_BG = ["#141518", "#dcd9d4", "#1d2a3f", "#3b1a12", "#22302a"];

/** A wallet's avatar: the house sash, turned, shifted and backed differently per address. */
export function Identicon({ seed }: { seed: string }) {
  const h = hash(seed);
  const bg = AVATAR_BG[h % AVATAR_BG.length];
  const turn = ((h >>> 3) % 4) * 90;
  const from = 6 + ((h >>> 5) % 34);
  const gap = 9 + ((h >>> 11) % 5);
  const r = 9 + ((h >>> 14) % 8);
  const light = bg === "#dcd9d4";
  return (
    <svg viewBox="0 0 100 100" aria-hidden>
      <rect width="100" height="100" fill={bg} />
      <g transform={`rotate(${turn} 50 50)`}>
        <Sash from={from} gap={gap} />
        <circle cx={26} cy={74} r={r} fill={light ? "#141518" : "#f4f2ee"} />
      </g>
    </svg>
  );
}
