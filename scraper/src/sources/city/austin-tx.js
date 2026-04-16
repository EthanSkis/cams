// City of Austin, TX — traffic cameras (ArcGIS).
// `SCREENSHOT_ADDRESS` is a direct still URL; cameras with
// `CAMERA_STATUS != 'TURNED_ON'` are skipped.

import { scrapeArcgis } from "../../adapters/arcgis.js";

const LAYER =
  "https://services.arcgis.com/0L95CJ0VTaxqcmED/arcgis/rest/services/TRANSPORTATION_traffic_cameras/FeatureServer/0";

export async function scrapeAustinTx() {
  return scrapeArcgis({
    baseUrl: LAYER,
    opts: { pageSize: 1000 },
    mapFeature: ({ attrs, lat, lon }) => {
      const status = String(attrs.CAMERA_STATUS || "").toUpperCase();
      if (status && status !== "TURNED_ON" && status !== "ON") return null;

      const snap = attrs.SCREENSHOT_ADDRESS;
      if (!snap || !/^https?:\/\//i.test(snap)) return null;

      return {
        id: String(attrs.CAMERA_ID || attrs.OBJECTID),
        name: attrs.LOCATION_NAME || `Austin Camera ${attrs.CAMERA_ID}`,
        description: attrs.PRIMARY_ST ? `Primary: ${attrs.PRIMARY_ST}` : undefined,
        lat,
        lon,
        state: "TX",
        region: "Austin",
        view: "image",
        url: snap,
        refresh: 30,
        source: "austin-tx",
        sourceName: "City of Austin",
        sourceUrl: "https://data.austintexas.gov/",
        category: "city",
      };
    },
  });
}
