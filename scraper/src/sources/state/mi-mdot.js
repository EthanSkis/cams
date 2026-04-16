// MDOT MiDrive — Michigan traffic cameras (ArcGIS).
// Cleaner than the old HTML-string `/MiDrive/camera/list` endpoint; has
// Lat, Lon, Route, County, Location, Direction, Image directly.

import { scrapeArcgis } from "../../adapters/arcgis.js";

const LAYER =
  "https://services2.arcgis.com/67lKNkQ2TO1I3lhR/arcgis/rest/services/MiDrive Cameras/FeatureServer/0";

export async function scrapeMiMdot() {
  return scrapeArcgis({
    baseUrl: LAYER,
    opts: { pageSize: 1000 },
    mapFeature: ({ attrs, lat, lon }) => {
      const url = attrs.Image;
      if (!url || !/^https?:\/\//i.test(url)) return null;
      const attrLat = Number(attrs.Lat);
      const attrLon = Number(attrs.Lon);
      const fLat = Number.isFinite(attrLat) ? attrLat : lat;
      const fLon = Number.isFinite(attrLon) ? attrLon : lon;
      if (!Number.isFinite(fLat) || !Number.isFinite(fLon)) return null;

      const route = (attrs.Route || "").trim();
      const location = (attrs.Location || "").trim();
      const name = `${route}${location}`.trim() || `MI Camera ${attrs.OBJECTID}`;
      return {
        id: String(attrs.OBJECTID),
        name,
        description: attrs.Direction ? String(attrs.Direction) : undefined,
        lat: fLat,
        lon: fLon,
        state: "MI",
        region: attrs.County
          ? String(attrs.County).replace(/\s*County\s*$/i, "")
          : undefined,
        route: route || undefined,
        view: "image",
        url,
        refresh: 15,
        source: "mi-mdot",
        sourceName: "MDOT MiDrive",
        sourceUrl: "https://mdotjboss.state.mi.us/MiDrive/map",
        category: "traffic",
      };
    },
  });
}
