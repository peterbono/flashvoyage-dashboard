/**
 * Server-only helpers for the Travelpayouts Finance API.
 *
 * Centralises auth, in-memory caching, and rollup/slug-grouping logic so
 * that API route handlers stay thin. The in-memory cache survives across
 * warm Vercel Function invocations, matching the pattern in `lib/github.ts`.
 *
 * Token:
 *   - `process.env.TRAVELPAYOUTS_API_TOKEN` — set in Vercel (never committed).
 *   - Sent as `X-Access-Token` header.
 *   - Never logged; redacted in error messages.
 *
 * Partner identifiers (public, OK in code): marker `676421`, TRS `463418`.
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const API_BASE = "https://api.travelpayouts.com";
const ACTIONS_ENDPOINT = `${API_BASE}/finance/v2/get_user_actions_affecting_balance`;

/** 15 min — matches the Finance API's "slow-moving" nature. */
const CACHE_TTL_MS = 15 * 60 * 1000;

/** Per-page limit (TP requires `limit`; 100 is the documented max). */
const PAGE_LIMIT = 100;

/** Safety cap on pagination to avoid runaway loops on malformed responses. */
const MAX_PAGES = 50;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Normalised earning item. Source fields from the Finance API are coerced
 * into predictable types here so downstream callers don't have to guess.
 */
export interface TpEarning {
  /** Opaque action id from Travelpayouts (used for action details). */
  id: string | number | null;
  /** Raw sub_id as returned by TP. Shape: `{wpId}-{slot}-{variant}`. */
  subId: string | null;
  /** EUR amount. Non-EUR rows are currently skipped — see TODO below. */
  amount: number;
  currency: string;
  /** ISO8601 creation timestamp. */
  createdAt: string;
  /** Conversion type (e.g. "sale", "refund"). Free-form per TP. */
  type: string | null;
}

export interface EarningsRollup {
  today: number;
  mtd: number;
  ytd: number;
  currency: string;
  lastUpdated: string;
}

export interface SlugEarnings {
  amount: number;
  conversions: number;
  lastConversion: string | null;
}

// ---------------------------------------------------------------------------
// Token
// ---------------------------------------------------------------------------

/**
 * Read the API token from env. Throws a clear, token-free error if missing.
 * Callers (API routes) are expected to convert this into a 503 response.
 */
function getToken(): string {
  const token = process.env.TRAVELPAYOUTS_API_TOKEN ?? "";
  if (!token) {
    throw new Error("TRAVELPAYOUTS_API_TOKEN not configured");
  }
  return token;
}

// ---------------------------------------------------------------------------
// In-memory cache (survives across warm Vercel invocations)
// ---------------------------------------------------------------------------

interface CacheEntry<T> {
  data: T;
  expiry: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

function cacheGet<T>(key: string): T | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiry) {
    cache.delete(key);
    return undefined;
  }
  return entry.data as T;
}

function cacheSet<T>(key: string, data: T, ttlMs: number = CACHE_TTL_MS): void {
  cache.set(key, { data, expiry: Date.now() + ttlMs });
}

/**
 * Invalidate every cached TP entry. Exported so route handlers can wire
 * `?bypass-cache=1` without reaching into the Map directly.
 */
export function invalidateTpCache(): void {
  cache.clear();
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format a Date as YYYY-MM-DD (UTC) — TP expects this shape. */
function toYmd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Redact any accidental token echo in an error message. The TP token is a
 * 32-char hex-ish string; we defensively mask anything that resembles one.
 */
function redact(msg: string): string {
  return msg.replace(/[a-f0-9]{24,}/gi, "[redacted]");
}

interface RawActionItem {
  // TP is inconsistent about casing / presence. Keep everything optional.
  id?: string | number;
  action_id?: string | number;
  sub_id?: string | null;
  subid?: string | null;
  amount?: string | number;
  profit?: string | number;
  currency?: string;
  created_at?: string;
  created?: string;
  date?: string;
  type?: string;
  action_type?: string;
}

interface RawActionsResponse {
  has_actions?: boolean;
  count?: number;
  total_profit?: string | number;
  /** Observed shape in probes: items live under `actions`. Keep fallbacks. */
  actions?: RawActionItem[];
  items?: RawActionItem[];
  data?: RawActionItem[];
}

/**
 * Coerce one raw TP item into our normalised `TpEarning` shape.
 * Non-EUR rows are preserved at the type level but callers should check
 * `currency` — we currently sum EUR-only (see TODO in `getEarningsRollup`).
 */
function normaliseItem(raw: RawActionItem): TpEarning {
  const amountRaw = raw.amount ?? raw.profit ?? 0;
  const amount =
    typeof amountRaw === "number" ? amountRaw : parseFloat(String(amountRaw)) || 0;

  return {
    id: raw.id ?? raw.action_id ?? null,
    subId: raw.sub_id ?? raw.subid ?? null,
    amount,
    currency: (raw.currency ?? "EUR").toUpperCase(),
    createdAt: raw.created_at ?? raw.created ?? raw.date ?? "",
    type: raw.action_type ?? raw.type ?? null,
  };
}

/**
 * One page of the actions endpoint. `X-Access-Token` auth. Never logs token.
 */
async function fetchActionsPage(
  dateFrom: string,
  dateTo: string,
  offset: number
): Promise<RawActionItem[]> {
  const token = getToken();

  const url = new URL(ACTIONS_ENDPOINT);
  url.searchParams.set("date_from", dateFrom);
  url.searchParams.set("date_to", dateTo);
  url.searchParams.set("limit", String(PAGE_LIMIT));
  url.searchParams.set("offset", String(offset));

  const res = await fetch(url.toString(), {
    headers: {
      "X-Access-Token": token,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    // Deliberately do NOT include the URL query (which is token-free anyway)
    // or the token in the error. Downstream error renderers may display this.
    throw new Error(
      redact(`Travelpayouts API error: ${res.status} ${res.statusText}`)
    );
  }

  const json = (await res.json()) as RawActionsResponse;

  // Empty account path — when TP returns has_actions:false, no items array.
  if (json.has_actions === false) return [];

  return json.actions ?? json.items ?? json.data ?? [];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface FetchTpEarningsOpts {
  from?: Date;
  to?: Date;
}

/**
 * Fetch raw conversion items from the Travelpayouts Finance API.
 *
 * Defaults to year-to-date (1 Jan current year → now). Results are cached
 * under a date-range key for 15 minutes.
 *
 * The account currently has 0 conversions (see /tmp/travelpayouts/api_map.md);
 * this function will return `[]` cleanly in that case.
 */
export async function fetchTpEarnings(
  opts?: FetchTpEarningsOpts
): Promise<TpEarning[]> {
  const now = new Date();
  const from = opts?.from ?? new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  const to = opts?.to ?? now;

  const dateFrom = toYmd(from);
  const dateTo = toYmd(to);
  const cacheKey = `tp:actions:${dateFrom}:${dateTo}`;

  const cached = cacheGet<TpEarning[]>(cacheKey);
  if (cached !== undefined) return cached;

  const all: TpEarning[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const offset = page * PAGE_LIMIT;
    const batch = await fetchActionsPage(dateFrom, dateTo, offset);
    if (batch.length === 0) break;
    for (const raw of batch) {
      all.push(normaliseItem(raw));
    }
    if (batch.length < PAGE_LIMIT) break;
  }

  cacheSet(cacheKey, all);
  return all;
}

/**
 * Compute today / month-to-date / year-to-date totals in EUR.
 *
 * Non-EUR entries are skipped (with a console.warn TODO marker) — the
 * FlashVoyage account is EUR-denominated, but if TP ever returns multi-
 * currency rows we want explicit handling rather than silent mis-totals.
 */
export async function getEarningsRollup(): Promise<EarningsRollup> {
  const cacheKey = "tp:rollup";
  const cached = cacheGet<EarningsRollup>(cacheKey);
  if (cached !== undefined) return cached;

  // YTD window covers today + MTD + YTD in a single fetch.
  const items = await fetchTpEarnings();

  const now = new Date();
  const ymdToday = toYmd(now);
  const monthKey = ymdToday.slice(0, 7); // "YYYY-MM"
  const yearKey = ymdToday.slice(0, 4);

  let today = 0;
  let mtd = 0;
  let ytd = 0;

  for (const item of items) {
    if (item.currency !== "EUR") {
      // TODO(H2): multi-currency normalisation (FX rates). For now, skip.
      console.warn(
        `[travelpayouts] skipping non-EUR earning (currency=${item.currency})`
      );
      continue;
    }
    const createdYmd = (item.createdAt ?? "").slice(0, 10);
    if (!createdYmd) continue;

    if (createdYmd.slice(0, 4) === yearKey) ytd += item.amount;
    if (createdYmd.slice(0, 7) === monthKey) mtd += item.amount;
    if (createdYmd === ymdToday) today += item.amount;
  }

  const rollup: EarningsRollup = {
    today: Math.round(today * 100) / 100,
    mtd: Math.round(mtd * 100) / 100,
    ytd: Math.round(ytd * 100) / 100,
    currency: "EUR",
    lastUpdated: new Date().toISOString(),
  };

  cacheSet(cacheKey, rollup);
  return rollup;
}

/**
 * Group YTD earnings by WordPress post id, extracted from `sub_id`.
 *
 * Sub_id contract: `{wpId}-{slot}-{variant}` (set by the content repo
 * when creating tracked links). The leading numeric segment is the wpId.
 * Anything that doesn't match falls into the `_unattributed` bucket so
 * we don't silently drop revenue.
 *
 * Returns a map keyed by wpId (stringified) → aggregated stats.
 */
export async function getEarningsBySlug(): Promise<
  Record<string, SlugEarnings>
> {
  const cacheKey = "tp:by-slug";
  const cached = cacheGet<Record<string, SlugEarnings>>(cacheKey);
  if (cached !== undefined) return cached;

  const items = await fetchTpEarnings();
  const out: Record<string, SlugEarnings> = {};
  const wpIdRe = /^(\d+)-/;

  for (const item of items) {
    if (item.currency !== "EUR") {
      // Same TODO as rollup — skip non-EUR for now.
      continue;
    }
    const sub = item.subId ?? "";
    const match = sub.match(wpIdRe);
    const key = match ? match[1] : "_unattributed";

    const bucket = out[key] ?? { amount: 0, conversions: 0, lastConversion: null };
    bucket.amount += item.amount;
    bucket.conversions += 1;
    if (
      item.createdAt &&
      (bucket.lastConversion === null || item.createdAt > bucket.lastConversion)
    ) {
      bucket.lastConversion = item.createdAt;
    }
    out[key] = bucket;
  }

  // Round each amount to 2 dp for stable JSON responses.
  for (const key of Object.keys(out)) {
    out[key].amount = Math.round(out[key].amount * 100) / 100;
  }

  cacheSet(cacheKey, out);
  return out;
}
