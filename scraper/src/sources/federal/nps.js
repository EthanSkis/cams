// National Park Service webcams.
//
// Strategy: pull the camera list from the developer.nps.gov REST API
// (using DEMO_KEY by default, or NPS_API_KEY if set), then visit each
// camera's public page on www.nps.gov to scrape the actual image or
// stream URL. The API's `images` field is empty for most active cameras
// even though their pages render a live `<img id="webcamRefreshImage">`,
// so the page scrape is the main signal.
//
// If the API is rate-limited (DEMO_KEY hits 1000/hr) we fall back to
// re-using the previously-published `assets/cameras.json` so we don't
// lose coverage between runs.

import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { fetchJson, fetchText } from "../../utils.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CACHE_PATH = resolve(__dirname, "..", "..", "..", "..", "assets", "cameras.json");

const LIST_URL_BASE = "https://developer.nps.gov/api/v1/webcams";
const VIEW_PAGE = (id) =>
  `https://www.nps.gov/media/webcam/view.htm?id=${encodeURIComponent(id)}`;

function decodeEntities(s) {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function extractMediaUrl(html) {
  const decoded = decodeEntities(html);
  let m = decoded.match(/id=["']webcamRefreshImage["'][^>]*src=["']([^"']+)["']/i);
  if (m) return { view: "image", url: m[1] };
  m = decoded.match(/src=["']([^"']+)["'][^>]*id=["']webcamRefreshImage["']/i);
  if (m) return { view: "image", url: m[1] };
  m = decoded.match(/<source[^>]+src=["']([^"']+\.m3u8[^"']*)["']/i);
  if (m) return { view: "hls", url: m[1] };
  m = decoded.match(/<iframe[^>]+src=["']([^"']*youtube[^"']*)["']/i);
  if (m) return { view: "youtube", url: m[1] };
  m = decoded.match(/src=["'](https?:\/\/[^"']*?\/featurecontent\/ard\/webcams\/images\/[^"']+)["']/i);
  if (m) return { view: "image", url: m[1] };
  m = decoded.match(/src=["'](https?:\/\/[^"']*?\/webcams?-[a-z]+\/[^"']+\.(?:jpg|jpeg|png))["']/i);
  if (m) return { view: "image", url: m[1] };
  return null;
}

async function mapConcurrent(arr, limit, fn) {
  const out = new Array(arr.length);
  let i = 0;
  async function worker() {
    while (true) {
      const idx = i++;
      if (idx >= arr.length) return;
      try {
        out[idx] = await fn(arr[idx], idx);
      } catch {
        out[idx] = null;
      }
    }
  }
  await Promise.all(Array.from({ length: limit }, worker));
  return out;
}

async function fetchListFromApi() {
  const apiKey = process.env.NPS_API_KEY || "DEMO_KEY";
  const records = [];
  let start = 0;
  const limit = 50;
  for (let i = 0; i < 30; i++) {
    const url =
      `${LIST_URL_BASE}?limit=${limit}&start=${start}` +
      `&api_key=${encodeURIComponent(apiKey)}`;
    const json = await fetchJson(url, { timeout: 45000, retries: 4 });
    const batch = json?.data || [];
    if (!batch.length) break;
    records.push(...batch);
    if (batch.length < limit) break;
    start += batch.length;
    await new Promise((r) => setTimeout(r, 1500));
  }
  return records.map((c) => ({
    id: c.id,
    title: c.title,
    description: c.description,
    latitude: Number(c.latitude),
    longitude: Number(c.longitude),
    status: c.status,
    streamingUrl: c.streamingUrl,
    images: c.images,
    relatedParks: c.relatedParks,
    url: c.url,
  }));
}

function fetchListFromCache() {
  if (!existsSync(CACHE_PATH)) return [];
  try {
    const data = JSON.parse(readFileSync(CACHE_PATH, "utf8"));
    const cams = (data.cameras || []).filter((c) => c.source === "nps");
    // Reduce duplicates (we may have emitted both image+page records per id).
    const byBase = new Map();
    for (const c of cams) {
      const baseId = String(c.id || "").replace(/^nps:/, "").toUpperCase();
      if (!baseId || byBase.has(baseId)) continue;
      byBase.set(baseId, {
        id: baseId,
        title: c.name,
        description: c.description,
        latitude: c.lat,
        longitude: c.lon,
        status: "Active",
        streamingUrl: null,
        images: [],
        relatedParks: c.region
          ? [{ fullName: c.region, states: c.state }]
          : [],
        url: c.sourceUrl,
      });
    }
    return [...byBase.values()];
  } catch {
    return [];
  }
}

export async function scrapeNps() {
  let records = [];
  try {
    records = await fetchListFromApi();
    console.log(`    nps: API returned ${records.length} cameras`);
  } catch (err) {
    console.warn(`    nps: API failed (${err.message}); using cache`);
    records = fetchListFromCache();
    console.log(`    nps: cache provided ${records.length} cameras`);
  }
  if (!records.length) return [];

  const out = await mapConcurrent(records, 8, async (c) => {
    if (!c) return null;
    const lat = Number(c.latitude);
    const lon = Number(c.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    if (c.status && String(c.status).toLowerCase() !== "active") return null;

    let media = null;

    const stream = c.streamingUrl;
    if (stream && /\.m3u8(\?|$)/i.test(stream)) {
      media = { view: "hls", url: stream };
    } else if (stream && /youtube\.com|youtu\.be/i.test(stream)) {
      media = { view: "youtube", url: stream };
    }

    if (!media) {
      let imageUrl = c.images?.[0]?.url || null;
      if (imageUrl) {
        const m = imageUrl.match(/https?:\/\/.*?(https?:\/\/.+)$/);
        if (m) imageUrl = m[1];
        if (/^https?:\/\//i.test(imageUrl)) {
          media = { view: "image", url: imageUrl, refresh: 60 };
        }
      }
    }

    if (!media) {
      try {
        const html = await fetchText(VIEW_PAGE(c.id), {
          timeout: 25000,
          retries: 1,
          headers: { accept: "text/html" },
        });
        const found = extractMediaUrl(html);
        if (found) media = { ...found, refresh: found.view === "image" ? 60 : undefined };
      } catch {
        // ignore
      }
    }

    const pageUrl = c.url || VIEW_PAGE(c.id);
    const parkNames = Array.isArray(c.relatedParks)
      ? c.relatedParks.map((p) => p.fullName || p.name).filter(Boolean).join(", ")
      : undefined;
    const stateField = c.relatedParks?.[0]?.states;
    const state = stateField
      ? String(stateField).split(/[,;\/]/)[0].toUpperCase().slice(0, 2)
      : null;

    const base = {
      id: c.id,
      name: c.title || "NPS Webcam",
      description: c.description ? String(c.description).slice(0, 400) : undefined,
      lat,
      lon,
      state,
      region: parkNames,
      source: "nps",
      sourceName: "National Park Service",
      sourceUrl: pageUrl,
      category: "park",
    };

    if (media) return { ...base, ...media };
    return { ...base, view: "page", url: pageUrl };
  });

  return out.filter(Boolean);
}
