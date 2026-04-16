// Main scraper entry point. Runs every source, normalizes and deduplicates
// the results, and writes the combined list to ../assets/cameras.json.

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { normalizeAll } from "./normalize.js";
import { logSource } from "./utils.js";

import { scrapeCaltrans } from "./sources/state/caltrans.js";
import { scrapeWsdot } from "./sources/state/wsdot.js";
import { scrapeAllIbi511 } from "./sources/state/ibi511.js";
import { scrapeOhgo } from "./sources/state/ohgo.js";
import { scrapeNcdot } from "./sources/state/ncdot.js";
import { scrapeNycTmc } from "./sources/city/nyc-tmc.js";
import { scrapeNps } from "./sources/federal/nps.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = resolve(__dirname, "..", "..", "assets", "cameras.json");

const SOURCES = [
  { name: "caltrans",     fn: scrapeCaltrans },
  { name: "wsdot",        fn: scrapeWsdot },
  { name: "ibi511-group", fn: scrapeAllIbi511 },
  { name: "ohgo",         fn: scrapeOhgo },
  { name: "ncdot",        fn: scrapeNcdot },
  { name: "nyc-tmc",      fn: scrapeNycTmc },
  { name: "nps-webcams",  fn: scrapeNps },
];

async function main() {
  console.log("Scraping cameras…");
  const raw = [];
  for (const s of SOURCES) {
    try {
      const recs = await s.fn();
      raw.push(...recs);
      logSource(s.name, recs.length);
    } catch (err) {
      logSource(s.name, 0, err);
    }
  }

  const cameras = normalizeAll(raw);
  const byCategory = {};
  const byState = {};
  const bySource = {};
  for (const c of cameras) {
    byCategory[c.category] = (byCategory[c.category] || 0) + 1;
    if (c.state) byState[c.state] = (byState[c.state] || 0) + 1;
    bySource[c.source] = (bySource[c.source] || 0) + 1;
  }

  const payload = {
    generated: new Date().toISOString(),
    count: cameras.length,
    byCategory,
    byState,
    bySource,
    cameras,
  };

  mkdirSync(dirname(OUT_PATH), { recursive: true });
  writeFileSync(OUT_PATH, JSON.stringify(payload));
  console.log(
    `\nWrote ${cameras.length} cameras to ${OUT_PATH}\n  by category: ${JSON.stringify(byCategory)}\n  by state: ${Object.keys(byState).length} states\n  by source: ${JSON.stringify(bySource)}`,
  );
}

main().catch((err) => {
  console.error("Scraper failed:", err);
  process.exit(1);
});
