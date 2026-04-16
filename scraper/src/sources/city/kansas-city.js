// Kansas City / KC Scout cameras (ArcGIS).
// Covers the Kansas City metro — includes both MO and KS side of the line.

import { scrapeArcgis } from "../../adapters/arcgis.js";

const LAYER =
  "https://services1.arcgis.com/g2TonOxuRkIqSOFx/arcgis/rest/services/Kansas_City_Traffic_Camera_Locations/FeatureServer/0";

export async function scrapeKansasCity() {
  return scrapeArcgis({
    baseUrl: LAYER,
    opts: { pageSize: 1000 },
    mapFeature: ({ attrs, lat, lon }) => {
      const url = attrs.ImageName;
      if (!url || !/^https?:\/\//i.test(url)) return null;
      const attrLat = Number(attrs.LATITUDE);
      const attrLon = Number(attrs.LONGITUDE);
      const fLat = Number.isFinite(attrLat) ? attrLat : lat;
      const fLon = Number.isFinite(attrLon) ? attrLon : lon;
      if (!Number.isFinite(fLat) || !Number.isFinite(fLon)) return null;
      const state = fLon < -94.6 ? "KS" : "MO";
      return {
        id: String(attrs.Id || attrs.FID),
        name: attrs.Description || `KC Scout ${attrs.Id}`,
        lat: fLat,
        lon: fLon,
        state,
        region: "Kansas City",
        view: "image",
        url,
        refresh: Math.max(
          5,
          Math.round(Number(attrs.RefreshRate) / 1000) || 10,
        ),
        source: "kc-scout",
        sourceName: "KC Scout",
        sourceUrl: "https://www.kcscout.net/",
        category: "traffic",
      };
    },
  });
}
