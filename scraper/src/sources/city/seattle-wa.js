// Seattle Department of Transportation — traffic cameras (ArcGIS).
// The layer aggregates many WSDOT feeds plus SDOT's own cameras.

import { scrapeArcgis } from "../../adapters/arcgis.js";

const LAYER =
  "https://services.arcgis.com/ZOyb2t4B0UYuYNYH/arcgis/rest/services/Traffic_Cameras_CDL/FeatureServer/0";

export async function scrapeSeattle() {
  return scrapeArcgis({
    baseUrl: LAYER,
    opts: { pageSize: 1000 },
    mapFeature: ({ attrs, lat, lon }) => {
      if (String(attrs.SERVSTAT || "").toUpperCase() !== "ACTV") return null;
      const url = attrs.URL;
      if (!url || !/^https?:\/\//i.test(url)) return null;
      return {
        id: String(attrs.OBJECTID),
        name: attrs.LOCATION || attrs.UNITID || `Seattle Camera ${attrs.OBJECTID}`,
        lat,
        lon,
        state: "WA",
        region: "Seattle",
        view: "image",
        url,
        refresh: 20,
        source: "seattle",
        sourceName: "Seattle DOT",
        sourceUrl: "https://www.seattle.gov/transportation",
        category: "city",
      };
    },
  });
}
