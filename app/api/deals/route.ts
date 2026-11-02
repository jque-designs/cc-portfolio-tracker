import { NextResponse } from "next/server";
import { ORDERS, type Order, scanDeals } from "@/lib/deals";
import { num } from "@/lib/http";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** One page of live Collector Crypt listings, each priced against its comps. */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const order = (ORDERS as readonly string[]).includes(q.get("order") ?? "") ? (q.get("order") as Order) : "listedDateDesc";
  try {
    const page = await scanDeals({
      cursor: q.get("cursor") ?? undefined,
      step: num(q.get("step")) ?? 40,
      min: num(q.get("min")) ?? undefined,
      max: num(q.get("max")) ?? undefined,
      search: q.get("q")?.slice(0, 80) ?? undefined,
      order,
    });
    return NextResponse.json(page, { headers: { "cache-control": "s-maxage=120, stale-while-revalidate=300" } });
  } catch (e) {
    console.error("deals failed:", (e as Error).message);
    const error =
      (e as Error).name === "AbortError"
        ? "Collector Crypt didn't answer in time. Try again in a minute."
        : "Couldn't read Collector Crypt's listings just now. Try again in a minute.";
    return NextResponse.json({ error }, { status: 502 });
  }
}
