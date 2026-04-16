// Adapter for ArcGIS Feature/MapServer `query` endpoints.
//
// Many state DOTs publish traffic cameras as an ArcGIS layer. This fetches
// all features (paged) and converts them to the normalized shape using a
// provided mapping function.
//
// `mapFeature({ attrs, lat, lon })` must return a raw camera record (or null).

import { fetchJson } from "../utils.js";

// Convert Web Mercator (EPSG:3857 / 102100) meters to WGS84 lat/lon.
function webMercatorToLatLon(x, y) {
  const lon = (x / 20037508.34) * 180;
  let lat = (y / 20037508.34) * 180;
  lat = (180 / Math.PI) * (2 * Math.atan(Math.exp((lat * Math.PI) / 180)) - Math.PI / 2);
  return { lat, lon };
}

export async function fetchArcgisLayer(baseUrl, opts = {}) {
  const {
    where = "1=1",
    outFields = "*",
    pageSize = 1000,
    extraParams = "",
  } = opts;

  const features = [];
  let offset = 0;
  // Some servers enforce a hard max record count. Loop until exhausted.
  for (let i = 0; i < 200; i++) {
    const url =
      `${baseUrl}/query?where=${encodeURIComponent(where)}` +
      `&outFields=${encodeURIComponent(outFields)}` +
      `&returnGeometry=true&outSR=4326&f=json` +
      `&resultOffset=${offset}&resultRecordCount=${pageSize}` +
      (extraParams ? `&${extraParams}` : "");
    const json = await fetchJson(url, { timeout: 45000 });
    if (json.error) {
      throw new Error(`ArcGIS error: ${json.error.message || json.error.code}`);
    }
    const batch = json.features || [];
    if (batch.length === 0) break;
    for (const f of batch) {
      const attrs = f.attributes || {};
      let lat = null;
      let lon = null;
      const g = f.geometry;
      if (g && typeof g.x === "number" && typeof g.y === "number") {
        const sr = json.spatialReference?.wkid || g.spatialReference?.wkid || 4326;
        if (sr === 4326) {
          lon = g.x;
          lat = g.y;
        } else if (sr === 102100 || sr === 3857 || sr === 102113) {
          const ll = webMercatorToLatLon(g.x, g.y);
          lat = ll.lat;
          lon = ll.lon;
        } else {
          // Unknown SR; skip.
          continue;
        }
      } else {
        continue;
      }
      features.push({ attrs, lat, lon });
    }
    if (!json.exceededTransferLimit && batch.length < pageSize) break;
    offset += batch.length;
  }
  return features;
}

export async function scrapeArcgis({ baseUrl, mapFeature, opts = {} }) {
  const features = await fetchArcgisLayer(baseUrl, opts);
  const out = [];
  for (const f of features) {
    try {
      const rec = mapFeature(f);
      if (rec) out.push(rec);
    } catch {
      // Skip malformed records.
    }
  }
  return out;
}
