import { NextResponse } from "next/server";
import { buildPortfolio } from "@/lib/portfolio";
import { isValidSolanaAddress } from "@/lib/solana";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const wallet = new URL(req.url).searchParams.get("wallet")?.trim() ?? "";
  if (!isValidSolanaAddress(wallet)) {
    return NextResponse.json({ error: "That doesn't look like a Solana wallet address." }, { status: 400 });
  }
  try {
    const portfolio = await buildPortfolio(wallet);
    return NextResponse.json(portfolio, { headers: { "cache-control": "s-maxage=300, stale-while-revalidate=600" } });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
