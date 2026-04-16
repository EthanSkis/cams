// California AlertCalifornia / CalOES wildfire webcams.
//
// PTZ cameras across California with a direct `latest-frame.jpg` URL per
// camera. Great coverage of remote areas not served by Caltrans.

import { scrapeArcgis } from "../../adapters/arcgis.js";

const LAYER =
  "https://services.arcgis.com/BLN4oKB0N1YSgvY8/arcgis/rest/services/CalOES_California_Webcams/FeatureServer/0";

export async function scrapeCalOes() {
  return scrapeArcgis({
    baseUrl: LAYER,
    opts: { pageSize: 1000 },
    mapFeature: ({ attrs, lat, lon }) => {
      const thumb = attrs.Thumbnail_Url;
      if (!thumb || !/^https?:\/\//i.test(thumb)) return null;
      const attrLat = Number(attrs.Latitude);
      const attrLon = Number(attrs.Longitude);
      const fLat = Number.isFinite(attrLat) ? attrLat : lat;
      const fLon = Number.isFinite(attrLon) ? attrLon : lon;
      if (!Number.isFinite(fLat) || !Number.isFinite(fLon)) return null;
      return {
        id: String(attrs.OBJECTID || attrs.Camera_ID),
        name: attrs.Location || `AlertCA Camera ${attrs.OBJECTID}`,
        description: attrs.Source || "AlertCalifornia",
        lat: fLat,
        lon: fLon,
        state: String(attrs.State || "CA").toUpperCase().slice(0, 2),
        region: attrs.County || undefined,
        view: "image",
        url: thumb,
        refresh: 20,
        source: "ca-caloes",
        sourceName: "CalOES / AlertCalifornia",
        sourceUrl: attrs.Webcam_URL || "https://cameras.alertcalifornia.org/",
        category: "weather",
        tags: ["wildfire"],
      };
    },
  });
}
