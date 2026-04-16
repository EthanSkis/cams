// King County (WA) + WSDOT combined traffic cameras layer.
// Filter to "Live" cameras (i.e. skip Retired/Disabled).

import { scrapeArcgis } from "../../adapters/arcgis.js";

const LAYER =
  "https://services.arcgis.com/Ej0PsM5Aw677QF1W/arcgis/rest/services/TRAFFICCAMERA_POINT_2029/FeatureServer/0";

export async function scrapeKingCountyWa() {
  return scrapeArcgis({
    baseUrl: LAYER,
    opts: { pageSize: 1000 },
    mapFeature: ({ attrs, lat, lon }) => {
      const status = String(attrs.CurrentStatus || "").toLowerCase();
      if (status === "retired" || status === "disabled") return null;
      const url = attrs.ImageURL;
      if (!url || !/^https?:\/\//i.test(url)) return null;
      const id = String(attrs.TrafficCameraID || attrs.OBJECTID);
      const name = attrs.Location || `King County Camera ${id}`;
      return {
        id,
        name,
        lat,
        lon,
        state: "WA",
        region: attrs.CamRegion || "King County",
        view: "image",
        url,
        refresh: 30,
        source: "wa-kingcounty",
        sourceName: attrs.Owner === "WSDOT" ? "WSDOT (via King County)" : "King County",
        sourceUrl: "https://www.kingcounty.gov/",
        category: "traffic",
      };
    },
  });
}
