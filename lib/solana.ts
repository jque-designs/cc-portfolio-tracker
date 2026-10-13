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

interface DasAsset {
  id: string;
  burnt?: boolean;
  content?: { json_uri?: string; metadata?: { name?: string; symbol?: string } };
  grouping?: { group_key: string; group_value: string }[];
}

/**
 * Mints in the wallet that look like CollectorCrypt items. CollectorCrypt NFTs carry the
 * symbol "COLLECTOR" (seen on-chain for the ME01 booster box); every candidate is then
 * confirmed against CollectorCrypt's own catalogue by the caller.
 */
export async function getCollectorCryptMints(owner: string): Promise<string[]> {
  const url = rpcUrl();
  if (!url) throw new Error("No Solana RPC configured");
  const mints: string[] = [];
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
      const sym = a.content?.metadata?.symbol?.toUpperCase() ?? "";
      const uri = a.content?.json_uri ?? "";
      if (sym === "COLLECTOR" || uri.includes("collectorcrypt")) mints.push(a.id);
    }
    if (items.length < 1000) break;
  }
  return mints;
}
