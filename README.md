# US Cams

A browsable map of tens of thousands of public US cameras — state DOT
traffic cameras, national park webcams, weather cams and more. Click any
marker to see the **live feed or a refreshing still image** depending on
what the source publishes.

Static site, no backend. Data is scraped into `assets/cameras.json` and
refreshed on a schedule by GitHub Actions.

## Camera sources

Currently aggregating **46,000+ cameras across 38 states**, all from public
feeds.

| Source                        | State(s)       | Format           |
| ----------------------------- | -------------- | ---------------- |
| Caltrans (12 districts)       | CA             | Still + HLS live |
| AlertCalifornia (CalOES)      | CA             | Still (wildfire) |
| San Diego County Flood        | CA             | Iframe           |
| WSDOT                         | WA             | Still            |
| King County + WSDOT feeds     | WA             | Still            |
| Seattle DOT                   | WA             | Still            |
| Kirkland (city)               | WA             | Still            |
| OR TripCheck / ODOT           | OR             | Still            |
| Salem (city)                  | OR             | Still            |
| AZ511                         | AZ             | Still            |
| 511 Idaho                     | ID             | Still            |
| 511 Alaska                    | AK             | Still            |
| UDOT                          | UT             | Still            |
| NVRoads                       | NV             | Still            |
| Wyoming / Teton County        | WY             | Still + HLS      |
| MnDOT (Minnesota)             | MN             | Still            |
| MoDOT (Missouri)              | MO             | HLS live         |
| KC Scout (Kansas City)        | MO/KS          | Still            |
| IDOT (Illinois)               | IL             | Still            |
| Iowa DOT                      | IA             | Still            |
| MDOT MiDrive                  | MI             | Still            |
| OHGO / Ohio DOT               | OH             | Still            |
| ARTIMIS (Cincinnati)          | OH/KY          | Still            |
| Lake Metroparks (Lake Cnty)   | OH             | Iframe           |
| 511PA                         | PA             | Still            |
| MDOT CHART                    | MD             | HLS live         |
| VDOT (Virginia)               | VA             | Still + HLS      |
| 511NY                         | NY             | Still            |
| NYC DOT / TMC                 | NY             | Still            |
| New England 511               | ME/NH/VT       | Still            |
| NCDOT                         | NC             | Still            |
| KYTC (Kentucky)               | KY             | Still            |
| Lexington (city)              | KY             | Still            |
| GDOT NaviGAtor                | GA             | Still + HLS      |
| 511GA                         | GA             | Still            |
| FL511                         | FL             | Still            |
| ALDOT / algotraffic           | AL             | Still + HLS      |
| Hawaii DOT / GoAkamai         | HI             | Still            |
| GCOOS (Gulf Coast cams)       | TX/LA/MS/AL/FL | Iframe           |
| 511 Louisiana                 | LA             | Still            |
| 511WI                         | WI             | Still            |
| Austin (city)                 | TX             | Still            |
| Arlington (city)              | TX             | Still            |
| Montgomery County             | TX             | Iframe           |
| Loveland (city)               | CO             | Still            |
| National Park Service         | nationwide     | Still + HLS + YT |

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
