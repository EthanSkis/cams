// Illinois DOT — traffic cameras via Gateway Traveler Information.
// Exposes SnapShot (still JPEG) and ImgPath (HLS iframe page, not usable
// directly), with WarningAge/TooOld flags to filter stale records.

import { scrapeArcgis } from "../../adapters/arcgis.js";

const LAYER =
  "https://services2.arcgis.com/aIrBD8yn1TDTEXoz/arcgis/rest/services/TrafficCamerasTM_Public/FeatureServer/0";

export async function scrapeIlIdot() {
  return scrapeArcgis({
    baseUrl: LAYER,
    opts: { pageSize: 1000 },
    mapFeature: ({ attrs, lat, lon }) => {
      const snap = attrs.SnapShot;
      if (!snap || !/^https?:\/\//i.test(snap)) return null;
      if (String(attrs.TooOld).toLowerCase() === "true") return null;
      const id = String(attrs.OBJECTID);
      const name = attrs.CameraLocation || `IL Camera ${id}`;
      return {
        id,
        name,
        description: attrs.CameraDirection && attrs.CameraDirection !== "NONE"
          ? `Direction: ${attrs.CameraDirection}`
          : undefined,
        lat,
        lon,
        state: "IL",
        view: "image",
        url: snap,
        refresh: 30,
        source: "il-idot",
        sourceName: "IDOT / travelmidwest.com",
        sourceUrl: "https://travelmidwest.com/",
        category: "traffic",
      };
    },
  });
}
