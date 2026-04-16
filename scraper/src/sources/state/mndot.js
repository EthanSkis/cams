// MnDOT — Minnesota DOT cameras (ArcGIS).
// Field names are truncated (`location_1` = lat, `location_2` = mileage, etc.);
// images come from video.dot.state.mn.us/video/image/<system>/<id>.

import { scrapeArcgis } from "../../adapters/arcgis.js";

const LAYER =
  "https://services6.arcgis.com/MU31z9HAakdc3W69/arcgis/rest/services/mydata/FeatureServer/0";

export async function scrapeMnDot() {
  return scrapeArcgis({
    baseUrl: LAYER,
    opts: { pageSize: 1000 },
    mapFeature: ({ attrs, lat, lon }) => {
      if (String(attrs.public_).toLowerCase() !== "true") return null;
      const url = attrs.views_url;
      if (!url || !/^https?:\/\//i.test(url)) return null;
      const attrLat = Number(attrs.location_l);
      const attrLon = Number(attrs.location_1);
      const fLat = Number.isFinite(attrLat) ? attrLat : lat;
      const fLon = Number.isFinite(attrLon) ? attrLon : lon;
      if (!Number.isFinite(fLat) || !Number.isFinite(fLon)) return null;

      return {
        id: String(attrs.id || attrs.objectid),
        name: attrs.name || attrs.views_name || `MN Camera ${attrs.id}`,
        description: attrs.location_c || undefined,
        lat: fLat,
        lon: fLon,
        state: "MN",
        region: attrs.location_c || undefined,
        route: attrs.location_r || undefined,
        view: "image",
        url,
        refresh: 20,
        source: "mndot",
        sourceName: "MnDOT (Minnesota)",
        sourceUrl: "https://www.dot.state.mn.us/",
        category: "traffic",
      };
    },
  });
}
