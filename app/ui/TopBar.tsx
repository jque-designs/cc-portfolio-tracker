"use client";
import { forwardRef, useEffect, useState } from "react";
import { IconWallet } from "./icons";
import { BrandMark } from "./Stripes";
import { ThemeToggle } from "./ThemeToggle";

export const TopBar = forwardRef<HTMLInputElement, { wallet: string | null; onOpen: ((w: string) => void) | null }>(
  function TopBar({ wallet, onOpen }, ref) {
    const [value, setValue] = useState(wallet ?? "");
    useEffect(() => setValue(wallet ?? ""), [wallet]);

    return (
      <header className="topbar">
        <div className="wrap">
          <a className="brand" href="/" aria-label="Vault Ledger home">
            <span className="brand-mark">
              <BrandMark />
            </span>
            <span className="brand-word">
              <span>Vault</span>
              <span>Ledger</span>
            </span>
          </a>
          <div className="topbar-search">
            {onOpen && (
              <form
                className="wallet-pill"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (value.trim()) onOpen(value.trim());
                }}
              >
                <IconWallet width={16} height={16} className="pill-icon" />
                <input
                  ref={ref}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  onFocus={(e) => e.currentTarget.select()}
                  placeholder="Solana wallet address"
                  aria-label="Solana wallet address"
                  spellCheck={false}
                  autoComplete="off"
                />
                <button className="go">Open</button>
              </form>
            )}
          </div>
          <div className="topbar-actions">
            <ThemeToggle />
          </div>
        </div>
      </header>
    );
  },
);
