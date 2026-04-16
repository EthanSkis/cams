// VDOT — Virginia Department of Transportation.
//
// This layer is a public view of VDOT's full CCTV inventory with both
// still image URLs and iOS-friendly HLS streams.

import { scrapeArcgis } from "../../adapters/arcgis.js";

const LAYER =
  "https://services.arcgis.com/hRUr1F8lE8Jq2uJo/arcgis/rest/services/CameraLocationVDOT/FeatureServer/0";

export async function scrapeVdot() {
  const out = [];
  await scrapeArcgis({
    baseUrl: LAYER,
    opts: { pageSize: 1000 },
    mapFeature: ({ attrs, lat, lon }) => {
      if (String(attrs.active).toLowerCase() === "false") return null;
      const attrLat = Number(attrs.latitude);
      const attrLon = Number(attrs.longitude);
      const fLat = Number.isFinite(attrLat) ? attrLat : lat;
      const fLon = Number.isFinite(attrLon) ? attrLon : lon;
      if (!Number.isFinite(fLat) || !Number.isFinite(fLon)) return null;
      const id = attrs.id ? String(attrs.id) : String(attrs.objectid || attrs.FID);

      const base = {
        id,
        name: attrs.descriptio || `VDOT ${attrs.route} ${attrs.direction}`.trim(),
        description: attrs.mm != null ? `MM ${attrs.mm}` : undefined,
        lat: fLat,
        lon: fLon,
        state: "VA",
        region: attrs.jurisdicti || undefined,
        route: attrs.route || undefined,
        source: "va-vdot",
        sourceName: "VDOT (Virginia)",
        sourceUrl: "https://www.511virginia.org/",
        category: "traffic",
      };

      const image = attrs.image_url;
      const stream = attrs.ios_url;

      if (image && /^https?:\/\//i.test(image)) {
        out.push({ ...base, id: `${id}-img`, view: "image", url: image, refresh: 30 });
      }
      if (stream && /\.m3u8/i.test(stream)) {
        out.push({
          ...base,
          id: `${id}-hls`,
          name: `${base.name} (live)`,
          view: "hls",
          url: stream,
        });
      }
      return null; // We push directly.
    },
  });
  return out;
}
