// State DOT cameras published on ArcGIS FeatureServers.
//
// Each entry is (roughly) one state. The mapFeature shape varies per state
// because every DOT schema is different; we keep them in one file so the
// vendor differences are easy to scan.
//
// Adding a state: find its camera FeatureServer (search arcgis.com for "<state>
// DOT cameras"), inspect ?f=json to see field names, and add an entry.

import { scrapeArcgis, guessImageUrl, guessName, guessRoadway, guessDirection } from '../../adapters/arcgis.js';

const STATES = [
  {
    slug: 'vdot',
    region: 'VA',
    tags: ['traffic', 'highway'],
    layerUrl: 'https://services.arcgis.com/hRUr1F8lE8Jq2uJo/arcgis/rest/services/CameraLocationVDOT/FeatureServer/0',
    mapFeature({ props, lat, lon }) {
      const img = guessImageUrl(props);
      if (!img) return null;
      return {
        id: `vdot:${props.OBJECTID ?? props.ID ?? img}`,
        name: guessName(props) || `VDOT Camera ${props.OBJECTID ?? ''}`,
        roadway: guessRoadway(props),
        direction: guessDirection(props),
        lat, lon,
        feeds: [{ type: 'jpeg', url: img, refreshSec: 10 }]
      };
    }
  },
  // TxDOT's ArcGIS layer exposes camera locations but not the still-image URL
  // (that lives behind its.txdot.gov via a redirect service that 404s on the
  // public internet). Until we find a stable image pattern, the ~2,800 Texas
  // cameras come in via the 511tx IBI source (KEY_511TX env var).
  // CDOT's ArcGIS layer exposes camera positions and *links* to cotrip.org,
  // but cotrip.org is an SPA — every URL returns the same HTML page, so the
  // "image" URLs in URL_Cam don't actually resolve to JPEGs. Until we find a
  // stable image endpoint, we exclude Colorado rather than ship 900 broken
  // entries.
  // {
  //   slug: 'cdot', region: 'CO', ...
  // },
  {
    slug: 'ncdot',
    region: 'NC',
    tags: ['traffic', 'highway'],
    layerUrl: 'https://services.arcgis.com/NuWFvHYDMVmmxMeM/arcgis/rest/services/NCDOT_TIMSCameras/FeatureServer/0',
    // The NCDOT service contains ~200k rows with massive duplication per
    // CameraID. The stale-scan cap stops us after a contiguous block of
    // duplicates; in practice we capture ~300 cameras, which is a fraction
    // of the ~1800 that exist. Expanding coverage requires a NCDOT-specific
    // adapter that pages through distinct IDs via groupByFieldsForStatistics.
    // NCDOT serves snapshots via their cameras/images endpoint; the Link field
    // already contains the usable URL.
    mapFeature({ props, lat, lon }) {
      const img = props.Link;
      if (!img || typeof img !== 'string') return null;
      return {
        id: `ncdot:${props.CameraID ?? props.OBJECTID}`,
        name: props.Location || `NCDOT Camera ${props.CameraID}`,
        lat, lon,
        feeds: [{ type: 'jpeg', url: img, refreshSec: 15 }]
      };
    }
  },
  {
    slug: 'wsdot',
    region: 'WA',
    tags: ['traffic', 'highway'],
    // Community-maintained mirror of WSDOT cams — accessible without an access code.
    layerUrl: 'https://services3.arcgis.com/NJJAMXTzj98caILi/arcgis/rest/services/WashdotTrafficCams/FeatureServer/0',
    mapFeature({ props, lat, lon }) {
      const img = guessImageUrl(props);
      if (!img) return null;
      return {
        id: `wsdot:${props.OBJECTID ?? img}`,
        name: guessName(props) || `WSDOT Camera ${props.OBJECTID ?? ''}`,
        roadway: guessRoadway(props),
        direction: guessDirection(props),
        lat, lon,
        feeds: [{ type: 'jpeg', url: img, refreshSec: 15 }]
      };
    }
  }
];

export async function run() {
  const all = [];
  for (const s of STATES) {
    try {
      const rows = await scrapeArcgis({
        layerUrl: s.layerUrl,
        source: s.slug,
        region: s.region,
        orderBy: s.orderBy,
        mapFeature: s.mapFeature
      });
      for (const r of rows) r.tags = r.tags || s.tags;
      all.push(...rows);
      console.log(`  [${s.slug}] ${rows.length}`);
    } catch (e) {
      console.warn(`  [${s.slug}] FAILED: ${e.message.split('\n')[0]}`);
    }
  }
  return all;
}

export const info = { name: 'arcgis-states' };
