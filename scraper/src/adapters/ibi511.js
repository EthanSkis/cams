// Adapter for the IBI Group "511" platform. Tenants share a public REST API
// exposed at /api/v2/get/cctv (and similar). Most tenants require a free key.
//
// Usage: pass a { host, key, region, source } and this returns CameraInputs.

import { fetchJson } from '../utils.js';

export async function scrapeIbi511({ host, key, source, region }) {
  if (!key) return []; // gracefully skip when caller didn't provide a key
  const url = `https://${host}/api/v2/get/cctv?key=${encodeURIComponent(key)}&format=json`;
  let rows;
  try {
    rows = await fetchJson(url, { cacheMs: 5 * 60 * 1000 });
  } catch (e) {
    throw new Error(`${source}: ${e.message}`);
  }
  const out = [];
  for (const r of rows || []) {
    const lat = Number(r.Latitude ?? r.latitude);
    const lon = Number(r.Longitude ?? r.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const img = r.ImageUrl || r.imageUrl || r.VideoUrl || r.videoUrl;
    if (!img) continue;
    const feeds = [];
    if (/\.m3u8/i.test(img)) feeds.push({ type: 'hls', url: img });
    else feeds.push({ type: 'jpeg', url: img, refreshSec: 10 });
    out.push({
      id: `${source}:${r.Id ?? r.id ?? img}`,
      source,
      region,
      name: r.Name || r.Location || r.Description,
      roadway: r.RoadwayName || r.Route,
      direction: r.Direction,
      lat,
      lon,
      feeds,
      tags: ['traffic', 'highway']
    });
  }
  return out;
}
