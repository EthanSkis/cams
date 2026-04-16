// Maryland DOT CHART — statewide CCTV inventory (ArcGIS).
// Each feature carries an HLS live stream URL (hlsurl) and a public
// viewer page (CCTVPublicURL). We prefer the stream.

import { scrapeArcgis } from "../../adapters/arcgis.js";

const LAYER =
  "https://chartimap1.sha.maryland.gov/arcgis/rest/services/CHART/Cameras/MapServer/0";

export async function scrapeMdChart() {
  return scrapeArcgis({
    baseUrl: LAYER,
    opts: { pageSize: 1000 },
    mapFeature: ({ attrs, lat, lon }) => {
      const hls = attrs.hlsurl;
      const page = attrs.CCTVPublicURL;
      const name = attrs.location || `MD CHART ${attrs.rowid}`;
      const base = {
        id: String(attrs.ID || attrs.rowid),
        name,
        lat,
        lon,
        state: "MD",
        source: "md-chart",
        sourceName: "MDOT CHART",
        sourceUrl: "https://chart.maryland.gov/",
        category: "traffic",
      };
      if (hls && /^https?:\/\//i.test(hls)) {
        return { ...base, view: "hls", url: hls };
      }
      if (page && /^https?:\/\//i.test(page)) {
        return { ...base, view: "page", url: page };
      }
      return null;
    },
  });
}
