// Generic ArcGIS FeatureServer scraper. Many state DOTs publish their camera
// inventory as an ArcGIS Feature Service, which is CORS-open and paginates
// cleanly. This adapter handles pagination, resultOffset, and extracts common
// camera-ish fields.

import { fetchJson } from '../utils.js';

const REQUEST_SIZE = 2000; // ask for this many; server may return fewer

/**
 * Query a FeatureServer layer, yielding every feature via pagination.
 * Respects the server's `maxRecordCount` — pagination continues while the
 * server reports `exceededTransferLimit`, regardless of how many rows we
 * asked for vs. received.
 * @param {string} layerUrl - e.g. https://.../FeatureServer/0
 */
export async function* queryFeatures(layerUrl, { where = '1=1', outFields = '*' } = {}) {
  let offset = 0;
  for (;;) {
    const url =
      `${layerUrl}/query?` +
      new URLSearchParams({
        where,
        outFields,
        outSR: '4326',
        f: 'geojson',
        resultOffset: String(offset),
        resultRecordCount: String(REQUEST_SIZE)
      }).toString();
    const j = await fetchJson(url, { cacheMs: 5 * 60 * 1000 });
    const feats = j.features || [];
    for (const f of feats) yield f;
    const more = !!(j.properties && j.properties.exceededTransferLimit);
    if (!more || feats.length === 0) return;
    offset += feats.length;
    if (offset > 200_000) return; // safety
  }
}

/**
 * High-level helper: run an ArcGIS layer through a feature->camera mapper.
 * `mapFeature(feature, props) -> CameraInput | null`.
 *
 * Stops pagination either when the server says there's no more data, OR when
 * `maxFeatures` is reached, OR when we've gone `staleScanLimit` rows without
 * discovering a new camera id (defends against ArcGIS layers that serve
 * millions of duplicate rows per camera).
 */
export async function scrapeArcgis({
  layerUrl, source, region, where = '1=1', mapFeature,
  maxFeatures = 50_000, staleScanLimit = 20_000
}) {
  const byId = new Map();
  let scanned = 0;
  let staleSince = 0;
  for await (const feat of queryFeatures(layerUrl, { where })) {
    scanned++;
    if (scanned > maxFeatures) break;
    const props = feat.properties || {};
    const coords = feat.geometry?.coordinates;
    if (!coords || coords.length < 2) { staleSince++; if (staleSince > staleScanLimit) break; continue; }
    const lon = Number(coords[0]);
    const lat = Number(coords[1]);
    let rec;
    try { rec = mapFeature({ feat, props, lat, lon }); }
    catch { rec = null; }
    if (!rec) { staleSince++; if (staleSince > staleScanLimit) break; continue; }
    const id = rec.id ?? `${source}:${lat}-${lon}`;
    if (byId.has(id)) {
      staleSince++;
      if (staleSince > staleScanLimit) break;
      continue;
    }
    byId.set(id, { source, region, ...rec });
    staleSince = 0;
  }
  return Array.from(byId.values());
}

/**
 * Guess which property of a FeatureServer row holds the still-image URL.
 * Many DOT services name this Link, ImageURL, URL, CamURL, SnapshotURL, etc.
 */
export function guessImageUrl(props) {
  const keys = Object.keys(props);
  const preferred = [
    'ImageURL', 'imageurl', 'image_url', 'imageURL',
    'Link', 'LINK', 'link',
    'URL', 'url', 'Url',
    'CameraURL', 'cameraURL', 'CamURL',
    'SnapshotURL', 'snapshot_url', 'StillImageURL',
    'Image', 'IMAGE',
    'VideoURL', 'videourl'
  ];
  for (const k of preferred) {
    if (props[k] && typeof props[k] === 'string' && /^https?:/i.test(props[k])) return props[k];
  }
  // Fallback: any value that looks like an http image URL.
  for (const k of keys) {
    const v = props[k];
    if (typeof v === 'string' && /^https?:\/\/\S+\.(jpg|jpeg|png|webp)(\?|$)/i.test(v)) return v;
  }
  for (const k of keys) {
    const v = props[k];
    if (typeof v === 'string' && /^https?:\/\//i.test(v) && /cam|image|snap/i.test(k)) return v;
  }
  return null;
}

export function guessName(props) {
  const preferred = [
    'Location', 'LOCATION', 'location',
    'Name', 'NAME', 'name',
    'Description', 'DESCRIPTION', 'description',
    'Label', 'Title', 'CamName', 'Cam_Name', 'CameraName'
  ];
  for (const k of preferred) {
    if (typeof props[k] === 'string' && props[k].trim()) return props[k];
  }
  return null;
}

export function guessRoadway(props) {
  const preferred = ['Route', 'ROUTE', 'route', 'Roadway', 'roadway', 'Road', 'ROAD', 'Highway'];
  for (const k of preferred) {
    if (typeof props[k] === 'string' && props[k].trim()) return props[k];
  }
  return null;
}

export function guessDirection(props) {
  const preferred = ['Direction', 'DIRECTION', 'direction', 'Dir', 'DIR', 'dir'];
  for (const k of preferred) {
    if (typeof props[k] === 'string' && props[k].trim()) return props[k];
  }
  return null;
}
