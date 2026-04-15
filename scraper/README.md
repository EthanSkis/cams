# Camera scraper

Dependency-free Node.js scraper that discovers every `sources/**/*.js`
module, runs each one's default-exported `run()`, normalizes the union,
and writes `../assets/cameras.json`.

## Run it

```sh
node src/index.js                         # full run
node src/index.js --dry                   # skip writing the output file
node src/index.js --only=nyctmc,vdot      # run a subset by module name
```

Requires Node.js 20+. No `npm install` needed.

## Add a source

1. Drop a new file under `src/sources/<group>/`.
2. Export `async function run()` returning an array of `CameraInput`
   records shaped like:
   ```js
   {
     id: 'mysource:unique-key',        // optional but recommended
     source: 'mysource',               // filled automatically from module if missing
     region: 'TX',                     // USPS 2-letter, optional
     locality: 'Austin',               // optional
     name: 'I-35 at 6th St',
     roadway: 'I-35',                  // optional
     direction: 'N',                   // optional
     lat: 30.2672,
     lon: -97.7431,
     feeds: [
       { type: 'jpeg', url: '…', refreshSec: 10 },
       { type: 'hls',  url: '…' }
     ],
     tags: ['traffic', 'highway']
   }
   ```
3. If the source requires an API key, read it with `requireEnv('KEY_*')`
   and return `[]` when unset — `index.js` will skip quietly.
4. The normalizer (`normalize.js`) drops records missing lat/lon or all
   feeds, de-dupes by `id`, and validates feed URLs.

## Env vars

See the "Enabling more sources" table in the top-level `README.md`.

## On-disk cache

Every fetch is cached under `.cache/` for 5 minutes by default (see
`utils.js`). Delete the directory to force a fresh scrape:

```sh
rm -rf .cache && node src/index.js
```
