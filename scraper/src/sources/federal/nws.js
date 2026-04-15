// National Weather Service webcams. NWS doesn't run a central cameras API;
// each Weather Forecast Office (WFO) maintains its own camera page.
//
// This is a best-effort stub: without a consistent machine-readable endpoint,
// thorough NWS scraping requires per-WFO adapters, which bloats the repo with
// marginal coverage. The frontend still supports NWS cameras if they're added
// by another source; we leave this source empty and documented.

export async function run() {
  return [];
}

export const info = { name: 'nws' };
