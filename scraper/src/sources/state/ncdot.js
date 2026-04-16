// NCDOT — North Carolina DOT.
//
// The list endpoint returns just id/lat/lon; details (including imageURL)
// require a second request per camera. We fetch the detail for each camera
// with bounded concurrency.

import { fetchJson } from "../../utils.js";

const LIST_URL = "https://eapps.ncdot.gov/services/traffic-prod/v1/cameras";
const DETAIL = (id) =>
  `https://eapps.ncdot.gov/services/traffic-prod/v1/cameras/${id}`;

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

export async function scrapeNcdot() {
  const list = await fetchJson(LIST_URL, { timeout: 45000 });
  if (!Array.isArray(list)) return [];
  const results = await mapConcurrent(list, 16, async (row) => {
    const d = await fetchJson(DETAIL(row.id), { timeout: 30000, retries: 2 });
    if (!d || !d.imageURL) return null;
    if (String(d.status || "").toUpperCase() !== "OK") return null;
    const lat = Number(d.latitude ?? row.latitude);
    const lon = Number(d.longitude ?? row.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return {
      id: String(d.id),
      name: d.locationName || d.displayName || `NC Camera ${d.id}`,
      description: d.mileMarker ? `MM ${d.mileMarker}` : undefined,
      lat,
      lon,
      state: "NC",
      view: "image",
      url: d.imageURL,
      refresh: 15,
      source: "ncdot",
      sourceName: "NCDOT",
      sourceUrl: "https://drivenc.gov/",
      category: "traffic",
    };
  });
  return results.filter(Boolean);
}
