// Build entry: runs every source module under ./sources, normalizes the union,
// and writes ../../assets/cameras.json.
//
// Run with `npm run scrape` (or `node src/index.js`). Optional flag:
//   --only=nyctmc,arcgis-states       only run these source module names
//   --dry                              don't write the output file

import { readdir } from 'node:fs/promises';
import { writeFileSync, mkdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { normalize } from './normalize.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const args = new Map();
for (const a of process.argv.slice(2)) {
  const m = /^--([^=]+)(?:=(.*))?$/.exec(a);
  if (m) args.set(m[1], m[2] ?? true);
}

const onlyList = typeof args.get('only') === 'string'
  ? args.get('only').split(',').map((s) => s.trim()).filter(Boolean)
  : null;

async function discoverSources() {
  const root = join(__dirname, 'sources');
  const found = [];
  for (const group of await readdir(root)) {
    const groupDir = join(root, group);
    let entries;
    try { entries = await readdir(groupDir); } catch { continue; }
    for (const f of entries) {
      if (!f.endsWith('.js')) continue;
      const full = join(groupDir, f);
      const name = f.replace(/\.js$/, '');
      found.push({ group, name, path: full });
    }
  }
  return found;
}

function logTable(rows) {
  const nameW = Math.max(6, ...rows.map((r) => r.name.length));
  const groupW = Math.max(6, ...rows.map((r) => r.group.length));
  console.log('');
  console.log(`  ${'group'.padEnd(groupW)}  ${'name'.padEnd(nameW)}  count     status`);
  console.log(`  ${'-'.repeat(groupW)}  ${'-'.repeat(nameW)}  --------  ------`);
  for (const r of rows) {
    console.log(
      `  ${r.group.padEnd(groupW)}  ${r.name.padEnd(nameW)}  ${String(r.count).padStart(8)}  ${r.status}`
    );
  }
  console.log('');
}

async function main() {
  const t0 = Date.now();
  const sources = await discoverSources();
  const chosen = onlyList
    ? sources.filter((s) => onlyList.includes(s.name))
    : sources;
  if (onlyList && chosen.length === 0) {
    throw new Error(`--only matched zero sources (have: ${sources.map((s) => s.name).join(', ')})`);
  }

  const rowsByName = {};
  const rawAll = [];

  for (const s of chosen) {
    const label = `${s.group}/${s.name}`;
    process.stdout.write(`→ ${label}\n`);
    try {
      const mod = await import(pathToFileURL(s.path).href);
      const raw = (await mod.run()) || [];
      rawAll.push(...raw);
      rowsByName[s.name] = { ...s, count: raw.length, status: 'ok' };
    } catch (e) {
      rowsByName[s.name] = { ...s, count: 0, status: 'FAILED' };
      console.warn(`  ! ${label}: ${e.message.split('\n')[0]}`);
    }
  }

  const { records, dropped } = normalize(rawAll);
  records.sort((a, b) => a.id.localeCompare(b.id));

  const out = {
    generatedAt: new Date().toISOString(),
    totalSourcesAttempted: chosen.length,
    totalRawRecords: rawAll.length,
    totalDroppedRecords: dropped,
    totalCameras: records.length,
    cameras: records
  };

  const target = join(__dirname, '..', '..', 'assets', 'cameras.json');
  mkdirSync(dirname(target), { recursive: true });
  if (args.has('dry')) {
    console.log('(--dry) not writing');
  } else {
    writeFileSync(target, JSON.stringify(out));
    const size = statSync(target).size;
    console.log(`wrote ${target} (${(size / 1024).toFixed(1)} KiB)`);
  }

  logTable(Object.values(rowsByName));
  console.log(`total cameras: ${records.length} (${dropped} dropped, ${rawAll.length} raw)`);
  console.log(`elapsed: ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
