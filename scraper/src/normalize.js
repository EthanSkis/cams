// Canonical Camera schema + validator.
//
// Every source adapter returns an array of objects shaped like `CameraInput`.
// `normalize()` fills defaults, validates, de-dupes, drops junk, and returns a
// sorted array of `Camera` records ready to be written to cameras.json.

const FEED_TYPES = new Set(['jpeg', 'mjpeg', 'hls', 'iframe', 'youtube']);

function looksLikeUrl(u) {
  return typeof u === 'string' && /^https?:\/\//i.test(u) && u.length < 2000;
}

function coerceFeeds(feeds) {
  if (!Array.isArray(feeds)) return [];
  const out = [];
  const seen = new Set();
  for (const f of feeds) {
    if (!f || !looksLikeUrl(f.url)) continue;
    const type = FEED_TYPES.has(f.type) ? f.type : guessType(f.url);
    if (!type) continue;
    const key = `${type}|${f.url}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const entry = { type, url: f.url };
    if (type === 'jpeg' && Number.isFinite(f.refreshSec)) {
      entry.refreshSec = Math.max(1, Math.min(600, Math.round(f.refreshSec)));
    }
    if (type === 'jpeg' && entry.refreshSec === undefined) entry.refreshSec = 10;
    out.push(entry);
  }
  return out;
}

function guessType(url) {
  const u = url.toLowerCase();
  if (u.includes('.m3u8')) return 'hls';
  if (u.includes('.mjpg') || u.includes('mjpeg')) return 'mjpeg';
  if (u.includes('youtube.com') || u.includes('youtu.be')) return 'youtube';
  if (/\.(jpg|jpeg|png|webp)(\?|$)/.test(u)) return 'jpeg';
  if (u.includes('/image') || u.includes('snapshot')) return 'jpeg';
  return 'iframe';
}

function inUSBounds(lat, lon) {
  // Loose bounding box covering CONUS, AK, HI, PR — just to catch garbage.
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;
  if (lat < 17 || lat > 72) return false;
  if (lon < -180 || lon > -65) return false;
  return true;
}

function cleanString(s, max = 200) {
  if (typeof s !== 'string') return undefined;
  const t = s.replace(/\s+/g, ' ').trim();
  if (!t) return undefined;
  return t.length > max ? t.slice(0, max - 1) + '…' : t;
}

function slug(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/**
 * Normalize one raw camera record.
 * Returns a Camera or null (if invalid / should be dropped).
 */
export function normalizeOne(raw, { source } = {}) {
  if (!raw) return null;
  const src = cleanString(raw.source || source) || 'unknown';
  const lat = Number(raw.lat);
  const lon = Number(raw.lon);
  if (!inUSBounds(lat, lon)) return null;

  const feeds = coerceFeeds(raw.feeds);
  if (!feeds.length) return null;

  const name = cleanString(raw.name) || cleanString(raw.roadway) || 'Unnamed camera';
  const id =
    cleanString(raw.id) ||
    `${src}:${slug(name)}-${lat.toFixed(4)}-${lon.toFixed(4)}`;

  const tags = Array.isArray(raw.tags)
    ? Array.from(new Set(raw.tags.map((t) => cleanString(t)).filter(Boolean)))
    : [];

  const rec = {
    id,
    source: src,
    name,
    lat: Number(lat.toFixed(6)),
    lon: Number(lon.toFixed(6)),
    feeds,
    tags
  };
  const region = cleanString(raw.region);
  if (region) rec.region = region.toUpperCase().slice(0, 2);
  const locality = cleanString(raw.locality);
  if (locality) rec.locality = locality;
  const roadway = cleanString(raw.roadway);
  if (roadway) rec.roadway = roadway;
  const direction = cleanString(raw.direction);
  if (direction) rec.direction = direction;
  return rec;
}

/**
 * Normalize an array of raw records. Drops invalid, de-dupes by id.
 */
export function normalize(records, opts = {}) {
  const seen = new Map();
  let dropped = 0;
  for (const raw of records || []) {
    const n = normalizeOne(raw, opts);
    if (!n) { dropped++; continue; }
    // Prefer record with more feeds on dup.
    const existing = seen.get(n.id);
    if (!existing || n.feeds.length > existing.feeds.length) seen.set(n.id, n);
  }
  return { records: Array.from(seen.values()), dropped };
}
