# US Public Cameras — Map & Feed Viewer

A fully static, zero-backend web app that plots publicly available live cameras
across the United States on a Leaflet map and streams each feed directly in the
browser.

- **No server.** Everything runs from `index.html` on GitHub Pages (or any
  static host, or even `file://`).
- **Build-time scraping.** A Node.js scraper under `scraper/` collects camera
  metadata from dozens of public sources and writes `assets/cameras.json`,
  which the frontend consumes at runtime.

## Live site

Deployed by `.github/workflows/pages.yml` on every push to the release branch.

## Repo layout

```
/
├── index.html                # single-page viewer
├── assets/
│   ├── app.js                # map, filters, feed dispatcher (Leaflet + hls.js)
│   ├── app.css
│   └── cameras.json          # built artifact (committed)
├── scraper/
│   ├── package.json
│   └── src/
│       ├── index.js          # entry point — discovers every source module
│       ├── normalize.js      # canonical Camera schema + validator
│       ├── utils.js          # fetch/retry/disk-cache helpers
│       ├── adapters/
│       │   ├── arcgis.js     # generic ArcGIS FeatureServer scraper
│       │   └── ibi511.js     # generic IBI Group "511" REST scraper
│       └── sources/
│           ├── state/        # state DOT adapters (ArcGIS + key-gated IBI)
│           ├── city/         # NYC TMC, etc.
│           ├── federal/      # NPS, NWS
│           └── misc/         # beach, ski, EarthCam, …
└── .github/workflows/
    ├── pages.yml             # deploy to GitHub Pages
    └── refresh.yml           # weekly cron: re-run scraper, commit JSON
```

## Running the scraper

```sh
cd scraper
node src/index.js             # produces ../assets/cameras.json
node src/index.js --dry       # don't write
node src/index.js --only=nyctmc,arcgis-states
```

No `npm install` is required — the scraper is dependency-free.

## Enabling more sources

Many state DOT 511 systems require a free developer API key. Request a key
from the state's developer portal, then export the corresponding env var
before re-running the scraper:

| State | Env var | Portal |
|---|---|---|
| New York | `KEY_511NY` | <https://511ny.org/developers> |
| Virginia | `KEY_511VA` | <https://511virginia.org/developers> |
| Florida | `KEY_511FL` | <https://fl511.com/developers> |
| Georgia | `KEY_511GA` | <https://511ga.org/developers> |
| Pennsylvania | `KEY_511PA` | <https://www.511pa.com/developers> |
| Washington | `KEY_WSDOT` | <https://wsdot.wa.gov/traffic/api/> |
| National Park Service | `KEY_NPS` | <https://www.nps.gov/subjects/developer> |
| …and many more | see `scraper/src/sources/state/ibi511-keyed.js` | |

In CI, add the corresponding repo secrets (Settings → Secrets and variables →
Actions). `.github/workflows/refresh.yml` wires them into the scraper.

## Frontend

- Loads `assets/cameras.json` once, then renders markers into a clustered
  Leaflet layer (`Leaflet.markercluster`).
- Filter by text (name / road / locality), source, state, and category.
- Click a marker to open the viewer. Supports these feed types:
  - `jpeg` — polled with cache-bust at the per-feed refresh interval
  - `mjpeg` — native `<img>`
  - `hls` — `hls.js` (falls back to native Safari playback)
  - `iframe` / `youtube` — sandboxed `<iframe>`
- Cameras with multiple feeds get tab-switchers; on load error, the viewer
  auto-advances to the next feed.
- Map view and the selected camera are reflected in the URL hash, so links
  like `#@40.75,-73.98,12z&cam=nyctmc:abc…` are shareable.

## Caveats

- **Aspirational, not exhaustive.** "Every camera in the US" is a target, not
  a promise. Different DOTs use different back-ends; many require API keys;
  some publish locations without stable stream URLs. The current seed data
  includes ~3,500 cameras from NYC DOT, VDOT, CDOT, NCDOT, and a
  community-mirrored WSDOT layer. Setting more API keys in CI expands
  coverage to most states.
- **Mixed content.** Some DOT images are served over plain HTTP; browsers
  block those on HTTPS pages. The viewer auto-falls-back to the next feed
  when this happens — but there's no way around the block from a static site.
- **Feed reliability.** Upstream feeds change URLs, add auth, or go offline
  without notice. The weekly refresh workflow catches most drift.

## Attribution

Data © the respective departments of transportation and public agencies.
Map tiles © OpenStreetMap contributors. This project is a convenience
viewer; all displayed imagery remains the property of its source.
