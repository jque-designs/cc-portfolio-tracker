import { test } from "node:test";
import assert from "node:assert/strict";
import { HttpError, safeUrl } from "../lib/http";
import { rpcUrl } from "../lib/solana";

const KEY = "00000000-test-key-0000-000000000000";

test("errors never carry the query string, where API keys live", () => {
  const url = `https://mainnet.helius-rpc.com/?api-key=${KEY}`;
  assert.equal(safeUrl(url), "https://mainnet.helius-rpc.com/");
  const e = new HttpError(401, url, `bad key ${KEY}`.replace(KEY, "x"));
  assert.ok(!e.message.includes(KEY));
  assert.ok(!e.message.includes("api-key"));
});

test("HELIUS_API_KEY works as a bare key or as the full dashboard URL", () => {
  const saved = { ...process.env };
  try {
    delete process.env.SOLANA_RPC_URL;
    process.env.HELIUS_API_KEY = ` ${KEY} `;
    assert.equal(rpcUrl(), `https://mainnet.helius-rpc.com/?api-key=${KEY}`);
    process.env.HELIUS_API_KEY = `https://mainnet.helius-rpc.com/?api-key=${KEY}`;
    assert.equal(rpcUrl(), `https://mainnet.helius-rpc.com/?api-key=${KEY}`);
    delete process.env.HELIUS_API_KEY;
    assert.equal(rpcUrl(), null);
  } finally {
    process.env = saved;
  }
});
