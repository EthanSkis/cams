// State 511 systems that all share the same IBI/Conduent platform and
// expose `/map/mapIcons/Cameras` + `/map/Cctv/{id}`.

import { scrapeIbi511 } from "../../adapters/ibi511.js";

// NOTE: For the "multi-state" 511 systems (New England is 6 states, Nevada
// covers just NV, etc.) we store the member states separately and stamp
// each camera with its best-guess state based on lat/lon if needed. For
// simplicity we default to the primary state here; the normalizer keeps
// US-bbox-only points so out-of-country tiles are filtered.
const STATES = [
  { source: "511pa",       sourceName: "511PA",        origin: "https://www.511pa.com",     state: "PA", namePrefix: "PA" },
  { source: "511ny",       sourceName: "511NY",        origin: "https://511ny.org",          state: "NY", namePrefix: "NY" },
  { source: "511wi",       sourceName: "511WI",        origin: "https://511wi.gov",          state: "WI", namePrefix: "WI" },
  { source: "511ga",       sourceName: "511GA",        origin: "https://511ga.org",          state: "GA", namePrefix: "GA" },
  { source: "fl511",       sourceName: "FL511",        origin: "https://fl511.com",          state: "FL", namePrefix: "FL" },
  { source: "511id",       sourceName: "511 Idaho",    origin: "https://511.idaho.gov",      state: "ID", namePrefix: "ID" },
  { source: "az511",       sourceName: "AZ 511",       origin: "https://az511.gov",          state: "AZ", namePrefix: "AZ" },
  { source: "511la",       sourceName: "511 Louisiana", origin: "https://511la.org",         state: "LA", namePrefix: "LA" },
  { source: "nvroads",     sourceName: "NV Roads",     origin: "https://www.nvroads.com",   state: "NV", namePrefix: "NV" },
  { source: "newengland",  sourceName: "New England 511", origin: "https://newengland511.org", state: null, namePrefix: "New England" },
  { source: "511ak",       sourceName: "511 Alaska",   origin: "https://511.alaska.gov",    state: "AK", namePrefix: "AK" },
  { source: "udot",        sourceName: "UDOT Traffic", origin: "https://www.udottraffic.utah.gov", state: "UT", namePrefix: "UT" },
];

export async function scrapeAllIbi511() {
  const all = [];
  for (const cfg of STATES) {
    try {
      const recs = await scrapeIbi511(cfg);
      console.log(`    ${cfg.source}: ${recs.length}`);
      all.push(...recs);
    } catch (err) {
      console.warn(`    ${cfg.source} FAILED: ${err.message}`);
    }
  }
  return all;
}
