const UA = "cc-portfolio-tracker/0.1 (+https://github.com/jque-designs/cc-portfolio-tracker)";

/** Origin and path only. Query strings carry API keys (Helius puts its key there), so they never go in messages. */
export function safeUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.origin}${u.pathname}`;
  } catch {
    return "(upstream URL)";
  }
}

export class HttpError extends Error {
  /** First 200 characters of the response body, for server-side debugging only. */
  public body: string;
  constructor(public status: number, url: string, body: string) {
    super(`HTTP ${status} from ${safeUrl(url)}`);
    this.body = body.slice(0, 200);
  }
}

/** An error whose message is written for the person using the site and is safe to show them. */
export class PublicError extends Error {}

/** fetch + JSON with a timeout, an honest user-agent and a few retries on 429/5xx. */
export async function fetchJson<T>(
  url: string,
  init: RequestInit & { timeoutMs?: number; retries?: number; revalidate?: number } = {},
): Promise<T> {
  const { timeoutMs = 20_000, retries = 2, revalidate, ...rest } = init;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        ...rest,
        headers: { accept: "application/json", "user-agent": UA, ...(rest.headers || {}) },
        signal: ctrl.signal,
        ...(revalidate !== undefined ? { next: { revalidate } } : { cache: "no-store" }),
      } as RequestInit);
      if (res.ok) return (await res.json()) as T;
      const body = await res.text();
      lastErr = new HttpError(res.status, url, body);
      if (res.status !== 429 && res.status < 500) throw lastErr;
    } catch (e) {
      lastErr = e;
      if (e instanceof HttpError && e.status !== 429 && e.status < 500) throw e;
    } finally {
      clearTimeout(timer);
    }
    await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
  }
  throw lastErr;
}

/** Run `fn` over `items` with at most `limit` in flight. Keeps order. */
export async function mapPool<T, R>(items: T[], limit: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return out;
}

export function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}
