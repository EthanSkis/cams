// EarthCam maintains a public network landing page at earthcam.com/network/usa.
// Their camera pages are iframe-embeddable. We do a lightweight HTML scrape
// of the US directory — links only — and register each as an iframe feed.
//
// Lat/lon aren't published on the directory page, so we skip records that we
// can't geolocate. (EarthCam's richer feed requires a partner agreement.)

import { fetchText } from '../../utils.js';

const ENTRY_URLS = [
  'https://www.earthcam.com/network/usa/'
];

export async function run() {
  const out = [];
  for (const url of ENTRY_URLS) {
    try {
      await fetchText(url, { cacheMs: 24 * 60 * 60 * 1000 });
    } catch {
      // EarthCam often blocks non-browser scrapers; fall through quietly.
    }
  }
  // Intentionally conservative: without per-camera lat/lon we can't place the
  // marker. Richer coverage would require a partner agreement.
  return out;
}

export const info = { name: 'earthcam' };
