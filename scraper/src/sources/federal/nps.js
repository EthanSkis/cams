// National Park Service webcams.
//
// Public API at https://developer.nps.gov/api/v1/webcams — `DEMO_KEY` is
// sufficient for light polling. If NPS_API_KEY is present in the env we
// use that instead.

import { fetchJson } from "../../utils.js";

export async function scrapeNps() {
  const apiKey = process.env.NPS_API_KEY || "DEMO_KEY";
  const out = [];
  let start = 0;
  const limit = 50;
  for (let i = 0; i < 30; i++) {
    const url =
      `https://developer.nps.gov/api/v1/webcams?limit=${limit}&start=${start}` +
      `&api_key=${encodeURIComponent(apiKey)}`;
    const json = await fetchJson(url, { timeout: 45000 });
    const batch = json?.data || [];
    if (!batch.length) break;
    for (const c of batch) {
      if (!c) continue;
      const lat = Number(c.latitude);
      const lon = Number(c.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      if (String(c.status || "").toLowerCase() !== "active") continue;

      // NPS sometimes publishes image URLs with a duplicated scheme prefix
      // (e.g. "https://www.nps.govhttps://www.nps.gov/…"). Repair it.
      let imageUrl = c.images?.[0]?.url || null;
      if (imageUrl) {
        const m = imageUrl.match(/https?:\/\/.*?(https?:\/\/.+)$/);
        if (m) imageUrl = m[1];
      }
      const stream = c.streamingUrl || null;
      const pageUrl = c.url || null;
      const parkNames = Array.isArray(c.relatedParks)
        ? c.relatedParks.map((p) => p.fullName || p.name).filter(Boolean).join(", ")
        : undefined;

      const base = {
        id: c.id,
        name: c.title || "NPS Webcam",
        description: c.description ? String(c.description).slice(0, 400) : undefined,
        lat,
        lon,
        state: c.relatedParks?.[0]?.states || null,
        region: parkNames,
        source: "nps",
        sourceName: "National Park Service",
        sourceUrl: pageUrl || "https://www.nps.gov/subjects/webcams/index.htm",
        category: "park",
      };

      if (stream && /\.m3u8(\?|$)/i.test(stream)) {
        out.push({ ...base, view: "hls", url: stream });
      } else if (
        stream &&
        /youtube\.com|youtu\.be/i.test(stream)
      ) {
        out.push({ ...base, view: "youtube", url: stream });
      } else if (imageUrl) {
        out.push({ ...base, view: "image", url: imageUrl, refresh: 30 });
      } else if (pageUrl) {
        out.push({ ...base, view: "page", url: pageUrl });
      }
    }
    if (batch.length < limit) break;
    start += batch.length;
  }
  return out;
}
