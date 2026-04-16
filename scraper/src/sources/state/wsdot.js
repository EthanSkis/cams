// WSDOT (Washington State DOT) traffic cameras via ArcGIS FeatureServer.

import { scrapeArcgis } from "../../adapters/arcgis.js";

const LAYER =
  "https://data.wsdot.wa.gov/arcgis/rest/services/TravelInformation/TravelInfoCamerasWeather/FeatureServer/0";

export async function scrapeWsdot() {
  return scrapeArcgis({
    baseUrl: LAYER,
    opts: { pageSize: 1000 },
    mapFeature: ({ attrs, lat, lon }) => {
      const url = attrs.ImageURL;
      if (!url) return null;
      return {
        id: `objectid-${attrs.OBJECTID}`,
        name: attrs.CameraTitle || `WSDOT Camera ${attrs.OBJECTID}`,
        description: attrs.CompassDirection ? `Facing ${attrs.CompassDirection}` : undefined,
        lat,
        lon,
        state: "WA",
        view: "image",
        url,
        refresh: 30,
        source: "wsdot",
        sourceName: "WSDOT",
        sourceUrl: "https://wsdot.com/travel/real-time/map/",
        category: "traffic",
      };
    },
  });
}
