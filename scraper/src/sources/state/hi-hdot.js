// Hawaii DOT — GoAkamai camera snapshots (via an ArcGIS hub layer).

import { scrapeArcgis } from "../../adapters/arcgis.js";

const LAYER =
  "https://services.arcgis.com/6I1ysurtNWNxkuwd/arcgis/rest/services/HawaiiTrafficCameras/FeatureServer/0";

export async function scrapeHawaiiDot() {
  return scrapeArcgis({
    baseUrl: LAYER,
    opts: { pageSize: 1000 },
    mapFeature: ({ attrs, lat, lon }) => {
      const url = attrs.URL;
      if (!url || !/^https?:\/\//i.test(url)) return null;
      return {
        id: String(attrs.OBJECTID),
        name: attrs.Camera_Description || `Hawaii Camera ${attrs.OBJECTID}`,
        lat,
        lon,
        state: "HI",
        view: "image",
        url,
        refresh: 30,
        source: "hi-hdot",
        sourceName: "Hawaii DOT / GoAkamai",
        sourceUrl: "https://goakamai.org/",
        category: "traffic",
      };
    },
  });
}
