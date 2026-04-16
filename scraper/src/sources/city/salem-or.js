// City of Salem, OR — traffic cameras (ArcGIS).

import { scrapeArcgis } from "../../adapters/arcgis.js";

const LAYER =
  "https://services.arcgis.com/kIA6yS9KDGqZL7U3/arcgis/rest/services/TrafficCams/FeatureServer/0";

export async function scrapeSalemOr() {
  return scrapeArcgis({
    baseUrl: LAYER,
    opts: { pageSize: 1000 },
    mapFeature: ({ attrs, lat, lon }) => {
      const url = attrs.IMAGE_LINK;
      if (!url || !/^https?:\/\//i.test(url)) return null;
      if (String(attrs.CAMERA_OFFLINE).toLowerCase() === "yes") return null;
      return {
        id: String(attrs.OBJECTID),
        name: attrs.INTERSECTION || `Salem Camera ${attrs.OBJECTID}`,
        lat,
        lon,
        state: "OR",
        region: "Salem",
        view: "image",
        url,
        refresh: 20,
        source: "salem-or",
        sourceName: "City of Salem (OR)",
        sourceUrl: "https://www.cityofsalem.net/",
        category: "city",
      };
    },
  });
}
