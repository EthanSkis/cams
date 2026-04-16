// Gulf Coast Ocean Observing System (GCOOS) WebCams.
// Beach/coastal cameras around the Gulf of Mexico (FL, AL, MS, LA, TX).

import { scrapeArcgis } from "../../adapters/arcgis.js";

const LAYER =
  "https://services1.arcgis.com/qr14biwnHA6Vis6l/arcgis/rest/services/Gulf_Coast_WebCam_Location/FeatureServer/0";

const STATE_MAP = {
  Florida: "FL",
  Alabama: "AL",
  Mississippi: "MS",
  Louisiana: "LA",
  Texas: "TX",
};

export async function scrapeGulfCoast() {
  return scrapeArcgis({
    baseUrl: LAYER,
    opts: { pageSize: 500 },
    mapFeature: ({ attrs, lat, lon }) => {
      const url = attrs.url;
      if (!url || !/^https?:\/\//i.test(url)) return null;
      return {
        id: String(attrs.fid || attrs.objectid_1),
        name: attrs.name || `Gulf Coast Cam ${attrs.fid}`,
        description: attrs.note || undefined,
        lat,
        lon,
        state: STATE_MAP[attrs.state] || null,
        region: attrs.address || attrs.location || undefined,
        view: "iframe",
        url,
        source: "gulf-gcoos",
        sourceName: "GCOOS (Gulf Coast)",
        sourceUrl: "https://gcoos.org/",
        category: "beach",
      };
    },
  });
}
