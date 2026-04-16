// GDOT 511 Live Traffic Cameras (Georgia) — richer per-camera metadata
// than the IBI 511GA mapIcons feed. Preferred over 511GA for display;
// the normalizer dedups by coord + URL so having both is fine but this
// gives us names and routes.

import { scrapeArcgis } from "../../adapters/arcgis.js";

const LAYER =
  "https://services1.arcgis.com/2iUE8l8JKrP2tygQ/arcgis/rest/services/GDOT_Live_Traffic_Cameras/FeatureServer/0";

export async function scrapeGdotLive() {
  const out = [];
  await scrapeArcgis({
    baseUrl: LAYER,
    opts: { pageSize: 1000 },
    mapFeature: ({ attrs, lat, lon }) => {
      const image = attrs.url;
      const hls = attrs.HLS;
      if (!image && !hls) return null;

      const base = {
        id: String(attrs.cctv_id || attrs.ObjectId),
        name: attrs.name || attrs.location_description || `GDOT Camera ${attrs.cctv_id}`,
        description: attrs.location_description || undefined,
        lat,
        lon,
        state: "GA",
        region: attrs.county || attrs.subdivision || undefined,
        route: attrs.route || undefined,
        source: "gdot-live",
        sourceName: "GDOT NaviGAtor",
        sourceUrl: "https://www.511ga.org/",
        category: "traffic",
      };

      if (image && /^https?:\/\//i.test(image)) {
        out.push({ ...base, id: `${base.id}-img`, view: "image", url: image, refresh: 15 });
      }
      if (hls && /\.m3u8/i.test(hls)) {
        out.push({ ...base, id: `${base.id}-hls`, view: "hls", url: hls });
      }
      return null;
    },
  });
  return out;
}
