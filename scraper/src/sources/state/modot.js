// Missouri DOT — Traveler Information CCTV with HLS live streams.

import { scrapeArcgis } from "../../adapters/arcgis.js";

const LAYER =
  "https://mapping.modot.org/arcgis/rest/services/TravelerInformation/NWSDATA/MapServer/0";

export async function scrapeMoDot() {
  return scrapeArcgis({
    baseUrl: LAYER,
    opts: { pageSize: 1000 },
    mapFeature: ({ attrs, lat, lon }) => {
      if (String(attrs.STREAM_ERROR || "").toUpperCase() === "Y") return null;
      const stream = attrs.URL2;
      const still = attrs.URL1;
      const id = String(attrs.CAM_ID);
      const name = attrs.DESCRIPTION || `MO Camera ${id}`;
      const base = {
        id,
        name,
        lat,
        lon,
        state: "MO",
        source: "modot",
        sourceName: "MoDOT Traveler Information",
        sourceUrl: "https://traveler.modot.org/map/",
        category: "traffic",
      };
      if (stream && /\.m3u8/i.test(stream)) {
        return { ...base, view: "hls", url: stream };
      }
      if (still && /^https?:\/\//i.test(still)) {
        return { ...base, view: "image", url: still, refresh: 30 };
      }
      return null;
    },
  });
}
