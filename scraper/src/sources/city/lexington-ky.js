// Lexington–Fayette Urban County Government (KY) — traffic cameras.
//
// The `still_url` is a Wowza stream-thumbnail endpoint that returns a
// fresh JPEG on each request.

import { scrapeArcgis } from "../../adapters/arcgis.js";

const LAYER =
  "https://services1.arcgis.com/Mg7DLdfYcSWIaDnu/arcgis/rest/services/Traffic_Camera_Locations_Public_view/FeatureServer/0";

export async function scrapeLexingtonKy() {
  return scrapeArcgis({
    baseUrl: LAYER,
    opts: { pageSize: 1000 },
    mapFeature: ({ attrs, lat, lon }) => {
      const url = attrs.still_url;
      if (!url || !/^https?:\/\//i.test(url)) return null;
      return {
        id: String(attrs.objectid),
        name: attrs.location || `Lexington Camera ${attrs.objectid}`,
        lat,
        lon,
        state: "KY",
        region: "Lexington",
        view: "image",
        url,
        refresh: 5,
        source: "lexington-ky",
        sourceName: "LFUCG (Lexington, KY)",
        sourceUrl: "https://www.lexingtonky.gov/",
        category: "city",
      };
    },
  });
}
