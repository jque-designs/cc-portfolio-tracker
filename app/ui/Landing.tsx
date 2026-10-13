"use client";
import { useEffect, useState } from "react";
import { IconArrow } from "./icons";
import { short } from "./model";
import { Stripes } from "./Stripes";

const tcg = (id: number) => `https://tcgplayer-cdn.tcgplayer.com/product/${id}_400w.jpg`;

const FAN = [
  {
    key: "a",
    img: tcg(502558),
    art: "art-fire",
    label: ["2023 Pokémon 151", "Charizard ex #006"],
    grade: "10",
    tag: ["Alt", "$162.50"],
  },
  {
    key: "box",
    img: "https://d1xpxki1g4htqu.cloudfront.net/nvCEaZCOVJYAQ0ppu3rv3rWn6vypQoHZlF5SwL2eg68",
    art: "art-box",
    tag: ["TCG", "$303.71"],
  },
  {
    key: "b",
    img: tcg(453509),
    art: "art-sea",
    label: ["2022 One Piece OP01", "Monkey.D.Luffy #024"],
    grade: "10",
    tag: ["Alt", "$188.00"],
  },
];

function FanArt({ src, art, mounted }: { src: string; art: string; mounted: boolean }) {
  const [ok, setOk] = useState(true);
  return (
    <span className={`slab-art ${art}`}>
      {art === "art-box" && (
        <span className="box-face">
          <span>ME01</span>
          <small>Booster Box</small>
        </span>
      )}
      {mounted && ok && <img src={src} alt="" onError={() => setOk(false)} />}
    </span>
  );
}

export function Landing({
  onOpen,
  onDemo,
  lastWallet,
  error,
}: {
  onOpen: (wallet: string) => void;
  onDemo: () => void;
  lastWallet: string | null;
  error: string | null;
}) {
  const [wallet, setWallet] = useState("");
  // Images only after hydration, so a failed load is caught and the drawn art stays.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <main className="landing wrap">
      <section className="hero">
        <Stripes from={34} gap={12} />
        <div className="hero-copy">
          <div className="eyebrow">For Collector Crypt vaults</div>
          <h1>
            What your vault is <em>really</em> worth.
          </h1>
          <p className="lede">
            Paste a Solana wallet to price every Collector Crypt slab, card and sealed box at today&rsquo;s market, and see how
            it moved over the day, week, month or year.
          </p>
          <form
            className="hero-form"
            onSubmit={(e) => {
              e.preventDefault();
              onOpen(wallet.trim());
            }}
          >
            <input
              value={wallet}
              onChange={(e) => setWallet(e.target.value)}
              placeholder="Solana wallet address"
              aria-label="Solana wallet address"
              spellCheck={false}
              autoComplete="off"
            />
            <button className="btn-primary">
              Open vault <IconArrow width={16} height={16} />
            </button>
          </form>
          {error && <p className="hero-error">{error}</p>}
          <p className="hero-alt">
            No wallet handy?{" "}
            <button type="button" onClick={onDemo}>
              Open a sample vault
            </button>
            {lastWallet && (
              <>
                <span className="sep">·</span>
                <button type="button" onClick={() => onOpen(lastWallet)}>
                  Reopen <span className="mono">{short(lastWallet)}</span>
                </button>
              </>
            )}
          </p>
        </div>
        <div className="fan" aria-hidden>
          {FAN.map((s) => (
            <div key={s.key} className={`slab ${s.key}`}>
              {s.label && (
                <span className="slab-label">
                  <span>
                    {s.label[0]}
                    <br />
                    {s.label[1]}
                  </span>
                  <span className="grade">
                    <small>Gem Mt</small>
                    <b>{s.grade}</b>
                  </span>
                </span>
              )}
              <FanArt src={s.img} art={s.art} mounted={mounted} />
              <span className="slab-tag">
                <i>{s.tag[0]}</i>
                {s.tag[1]}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="sources" aria-label="Where prices come from">
        <div>
          <div className="src-k">
            <span className="dot src-alt" /> Graded slabs
          </div>
          <div className="src-v">
            <b>alt.xyz</b> Alt Value, or the median of the last three sales in that grade.
          </div>
        </div>
        <div>
          <div className="src-k">
            <span className="dot src-tcg" /> Sealed product
          </div>
          <div className="src-v">
            <b>TCGplayer</b> market price, matched by set code and box type.
          </div>
        </div>
        <div>
          <div className="src-k">
            <span className="dot src-ins" /> Everything else
          </div>
          <div className="src-v">
            <b>Insured value</b> from Collector Crypt, flagged so you know.
          </div>
        </div>
      </section>
    </main>
  );
}
