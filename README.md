# US Cams

A browsable map of tens of thousands of public US cameras — state DOT
traffic cameras, national park webcams, weather cams and more. Click any
marker to see the **live feed or a refreshing still image** depending on
what the source publishes.

Static site, no backend. Data is scraped into `assets/cameras.json` and
refreshed on a schedule by GitHub Actions.

## Camera sources

| Source                | State(s)   | Cameras | Format            |
| --------------------- | ---------- | ------- | ----------------- |
| Caltrans              | CA         | ~5k     | Still + HLS live  |
| WSDOT                 | WA         | ~1.6k   | Still             |
| 511PA                 | PA         | ~1.5k   | Still             |
| 511NY                 | NY         | ~2.3k   | Still             |
| 511WI                 | WI         | ~450    | Still             |
| 511GA                 | GA         | ~3.8k   | Still             |
| FL511                 | FL         | ~4.7k   | Still             |
| 511 Idaho             | ID         | ~450    | Still             |
| AZ511                 | AZ         | ~640    | Still             |
| 511 Louisiana         | LA         | ~335    | Still             |
| NVRoads               | NV         | ~640    | Still             |
| New England 511       | ME/NH/VT   | ~420    | Still             |
| 511 Alaska            | AK         | ~115    | Still             |
| UDOT                  | UT         | ~2k     | Still             |
| OHGO / Ohio DOT       | OH         | ~1.2k   | Still             |
| NCDOT                 | NC         | ~780    | Still             |
| NYC DOT / TMC         | NYC        | ~950    | Still             |
| National Park Service | nationwide | ~230    | Still + HLS + YT  |

All sources are public. Cameras belong to their respective agencies.

## Run locally

```sh
cd scraper && node src/index.js   # writes ../assets/cameras.json
cd ..
python3 -m http.server 8080       # then open http://localhost:8080
```

Node 20+ is required. No npm install needed; the scraper uses only
the Node standard library.

## Deploy

The repo is configured for GitHub Pages:

- `.github/workflows/refresh.yml` re-runs the scraper every 6 hours and
  commits a new `assets/cameras.json` if it changed.
- `.github/workflows/pages.yml` publishes the site on pushes to `main`
  and after each refresh run.

Enable Pages → "GitHub Actions" in the repo settings, then push.

## How the viewer decides image vs. live

Each record in `cameras.json` carries a `view` field:

- `image` — refreshing still JPEG (most DOT traffic cams)
- `hls` — live `.m3u8` stream, played with [hls.js](https://github.com/video-dev/hls.js/)
- `mjpeg` — live MJPEG (rendered as a single `<img>`)
- `youtube` — embedded YouTube live stream
- `iframe` — opaque embed
- `page` — sources that don't publish a direct feed — we link out

The `refresh` field hints at how often the viewer should bust the image
cache (seconds). The scraper sets sensible defaults per source.

## Adding a new source

Add a file under `scraper/src/sources/<scope>/<name>.js` that exports an
async function returning raw records, then import it from
`scraper/src/index.js`. Raw records go through `normalize.js`, which
validates the geometry (US bounding box), dedupes, and picks a `view`
from your output.
