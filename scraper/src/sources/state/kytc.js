// KYTC — Kentucky Transportation Cabinet traffic cameras (ArcGIS).
// The feature layer carries name, snapshot URL, description, direction,
// and coords directly — perfect for our normalizer.
//
// Note: the layer includes a few cross-border cameras (e.g. TN or IN side
// of river bridges) that we keep because they're genuinely US and live.

import { scrapeArcgis } from "../../adapters/arcgis.js";

const LAYER =
  "https://maps.kytc.ky.gov/arcgis/rest/services/RealTime/TrafficCameras_Ext_Prd/MapServer/0";

function stateFromDescription(desc) {
  if (!desc) return "KY";
  const s = String(desc).toLowerCase();
  if (s.includes("indiana")) return "IN";
  if (s.includes("tennessee")) return "TN";
  if (s.includes("ohio")) return "OH";
  if (s.includes("illinois")) return "IL";
  if (s.includes("virginia")) return "VA";
  if (s.includes("west virginia")) return "WV";
  if (s.includes("missouri")) return "MO";
  return "KY";
}

export async function scrapeKytc() {
  return scrapeArcgis({
    baseUrl: LAYER,
    opts: { pageSize: 1000 },
    mapFeature: ({ attrs, lat, lon }) => {
      const url = attrs.snapshot;
      if (!url || !/^https?:\/\//i.test(url)) return null;
      const status = String(attrs.status || "").toLowerCase();
      if (["offline", "error", "broken", "disabled"].includes(status)) return null;
      const id = attrs.id ?? attrs.oid;
      const desc = attrs.description || attrs.name || `KY Cam ${id}`;
      return {
        id: `oid-${attrs.oid}`,
        name: attrs.name || desc,
        description:
          attrs.highway && attrs.milemarker != null
            ? `${attrs.highway} @ MM ${attrs.milemarker}`
            : desc,
        lat,
        lon,
        state: stateFromDescription(desc),
        region: attrs.county || undefined,
        route: attrs.highway || undefined,
        view: "image",
        url,
        refresh: 20,
        source: "kytc",
        sourceName: "KYTC / Kentucky Transportation",
        sourceUrl: "https://goky.ky.gov/",
        category: "traffic",
      };
    },
  });
}
