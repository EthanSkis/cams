// Caltrans (California DOT) — 12 districts, each exposing a JSON feed with
// rich per-camera metadata including both a static image URL and an HLS
// live-stream URL. We emit two records per camera: one image, one HLS.

import { fetchJson } from "../../utils.js";

const DISTRICTS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

function urlFor(d) {
  return `https://cwwp2.dot.ca.gov/data/d${d}/cctv/cctvStatusD${String(d).padStart(2, "0")}.json`;
}

export async function scrapeCaltrans() {
  const records = [];
  const errors = [];
  await Promise.all(
    DISTRICTS.map(async (d) => {
      try {
        const json = await fetchJson(urlFor(d), { timeout: 45000 });
        const arr = json?.data || [];
        for (const row of arr) {
          const c = row.cctv;
          if (!c) continue;
          const loc = c.location || {};
          const lat = Number(loc.latitude);
          const lon = Number(loc.longitude);
          if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
          if (lat === 0 && lon === 0) continue;
          const inService = String(c.inService || "").toLowerCase() === "true";
          if (!inService) continue;

          const name = loc.locationName || `CA D${d} Camera ${c.index}`;
          const region = loc.nearbyPlace || loc.county || undefined;
          const route = loc.route || undefined;
          const stream = c.imageData?.streamingVideoURL;
          const still = c.imageData?.static?.currentImageURL;

          const base = {
            name,
            description: loc.direction ? `Direction: ${loc.direction}` : undefined,
            lat,
            lon,
            state: "CA",
            region,
            route,
            source: "caltrans",
            sourceName: "Caltrans",
            sourceUrl: "https://cwwp2.dot.ca.gov/vm/iframemap.htm",
            category: "traffic",
          };

          if (still && /^https?:\/\//i.test(still)) {
            records.push({
              ...base,
              id: `d${d}-${c.index}-img`,
              view: "image",
              url: still,
              refresh: 5,
            });
          }
          if (stream && /^https?:\/\//i.test(stream) && stream.includes(".m3u8")) {
            records.push({
              ...base,
              id: `d${d}-${c.index}-hls`,
              view: "hls",
              url: stream,
              name: `${name} (live)`,
            });
          }
        }
      } catch (err) {
        errors.push(`D${d}: ${err.message}`);
      }
    }),
  );
  if (errors.length) {
    console.warn(`  [caltrans] ${errors.length} district(s) failed: ${errors.join("; ")}`);
  }
  return records;
}
