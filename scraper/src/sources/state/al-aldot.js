// ALDOT — Alabama DOT / algotraffic.com cameras (ArcGIS).
//
// Records carry both a still image URL and an HLS stream URL; emit a
// record for each that is populated.

import { scrapeArcgis } from "../../adapters/arcgis.js";

const LAYER =
  "https://services7.arcgis.com/33Tmvrm3G2UZLFK9/arcgis/rest/services/ALDOT_TC_HLS_Public/FeatureServer/0";

export async function scrapeAldot() {
  const out = [];
  await scrapeArcgis({
    baseUrl: LAYER,
    opts: { pageSize: 1000 },
    mapFeature: ({ attrs, lat, lon }) => {
      if (String(attrs.Disabled).toLowerCase() === "true") return null;
      const image = attrs.ImageUrl;
      const stream = attrs.StreamUrl;
      const attrLat = Number(attrs.Latitude);
      const attrLon = Number(attrs.Longitude);
      const fLat = Number.isFinite(attrLat) ? attrLat : lat;
      const fLon = Number.isFinite(attrLon) ? attrLon : lon;
      if (!Number.isFinite(fLat) || !Number.isFinite(fLon)) return null;

      const base = {
        id: String(attrs.Id || attrs.DeviceId),
        name: attrs.Name || attrs.PrimaryRoad || `AL Camera ${attrs.Id}`,
        description: attrs.CrossStreet ? `at ${attrs.CrossStreet}` : undefined,
        lat: fLat,
        lon: fLon,
        state: "AL",
        region: attrs.OrganizationId || undefined,
        route: attrs.PrimaryRoad || undefined,
        source: "al-aldot",
        sourceName: "ALDOT / algotraffic.com",
        sourceUrl: "https://algotraffic.com/",
        category: "traffic",
      };

      if (image && /^https?:\/\//i.test(image) && attrs.ImageSupported) {
        out.push({ ...base, id: `${base.id}-img`, view: "image", url: image, refresh: 15 });
      }
      if (stream && /\.m3u8/i.test(stream)) {
        out.push({ ...base, id: `${base.id}-hls`, view: "hls", url: stream });
      }
      return null;
    },
  });
  return out;
}
