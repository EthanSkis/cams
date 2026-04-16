// Normalizes camera records from many sources into a single schema.
//
// Output record shape:
// {
//   id: string,            // stable id ("source:original_id")
//   name: string,
//   description?: string,
//   lat: number,
//   lon: number,
//   state: string | null,  // 2-letter USPS code
//   region?: string,       // county / city / route
//   route?: string,        // road name if applicable
//   // ---- view ----
//   view: "image" | "hls" | "mjpeg" | "youtube" | "iframe" | "page",
//   url: string,           // image/video/iframe/page url
//   refresh?: number,      // suggested refresh interval in seconds (for images)
//   // ---- meta ----
//   source: string,        // short source key
//   sourceName: string,    // human source name
//   sourceUrl?: string,    // link back to source
//   category: "traffic" | "weather" | "park" | "beach" | "ski" | "airport" | "city" | "other",
//   tags?: string[],
// }

import { inUsBbox, safeNumber, slug, uniqueBy } from "./utils.js";

const VALID_VIEWS = new Set([
  "image",
  "hls",
  "mjpeg",
  "youtube",
  "iframe",
  "page",
]);

const VALID_CATEGORIES = new Set([
  "traffic",
  "weather",
  "park",
  "beach",
  "ski",
  "airport",
  "city",
  "other",
]);

export function normalizeRecord(raw) {
  const lat = safeNumber(raw.lat);
  const lon = safeNumber(raw.lon);
  if (lat === null || lon === null) return null;
  if (!inUsBbox(lat, lon)) return null;

  const view = VALID_VIEWS.has(raw.view) ? raw.view : "page";
  const url = String(raw.url || "").trim();
  if (!url) return null;
  if (!/^https?:\/\//i.test(url) && view !== "iframe") return null;

  const category = VALID_CATEGORIES.has(raw.category) ? raw.category : "other";
  const source = slug(raw.source || "unknown");
  const idRaw = raw.id ?? `${lat.toFixed(5)},${lon.toFixed(5)}:${url}`;
  const id = `${source}:${slug(String(idRaw))}`.slice(0, 160);

  return {
    id,
    name: String(raw.name || "Camera").trim().slice(0, 160),
    description: raw.description ? String(raw.description).slice(0, 400) : undefined,
    lat: round(lat, 6),
    lon: round(lon, 6),
    state: raw.state ? String(raw.state).toUpperCase().slice(0, 2) : null,
    region: raw.region ? String(raw.region).slice(0, 80) : undefined,
    route: raw.route ? String(raw.route).slice(0, 80) : undefined,
    view,
    url,
    refresh: raw.refresh ? Math.max(2, Math.min(600, Number(raw.refresh))) : undefined,
    source,
    sourceName: raw.sourceName || raw.source || "Unknown",
    sourceUrl: raw.sourceUrl || undefined,
    category,
    tags: Array.isArray(raw.tags) ? raw.tags.slice(0, 10) : undefined,
  };
}

export function normalizeAll(records) {
  const normalized = [];
  for (const r of records) {
    const n = normalizeRecord(r);
    if (n) normalized.push(n);
  }
  // Deduplicate by id, then by (rounded lat/lon + view + url).
  const byId = uniqueBy(normalized, (r) => r.id);
  return uniqueBy(
    byId,
    (r) => `${r.lat.toFixed(4)},${r.lon.toFixed(4)}:${r.view}:${r.url}`,
  );
}

function round(n, p) {
  const f = Math.pow(10, p);
  return Math.round(n * f) / f;
}
