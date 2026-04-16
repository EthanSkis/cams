// Small utilities used across sources.
import { setTimeout as wait } from "node:timers/promises";

// Several state 511 sites block non-browser UAs. Pretend to be Chrome.
const DEFAULT_UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

export async function fetchJson(url, opts = {}) {
  return fetchWithRetry(url, { ...opts, accept: "application/json" }).then(
    (r) => r.json(),
  );
}

export async function fetchText(url, opts = {}) {
  return fetchWithRetry(url, opts).then((r) => r.text());
}

export async function fetchWithRetry(url, opts = {}) {
  const {
    retries = 3,
    timeout = 30000,
    accept = "*/*",
    headers = {},
    ...rest
  } = opts;
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeout);
    try {
      const res = await fetch(url, {
        ...rest,
        signal: ctrl.signal,
        headers: {
          "user-agent": DEFAULT_UA,
          accept,
          ...headers,
        },
      });
      clearTimeout(t);
      if (!res.ok) {
        // 503/429 often means rate-limit — retry with a much longer pause.
        const err = new Error(`HTTP ${res.status} for ${url}`);
        err.status = res.status;
        throw err;
      }
      return res;
    } catch (err) {
      clearTimeout(t);
      lastErr = err;
      if (attempt < retries) {
        const slow = err?.status === 503 || err?.status === 429;
        const base = slow ? 5000 : 500;
        await wait(base * Math.pow(2, attempt));
      }
    }
  }
  throw lastErr;
}

// US bounding box (very loose) - includes HI, AK, PR, USVI, GU.
export function inUsBbox(lat, lon) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;
  // Mainland + AK + HI + PR + USVI + GU
  if (lat >= 17 && lat <= 72 && lon >= -180 && lon <= -64) return true;
  // Guam / NMI
  if (lat >= 13 && lat <= 21 && lon >= 144 && lon <= 146) return true;
  return false;
}

export function safeNumber(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

export function slug(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function uniqueBy(arr, keyFn) {
  const seen = new Set();
  const out = [];
  for (const x of arr) {
    const k = keyFn(x);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(x);
  }
  return out;
}

export function logSource(name, count, err) {
  if (err) {
    console.warn(`  [${name}] FAILED: ${err.message || err}`);
  } else {
    console.log(`  [${name}] ${count} cameras`);
  }
}
