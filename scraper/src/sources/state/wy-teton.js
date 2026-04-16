// Wyoming — Teton County webcams (both images and videos layers).
// The feature records include WYDOT cams + local scenic views.

import { scrapeArcgis } from "../../adapters/arcgis.js";

const LAYERS = [
  {
    url: "https://services9.arcgis.com/6ukHJ1QHS9lvQoRO/arcgis/rest/services/Teton_County_WY_Webcams_Images/FeatureServer/0",
    view: "image",
  },
  {
    url: "https://services9.arcgis.com/6ukHJ1QHS9lvQoRO/arcgis/rest/services/Teton_County_WY_Webcams_Video/FeatureServer/0",
    view: "hls",
  },
];

export async function scrapeWyTeton() {
  const all = [];
  for (const layer of LAYERS) {
    try {
      const recs = await scrapeArcgis({
        baseUrl: layer.url,
        opts: { pageSize: 1000 },
        mapFeature: ({ attrs, lat, lon }) => {
          const url = attrs.url;
          if (!url || !/^https?:\/\//i.test(url)) return null;
          const ct = String(attrs.camera_type || "").toLowerCase();
          let view = layer.view;
          if (ct === "image" || /\.jpe?g($|\?)/i.test(url)) view = "image";
          else if (/\.m3u8(\?|$)/i.test(url)) view = "hls";
          else if (/youtube\.com|youtu\.be/i.test(url)) view = "youtube";
          return {
            id: `${attrs.OBJECTID}-${view}`,
            name: attrs.view_area || `Teton Webcam ${attrs.OBJECTID}`,
            lat,
            lon,
            state: "WY",
            region: "Teton County",
            view,
            url,
            refresh: view === "image" ? 30 : undefined,
            source: "wy-teton",
            sourceName: "Teton County / WYDOT",
            sourceUrl: "https://www.wyoroad.info/",
            category: "traffic",
          };
        },
      });
      all.push(...recs);
    } catch (err) {
      console.warn(`    wy-teton layer failed: ${err.message}`);
    }
  }
  return all;
}
