// ARTIMIS — Cincinnati/Northern Kentucky regional traffic management.
// Covers Ohio and Northern Kentucky; camera image URLs point to ODOT.

import { scrapeArcgis } from "../../adapters/arcgis.js";

const LAYER =
  "https://services1.arcgis.com/AeX7yhXqx2UBQyL7/arcgis/rest/services/ARTIMIS_Cameras/FeatureServer/0";

export async function scrapeArtimis() {
  return scrapeArcgis({
    baseUrl: LAYER,
    opts: { pageSize: 500 },
    mapFeature: ({ attrs, lat, lon }) => {
      const url = attrs.Link || attrs.HyperLink;
      if (!url || !/^https?:\/\//i.test(url)) return null;
      // Classify as OH or KY based on lat.
      const state = lat < 39 ? "KY" : "OH";
      return {
        id: String(attrs.OBJECTID),
        name: attrs.Location || `ARTIMIS ${attrs.OBJECTID}`,
        lat,
        lon,
        state,
        region: "Cincinnati",
        view: "image",
        url,
        refresh: 15,
        source: "artimis",
        sourceName: "ARTIMIS (Cincinnati/NKY)",
        sourceUrl: "https://www.artimis.org/",
        category: "traffic",
      };
    },
  });
}
