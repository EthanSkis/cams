// Adapter for "IBI 511" style traffic sites (Conduent / ITERIS legacy).
//
// These sites all share the same `/map/mapIcons/Cameras` endpoint that
// returns an array of camera items with a numeric `itemId` and
// `[lat, lon]` location. The live still is fetched from
// `/map/Cctv/{itemId}` and returns a JPEG.
//
// Examples:
//   511PA, 511NY, 511WI, 511GA, FL511

import { fetchJson } from "../utils.js";

export async function scrapeIbi511({
  source,
  sourceName,
  sourceUrl,
  origin,          // e.g. "https://511ny.org"
  state,
  category = "traffic",
  refresh = 10,
  namePrefix = null,
}) {
  const json = await fetchJson(`${origin}/map/mapIcons/Cameras`, { timeout: 45000 });
  const items = (json?.item2 || []).filter(
    (x) => x && x.itemId && Array.isArray(x.location) && x.location.length === 2,
  );
  return items.map((x) => {
    const [lat, lon] = x.location;
    const id = String(x.itemId);
    const title = (x.title && x.title.trim()) || `${namePrefix || state || "Traffic"} Camera ${id}`;
    return {
      id,
      name: title,
      lat,
      lon,
      state,
      view: "image",
      url: `${origin}/map/Cctv/${encodeURIComponent(id)}`,
      refresh,
      source,
      sourceName,
      sourceUrl: sourceUrl || origin,
      category,
    };
  });
}
