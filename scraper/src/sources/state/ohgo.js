// OHGO / Ohio DOT cameras (public feed used by the ohgo.com web client).
// Returns JSON array of camera groups, each with one or more cameras.

import { fetchJson } from "../../utils.js";

export async function scrapeOhgo() {
  const arr = await fetchJson("https://api.ohgo.com/cameras", { timeout: 45000 });
  if (!Array.isArray(arr)) return [];
  const out = [];
  for (const group of arr) {
    const lat = Number(group.Latitude);
    const lon = Number(group.Longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const location = group.Location || group.Description || "";
    const cams = group.Cameras || [];
    for (let i = 0; i < cams.length; i++) {
      const c = cams[i];
      const url = c.LargeURL || c.SmallURL;
      if (!url) continue;
      const dir = c.Direction ? ` (${c.Direction})` : "";
      out.push({
        id: `${group.Id}-${i}`,
        name: `${location}${dir}`.trim() || `OH Camera ${group.Id}`,
        lat,
        lon,
        state: "OH",
        view: "image",
        url,
        refresh: 10,
        source: "ohgo",
        sourceName: "OHGO / Ohio DOT",
        sourceUrl: "https://ohgo.com/",
        category: "traffic",
      });
    }
  }
  return out;
}
