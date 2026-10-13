"use client";
import { useEffect, useState } from "react";
import { BannerHead } from "./Banner";
import { IconRefresh } from "./icons";
import { Stripes } from "./Stripes";

const STEPS = [
  "Reading the wallet on Solana",
  "Finding Collector Crypt items",
  "Pricing graded slabs on alt.xyz",
  "Pricing sealed product on TCGplayer",
  "Pulling price history",
];

export function LoadingVault({ wallet }: { wallet: string }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((n) => Math.min(n + 1, STEPS.length - 1)), 1800);
    return () => clearInterval(id);
  }, []);
  return (
    <main className="vault wrap" aria-busy="true">
      <section className="banner">
        <Stripes from={50} gap={9} />
        <BannerHead wallet={wallet} isDemo={false}>
          <span className="loading-line">
            <span className="dot" />
            <span key={i} className="step">
              {STEPS[i]}…
            </span>
          </span>
        </BannerHead>
        <div className="banner-body">
          <div>
            <span className="label">Market value</span>
            <div className="skel" style={{ width: "min(340px, 80%)", height: 76, marginTop: 12 }} />
            <div className="skel" style={{ width: 190, height: 30, marginTop: 16, borderRadius: 999 }} />
          </div>
          <div className="ledger-lines">
            {[0, 1, 2, 3].map((n) => (
              <div key={n} className="skel" style={{ height: 14, width: `${92 - n * 9}%` }} />
            ))}
          </div>
        </div>
        <div className="chart-wrap">
          <div className="skel" style={{ height: 220, marginTop: 52, borderRadius: 14 }} />
        </div>
      </section>
      <div className="grid" style={{ marginTop: 28 }}>
        {Array.from({ length: 8 }, (_, n) => (
          <div key={n} className="asset skel-card" style={{ animationDelay: `${n * 40}ms` }}>
            <div className="skel" style={{ aspectRatio: "3 / 3.6", borderRadius: 10 }} />
            <div className="skel" style={{ height: 14, marginTop: 14, width: "85%" }} />
            <div className="skel" style={{ height: 10, marginTop: 8, width: "50%" }} />
            <div className="skel" style={{ height: 18, marginTop: 14, width: "40%" }} />
          </div>
        ))}
      </div>
    </main>
  );
}

export function ErrorPanel({ wallet, message, onRetry, onDemo }: { wallet: string; message: string; onRetry: () => void; onDemo: () => void }) {
  return (
    <main className="vault wrap">
      <section className="banner">
        <Stripes from={50} gap={9} />
        <BannerHead wallet={wallet} isDemo={false} />
        <div className="error-body">
          <h3>This vault didn&rsquo;t open.</h3>
          <p>{message}</p>
          <div className="link-row">
            <button className="btn-ghost" onClick={onRetry}>
              <IconRefresh width={14} height={14} /> Try again
            </button>
            <button className="btn-ghost" onClick={onDemo}>
              Open the sample vault
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}

export function EmptyVault() {
  return (
    <div className="empty">
      <svg className="empty-slab" viewBox="0 0 120 170" aria-hidden>
        <rect x="6" y="6" width="108" height="158" rx="12" fill="none" stroke="var(--line-2)" strokeWidth="2" strokeDasharray="5 6" />
        <rect x="18" y="18" width="84" height="22" rx="5" fill="none" stroke="var(--line-2)" strokeWidth="2" />
        <rect x="18" y="50" width="84" height="102" rx="7" fill="var(--panel-2)" />
        <path d="M44 101h32M60 85v32" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" />
      </svg>
      <h3>An empty vault.</h3>
      <p>
        This wallet doesn&rsquo;t hold any Collector Crypt cards or sealed product right now. If you just bought or redeemed
        something, it can take a few minutes to show up on-chain.
      </p>
    </div>
  );
}
