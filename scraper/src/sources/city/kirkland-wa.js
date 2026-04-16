// City of Kirkland, WA — traffic cameras (ArcGIS).
//
// The X/Y fields in the feature records are swapped (POINT_X is state-plane
// X but LAT is actually lon). We trust the feature geometry instead.

import { scrapeArcgis } from "../../adapters/arcgis.js";

const LAYER =
  "https://services2.arcgis.com/loGMwowmR0OPlOQb/arcgis/rest/services/TRN_TrafficCams_10032022/FeatureServer/0";

export async function scrapeKirklandWa() {
  return scrapeArcgis({
    baseUrl: LAYER,
    opts: { pageSize: 1000 },
    mapFeature: ({ attrs, lat, lon }) => {
      const url = attrs.IMAGE_;
      if (!url || !/^https?:\/\//i.test(url)) return null;
      return {
        id: String(attrs.TRAFCAM_ID || attrs.OBJECTID),
        name: attrs.LOCATION || `Kirkland Camera ${attrs.OBJECTID}`,
        description: attrs.DESCRIPTIO ? String(attrs.DESCRIPTIO).slice(0, 200) : undefined,
        lat,
        lon,
        state: "WA",
        region: "Kirkland",
        view: "image",
        url,
        refresh: 20,
        source: "kirkland-wa",
        sourceName: "City of Kirkland (WA)",
        sourceUrl: "https://its.kirklandwa.gov/",
        category: "city",
      };
    },
  });
}
