// City of Arlington, TX — traffic cameras (ArcGIS).

import { scrapeArcgis } from "../../adapters/arcgis.js";

const LAYER =
  "https://services.arcgis.com/jXi5GuMZwfCYtZP9/arcgis/rest/services/Traffic_Camera_Updates_view/FeatureServer/0";

export async function scrapeArlingtonTx() {
  return scrapeArcgis({
    baseUrl: LAYER,
    opts: { pageSize: 500 },
    mapFeature: ({ attrs, lat, lon }) => {
      if (String(attrs.Status || "").toLowerCase() !== "online") return null;
      const url = attrs.Pic_URL || attrs.Thumb_URL;
      if (!url || !/^https?:\/\//i.test(url)) return null;
      return {
        id: String(attrs.ObjectId),
        name: attrs.Camera_Location || `Arlington Camera ${attrs.ObjectId}`,
        description: attrs.Description || undefined,
        lat,
        lon,
        state: "TX",
        region: "Arlington",
        view: "image",
        url,
        refresh: 60,
        source: "arlington-tx",
        sourceName: "City of Arlington (TX)",
        sourceUrl: "https://www.arlingtontx.gov/",
        category: "city",
      };
    },
  });
}
