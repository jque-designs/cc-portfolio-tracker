import { NextResponse } from "next/server";
import { PublicError } from "@/lib/http";
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
    // Only messages written for visitors leave the server; the rest go to the Vercel logs.
    console.error("portfolio failed:", (e as Error).message);
    const error =
      e instanceof PublicError
        ? e.message
        : (e as Error).name === "AbortError"
          ? "A price source didn't answer in time. Try again in a minute."
          : "Something went wrong while pricing this wallet. Try again in a minute.";
    return NextResponse.json({ error }, { status: 502 });
  }
}
