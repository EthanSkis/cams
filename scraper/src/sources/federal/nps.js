// National Park Service webcams. NPS doesn't offer a camera API, but it does
// expose individual park pages via the "parks" endpoint of its public
// developer portal. We don't have an API key dependency here — we fall back to
// scraping the public air/webcams overview when the API key isn't set.

import { fetchJson, fetchText, requireEnv } from '../../utils.js';

export async function run() {
  const key = requireEnv('KEY_NPS');
  if (!key) {
    return scrapePublicPage();
  }
  const out = [];
  let start = 0;
  for (;;) {
    const url = `https://developer.nps.gov/api/v1/webcams?start=${start}&limit=50&api_key=${key}`;
    const j = await fetchJson(url, { cacheMs: 60 * 60 * 1000 });
    const rows = j.data || [];
    for (const r of rows) {
      const lat = Number(r.latitude);
      const lon = Number(r.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      const img = (r.images && r.images[0] && r.images[0].url) || r.url;
      if (!img) continue;
      out.push({
        id: `nps:${r.id}`,
        source: 'nps',
        region: (r.relatedParks && r.relatedParks[0]?.states) || undefined,
        locality: r.relatedParks && r.relatedParks[0]?.fullName,
        name: r.title || `NPS Webcam ${r.id}`,
        lat, lon,
        feeds: [/\.m3u8/i.test(img)
          ? { type: 'hls', url: img }
          : { type: 'iframe', url: img }],
        tags: ['park', 'nps', 'scenic']
      });
    }
    start += rows.length;
    if (rows.length < 50) break;
    if (start > 10_000) break;
  }
  return out;
}

async function scrapePublicPage() {
  // Best-effort fallback: the NPS air/webcams page lists per-park links; we
  // don't have structured data here, so we return nothing and let the GH
  // Actions runner (which sets KEY_NPS) populate this source.
  try {
    await fetchText('https://www.nps.gov/subjects/air/webcams.htm', { cacheMs: 60 * 60 * 1000 });
  } catch { /* ignore */ }
  return [];
}

export const info = { name: 'nps' };
