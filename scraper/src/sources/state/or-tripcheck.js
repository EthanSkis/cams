// Oregon DOT — TripCheck traffic cameras (ArcGIS FeatureServer).
//
// Geometry is stored as plain attributes (`attributes_latitude/longitude`)
// rather than on the Esri geometry field, so we read both and fall back.

import { scrapeArcgis } from "../../adapters/arcgis.js";

const LAYER =
  "https://services.arcgis.com/uUvqNMGPm7axC2dD/arcgis/rest/services/TripCheck_Cameras/FeatureServer/0";

export async function scrapeOrTripcheck() {
  return scrapeArcgis({
    baseUrl: LAYER,
    opts: { pageSize: 1000 },
    mapFeature: ({ attrs, lat, lon }) => {
      const latAttr = Number(attrs.attributes_latitude);
      const lonAttr = Number(attrs.attributes_longitude);
      const fLat = Number.isFinite(latAttr) ? latAttr : lat;
      const fLon = Number.isFinite(lonAttr) ? lonAttr : lon;
      if (!Number.isFinite(fLat) || !Number.isFinite(fLon)) return null;

      const filename = attrs.attributes_filename;
      if (!filename || !/^https?:\/\//i.test(filename)) return null;

      return {
        id: String(attrs.attributes_cameraId ?? attrs.ObjectId),
        name: (attrs.attributes_title || `OR Camera ${attrs.attributes_cameraId}`).trim(),
        lat: fLat,
        lon: fLon,
        state: "OR",
        route: attrs.attributes_route ? String(attrs.attributes_route).trim() : undefined,
        view: "image",
        url: filename,
        refresh: 30,
        source: "or-tripcheck",
        sourceName: "Oregon TripCheck / ODOT",
        sourceUrl: "https://tripcheck.com/",
        category: "traffic",
      };
    },
  });
}
