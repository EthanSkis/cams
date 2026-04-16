# scraper

Fetches public US camera feeds and writes a normalized
`../assets/cameras.json`.

```sh
node src/index.js
```

Node 20+ is required. No external dependencies — the scraper uses only
Node's built-in `fetch` and friends.

## Layout

```
src/
  index.js            # main entry, runs every source
  normalize.js        # validates, dedupes, and picks a `view` per record
  utils.js            # small helpers (fetch with retry, bbox check, etc.)
  adapters/
    arcgis.js         # paged ArcGIS Feature/MapServer query
    ibi511.js         # `/map/mapIcons/Cameras` + `/map/Cctv/{id}` pattern
  sources/
    state/            # one file per state feed
    city/
    federal/
```

To add a source, drop a new file under `sources/`, return an array of raw
records from an async function, and import it from `index.js`.

## Output schema

Each record in `cameras.json` looks like:

```jsonc
{
  "id": "caltrans:d7-123-img",
  "name": "I-5 N at Florence Ave",
  "lat": 33.95, "lon": -118.25,
  "state": "CA",
  "route": "I-5",
  "region": "Los Angeles",
  "view": "image",                // "image"|"hls"|"mjpeg"|"youtube"|"iframe"|"page"
  "url":  "https://...jpg",
  "refresh": 5,                   // seconds (images only)
  "source": "caltrans",
  "sourceName": "Caltrans",
  "sourceUrl": "https://cwwp2.dot.ca.gov/vm/iframemap.htm",
  "category": "traffic"
}
```

For Caltrans and NPS sources, the scraper emits separate records for the
still image and the HLS live stream when both are available, so users can
pick whichever their browser handles best.
