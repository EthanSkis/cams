// Lake Metroparks (Lake County, OH) — park webcams (ArcGIS).
// Each record carries an iframe-embeddable page URL.

import { scrapeArcgis } from "../../adapters/arcgis.js";

const LAYER =
  "https://services5.arcgis.com/rSEU73LH8rcqHJ12/arcgis/rest/services/Lake_Metroparks_WebCams_Public_2024/FeatureServer/0";

export async function scrapeLakeMetroparks() {
  return scrapeArcgis({
    baseUrl: LAYER,
    opts: { pageSize: 100 },
    mapFeature: ({ attrs, lat, lon }) => {
      const link = attrs.Link;
      if (!link || !/^https?:\/\//i.test(link)) return null;
      const name = attrs.Subject || attrs.Park || `Lake Metroparks Cam ${attrs.OBJECTID}`;
      return {
        id: String(attrs.OBJECTID),
        name,
        description: attrs.Park || undefined,
        lat,
        lon,
        state: "OH",
        region: "Lake County",
        view: "iframe",
        url: link,
        source: "oh-lake-metroparks",
        sourceName: "Lake Metroparks (Lake County, OH)",
        sourceUrl: "https://www.lakemetroparks.com/",
        category: "park",
      };
    },
  });
}
