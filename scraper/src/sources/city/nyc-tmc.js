// NYC DOT / Traffic Management Center cameras.
// Public JSON API: https://webcams.nyctmc.org/api/cameras

import { fetchJson } from "../../utils.js";

export async function scrapeNycTmc() {
  const arr = await fetchJson("https://webcams.nyctmc.org/api/cameras", {
    timeout: 45000,
  });
  if (!Array.isArray(arr)) return [];
  return arr
    .filter((c) => c && c.id && c.latitude && c.longitude)
    .map((c) => ({
      id: c.id,
      name: c.name || `NYC Camera ${c.id}`,
      description: c.area ? `Area: ${c.area}` : undefined,
      lat: Number(c.latitude),
      lon: Number(c.longitude),
      state: "NY",
      region: c.area || "New York City",
      view: "image",
      url:
        c.imageUrl ||
        `https://webcams.nyctmc.org/api/cameras/${encodeURIComponent(c.id)}/image`,
      refresh: 5,
      source: "nyc-tmc",
      sourceName: "NYC DOT",
      sourceUrl: "https://webcams.nyctmc.org/cameras-list",
      category: "city",
    }));
}
