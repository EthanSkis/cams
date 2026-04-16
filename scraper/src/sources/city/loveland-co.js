// City of Loveland, CO — traffic cameras (ArcGIS).
//
// Each intersection has up to four direction feeds (North/South/East/West)
// stored as separate fields. We emit one camera record per populated
// direction.

import { scrapeArcgis } from "../../adapters/arcgis.js";

const LAYER =
  "https://services1.arcgis.com/d4MV7N9xmuHYbLrF/arcgis/rest/services/Traffic_Cameras_view/FeatureServer/0";

const DIRECTIONS = ["North", "South", "East", "West"];

export async function scrapeLovelandCo() {
  const out = [];
  await scrapeArcgis({
    baseUrl: LAYER,
    opts: { pageSize: 1000 },
    mapFeature: ({ attrs, lat, lon }) => {
      const base = attrs.Name || `Loveland Intersection ${attrs.OBJECTID}`;
      for (const d of DIRECTIONS) {
        const u = attrs[d];
        if (u && /^https?:\/\//i.test(u)) {
          out.push({
            id: `${attrs.OBJECTID}-${d.toLowerCase()}`,
            name: `${base} — ${d}`,
            lat,
            lon,
            state: "CO",
            region: "Loveland",
            view: "image",
            url: u,
            refresh: 15,
            source: "loveland-co",
            sourceName: "City of Loveland (CO)",
            sourceUrl: "https://maps.cityofloveland.org/",
            category: "city",
          });
        }
      }
      return null; // We push directly.
    },
  });
  return out;
}
