// Iowa DOT — Traffic Cameras (ArcGIS).
//
// Some rows are RWIS mini-stations; some are PTZ highway cams. ImageURL
// is the still; VideoURL_HD / VideoURL are optional live streams.

import { scrapeArcgis } from "../../adapters/arcgis.js";

const LAYER =
  "https://services.arcgis.com/8lRhdTsQyJpO52F1/arcgis/rest/services/Traffic_Cameras_View/FeatureServer/0";

export async function scrapeIowaDot() {
  return scrapeArcgis({
    baseUrl: LAYER,
    opts: { pageSize: 1000 },
    mapFeature: ({ attrs, lat, lon }) => {
      const image = attrs.ImageURL || attrs.link;
      const stream = attrs.VideoURL_HD || attrs.VideoURL || attrs.VideoURL_HB;
      if (!image && !stream) return null;

      const id = String(attrs.device_id || attrs.OID || attrs.FID);
      const name = (attrs.Desc_ || attrs.ImageName || `IA Camera ${id}`).trim();

      const base = {
        id,
        name,
        lat,
        lon,
        state: "IA",
        route: attrs.Route || undefined,
        source: "iowa-dot",
        sourceName: "Iowa DOT / 511IA",
        sourceUrl: "https://511ia.org/",
        category: "traffic",
      };

      if (stream && /\.m3u8/i.test(stream)) {
        return { ...base, view: "hls", url: stream };
      }
      if (image && /^https?:\/\//i.test(image)) {
        return { ...base, view: "image", url: image, refresh: 20 };
      }
      return null;
    },
  });
}
