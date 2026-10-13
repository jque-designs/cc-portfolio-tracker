import { HttpError, PublicError, fetchJson } from "./http";

/**
 * The Solana RPC endpoint. HELIUS_API_KEY may hold the bare key or the whole
 * "https://mainnet.helius-rpc.com/?api-key=..." URL that Helius's dashboard shows.
 */
export function rpcUrl(): string | null {
  const custom = process.env.SOLANA_RPC_URL?.trim();
  if (custom) return custom;
  const key = process.env.HELIUS_API_KEY?.trim();
  if (!key) return null;
  if (/^https?:\/\//i.test(key)) return key;
  return `https://mainnet.helius-rpc.com/?api-key=${encodeURIComponent(key)}`;
}

export function isValidSolanaAddress(s: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s);
}

/**
 * Update authorities and collection keys CollectorCrypt mints under. Older items are pNFTs
 * with the symbol "COLLECTOR"; items vaulted since mid-2026 are Metaplex Core assets with no
 * symbol, Arweave metadata and CollectorCrypt's authority on them (checked on-chain 2026-10-13).
 */
export const CC_AUTHORITIES = new Set([
  "CCryptUfeFSZ3Fgc9FLeKrhLVAP67FSqi1GuVoj9CRac", // Core assets
  "DQPERZ9e86pNJ4mhUnCEP8V75yxZofsipoVrRWT5Wdxd", // legacy pNFTs
]);

export interface DasAsset {
  id: string;
  burnt?: boolean;
  content?: { json_uri?: string; metadata?: { name?: string; symbol?: string } };
  grouping?: { group_key: string; group_value: string }[];
  authorities?: { address: string }[];
}

export function isCollectorCryptAsset(a: DasAsset): boolean {
  if (a.burnt) return false;
  if (a.content?.metadata?.symbol?.toUpperCase() === "COLLECTOR") return true;
  if (a.content?.json_uri?.includes("collectorcrypt")) return true;
  if (a.grouping?.some((g) => g.group_key === "collection" && CC_AUTHORITIES.has(g.group_value))) return true;
  return a.authorities?.some((x) => CC_AUTHORITIES.has(x.address)) ?? false;
}

export interface WalletScan {
  /** Every asset the wallet holds. */
  held: Set<string>;
  /** The ones that look like CollectorCrypt items; the caller confirms them against CollectorCrypt. */
  matched: string[];
}

export async function scanWallet(owner: string): Promise<WalletScan> {
  const url = rpcUrl();
  if (!url) throw new Error("No Solana RPC configured");
  const held = new Set<string>();
  const matched: string[] = [];
  for (let page = 1; page <= 50; page++) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let r: any;
    try {
      r = await fetchJson(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: "cc",
          method: "getAssetsByOwner",
          params: { ownerAddress: owner, page, limit: 1000, displayOptions: { showFungible: false } },
        }),
      });
    } catch (e) {
      if (e instanceof HttpError && (e.status === 401 || e.status === 403))
        throw new PublicError("The Solana RPC rejected this site's API key. Check HELIUS_API_KEY in the Vercel project settings.");
      if (e instanceof HttpError && e.status === 429)
        throw new PublicError("The Solana RPC is rate limiting this site right now. Try again in a minute.");
      throw e;
    }
    if (r.error) throw new Error(`RPC error: ${r.error.message ?? JSON.stringify(r.error)}`);
    const items: DasAsset[] = r.result?.items ?? [];
    for (const a of items) {
      if (a.burnt) continue;
      held.add(a.id);
      if (isCollectorCryptAsset(a)) matched.push(a.id);
    }
    if (items.length < 1000) break;
  }
  return { held, matched };
}
