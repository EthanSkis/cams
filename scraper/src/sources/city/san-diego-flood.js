// San Diego County Flood Control District — flood webcams (ArcGIS).

import { scrapeArcgis } from "../../adapters/arcgis.js";

const LAYER =
  "https://services1.arcgis.com/1vIhDJwtG5eNmiqX/arcgis/rest/services/County_Flood_Control_District_Web_Cams/FeatureServer/0";

export async function scrapeSanDiegoFlood() {
  return scrapeArcgis({
    baseUrl: LAYER,
    opts: { pageSize: 100 },
    mapFeature: ({ attrs, lat, lon }) => {
      const url = attrs.LINK || attrs.VIEW_;
      if (!url || !/^https?:\/\//i.test(url)) return null;
      return {
        id: String(attrs.OBJECTID),
        name: attrs.CAMERA_NAME || `SD Flood Cam ${attrs.OBJECTID}`,
        lat,
        lon,
        state: "CA",
        region: "San Diego County",
        view: "iframe",
        url,
        source: "sd-flood",
        sourceName: "San Diego County Flood Control",
        sourceUrl: "https://www.sdcfcd.org/",
        category: "weather",
        tags: ["flood"],
      };
    },
  });
}
