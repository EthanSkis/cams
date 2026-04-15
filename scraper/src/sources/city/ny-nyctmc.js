// NYC DOT TMC camera list. Public JSON, no key, ~900 cameras city-wide.

import { fetchJson } from '../../utils.js';

const LIST_URL = 'https://webcams.nyctmc.org/api/cameras/';

export async function run() {
  const rows = await fetchJson(LIST_URL, { cacheMs: 15 * 60 * 1000 });
  const out = [];
  for (const r of rows || []) {
    const lat = Number(r.latitude);
    const lon = Number(r.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const img = r.imageUrl || (r.id ? `https://webcams.nyctmc.org/api/cameras/${r.id}/image` : null);
    if (!img) continue;
    out.push({
      id: `nyctmc:${r.id}`,
      source: 'nyctmc',
      region: 'NY',
      locality: r.area || 'New York City',
      name: r.name || `NYC Camera ${r.id}`,
      lat, lon,
      feeds: [{ type: 'jpeg', url: img, refreshSec: 3 }],
      tags: ['traffic', 'city', 'nyc']
    });
  }
  return out;
}

export const info = { name: 'nyctmc' };
