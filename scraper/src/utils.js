// Shared HTTP + retry + on-disk cache helpers.
// Kept dependency-free so `npm install` has nothing to do.

import { createHash } from 'node:crypto';
import { mkdirSync, existsSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = join(__dirname, '..', '.cache');
mkdirSync(CACHE_DIR, { recursive: true });

const UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) ' +
  'Chrome/125.0 Safari/537.36';

const DEFAULT_HEADERS = {
  'User-Agent': UA,
  'Accept': 'application/json, text/html;q=0.9, */*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9'
};

export const FIVE_MINUTES = 5 * 60 * 1000;
export const ONE_HOUR = 60 * 60 * 1000;

function cacheKey(url, opts = {}) {
  const h = createHash('sha1');
  h.update(url);
  if (opts.body) h.update(JSON.stringify(opts.body));
  if (opts.method) h.update(opts.method);
  return h.digest('hex');
}

function cachePath(key) {
  return join(CACHE_DIR, key + '.bin');
}

function readCache(key, maxAgeMs) {
  const p = cachePath(key);
  if (!existsSync(p)) return null;
  const age = Date.now() - statSync(p).mtimeMs;
  if (age > maxAgeMs) return null;
  try {
    return readFileSync(p);
  } catch {
    return null;
  }
}

function writeCache(key, buf) {
  try { writeFileSync(cachePath(key), buf); } catch { /* best effort */ }
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * fetchRaw(url, opts) — raw fetch with retry/backoff, timeout, and on-disk cache.
 * Returns a Buffer on 2xx, throws otherwise.
 *
 * opts: { method, body, headers, timeoutMs, retries, cacheMs }
 */
export async function fetchRaw(url, opts = {}) {
  const {
    method = 'GET',
    body,
    headers = {},
    timeoutMs = 20_000,
    retries = 3,
    cacheMs = FIVE_MINUTES
  } = opts;

  const key = cacheKey(url, { body, method });
  if (cacheMs > 0) {
    const hit = readCache(key, cacheMs);
    if (hit) return hit;
  }

  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method,
        body,
        headers: { ...DEFAULT_HEADERS, ...headers },
        signal: ctl.signal,
        redirect: 'follow'
      });
      clearTimeout(t);
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        const err = new Error(`HTTP ${res.status} ${res.statusText} — ${url}\n${text.slice(0, 200)}`);
        err.status = res.status;
        // Don't retry 4xx except 408/429
        if (res.status >= 400 && res.status < 500 && res.status !== 408 && res.status !== 429) {
          throw err;
        }
        lastErr = err;
      } else {
        const buf = Buffer.from(await res.arrayBuffer());
        if (cacheMs > 0) writeCache(key, buf);
        return buf;
      }
    } catch (e) {
      clearTimeout(t);
      lastErr = e;
    }
    if (attempt < retries) {
      const delay = Math.min(16_000, 2000 * 2 ** attempt);
      await sleep(delay);
    }
  }
  throw lastErr ?? new Error('unknown fetch error');
}

export async function fetchJson(url, opts = {}) {
  const buf = await fetchRaw(url, opts);
  const txt = buf.toString('utf8');
  try {
    return JSON.parse(txt);
  } catch (e) {
    throw new Error(`Invalid JSON from ${url}: ${e.message}\n${txt.slice(0, 200)}`);
  }
}

export async function fetchText(url, opts = {}) {
  const buf = await fetchRaw(url, opts);
  return buf.toString('utf8');
}

/** Run `items` through `worker` with at most `concurrency` in flight. */
export async function pMap(items, worker, concurrency = 8) {
  const out = new Array(items.length);
  let i = 0;
  const runners = new Array(Math.min(concurrency, items.length)).fill(0).map(async () => {
    while (true) {
      const idx = i++;
      if (idx >= items.length) return;
      try { out[idx] = await worker(items[idx], idx); }
      catch (e) { out[idx] = { __error: e }; }
    }
  });
  await Promise.all(runners);
  return out;
}

export function requireEnv(name) {
  const v = process.env[name];
  return v && v.trim() ? v : null;
}
