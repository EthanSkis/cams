// Montgomery County, TX — live cameras (ArcGIS).
//
// FEEDURL points to an HLS stream hosted on cameras.mctraffic.org.

import { scrapeArcgis } from "../../adapters/arcgis.js";

const LAYER =
  "https://services1.arcgis.com/PRoAPGnMSUqvTrzq/arcgis/rest/services/MCTX_Live_Cameras/FeatureServer/0";

export async function scrapeMontgomeryTx() {
  return scrapeArcgis({
    baseUrl: LAYER,
    opts: { pageSize: 1000 },
    mapFeature: ({ attrs, lat, lon }) => {
      const url = attrs.FEEDURL;
      if (!url || !/^https?:\/\//i.test(url)) return null;
      const name = attrs.SITENAME || `Montgomery County Camera ${attrs.OBJECTID}`;
      // FEEDURL format: http://cameras.mctraffic.org/<uuid> — add /playlist.m3u8
      // for HLS embed; unknown whether that works for all. We default to
      // iframe so the user always gets a playable view.
      return {
        id: String(attrs.OBJECTID),
        name,
        description: attrs.CAMERATYP ? `Camera: ${attrs.CAMERATYP}` : undefined,
        lat,
        lon,
        state: "TX",
        region: "Montgomery County",
        view: "iframe",
        url,
        source: "montgomery-tx",
        sourceName: "Montgomery County, TX",
        sourceUrl: "https://cameras.mctraffic.org/",
        category: "city",
      };
    },
  });
}
