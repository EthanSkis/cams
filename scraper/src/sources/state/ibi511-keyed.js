// State DOTs on the IBI Group "511" platform. All share the same REST shape
// at /api/v2/get/cctv?key=... — but each requires a free developer key,
// provided via env var. Sources with no key set are skipped cleanly.
//
// To enable a state, grab a free developer key from its 511 site and set the
// env var below before running `npm run scrape`. These states then appear in
// the next build of cameras.json.

import { scrapeIbi511 } from '../../adapters/ibi511.js';
import { requireEnv } from '../../utils.js';

const TENANTS = [
  { slug: '511ga',  region: 'GA', host: '511ga.org',            env: 'KEY_511GA'  },
  { slug: '511ny',  region: 'NY', host: '511ny.org',            env: 'KEY_511NY'  },
  { slug: '511va',  region: 'VA', host: '511virginia.org',      env: 'KEY_511VA'  },
  { slug: '511pa',  region: 'PA', host: '511pa.com',            env: 'KEY_511PA'  },
  { slug: '511fl',  region: 'FL', host: 'fl511.com',            env: 'KEY_511FL'  },
  { slug: '511in',  region: 'IN', host: '511in.org',            env: 'KEY_511IN'  },
  { slug: '511nj',  region: 'NJ', host: '511nj.org',            env: 'KEY_511NJ'  },
  { slug: '511nc',  region: 'NC', host: 'drivenc.gov',          env: 'KEY_511NC'  },
  { slug: '511ct',  region: 'CT', host: 'ct511.org',            env: 'KEY_511CT'  },
  { slug: '511mass',region: 'MA', host: 'mass511.com',          env: 'KEY_511MA'  },
  { slug: '511md',  region: 'MD', host: 'chart.maryland.gov',   env: 'KEY_511MD'  },
  { slug: '511wi',  region: 'WI', host: '511wi.gov',            env: 'KEY_511WI'  },
  { slug: '511ky',  region: 'KY', host: 'goky.ky.gov',          env: 'KEY_511KY'  },
  { slug: '511ok',  region: 'OK', host: 'oktraffic.org',        env: 'KEY_511OK'  },
  { slug: '511mi',  region: 'MI', host: 'mdotjboss.state.mi.us',env: 'KEY_511MI'  },
  { slug: '511ar',  region: 'AR', host: 'www.idrivearkansas.com', env: 'KEY_511AR'},
  { slug: '511la',  region: 'LA', host: '511la.org',            env: 'KEY_511LA'  },
  { slug: '511ia',  region: 'IA', host: '511ia.org',            env: 'KEY_511IA'  },
  { slug: '511id',  region: 'ID', host: '511.idaho.gov',        env: 'KEY_511ID'  },
  { slug: '511hi',  region: 'HI', host: 'goakamai.org',         env: 'KEY_511HI'  },
  { slug: '511ks',  region: 'KS', host: 'kandrive.gov',         env: 'KEY_511KS'  },
  { slug: '511mn',  region: 'MN', host: '511mn.org',            env: 'KEY_511MN'  },
  { slug: '511ms',  region: 'MS', host: 'mdottraffic.com',      env: 'KEY_511MS'  },
  { slug: '511ms_st',region:'MO', host: 'traveler.modot.org',   env: 'KEY_511MO'  },
  { slug: '511mt',  region: 'MT', host: 'mdt511.com',           env: 'KEY_511MT'  },
  { slug: '511ne',  region: 'NE', host: '511.nebraska.gov',     env: 'KEY_511NE'  },
  { slug: '511nv',  region: 'NV', host: 'nvroads.com',          env: 'KEY_511NV'  },
  { slug: '511nh',  region: 'NH', host: 'newengland511.org',    env: 'KEY_511NH'  },
  { slug: '511nm',  region: 'NM', host: 'nmroads.com',          env: 'KEY_511NM'  },
  { slug: '511oh',  region: 'OH', host: 'ohgo.com',             env: 'KEY_511OH'  },
  { slug: '511or',  region: 'OR', host: 'tripcheck.com',        env: 'KEY_511OR'  },
  { slug: '511ri',  region: 'RI', host: 'ri511.com',            env: 'KEY_511RI'  },
  { slug: '511sc',  region: 'SC', host: '511sc.org',            env: 'KEY_511SC'  },
  { slug: '511sd',  region: 'SD', host: 'sd511.org',            env: 'KEY_511SD'  },
  { slug: '511tn',  region: 'TN', host: 'smartway.tn.gov',      env: 'KEY_511TN'  },
  { slug: '511tx',  region: 'TX', host: 'drivetexas.org',       env: 'KEY_511TX'  },
  { slug: '511ut',  region: 'UT', host: 'udottraffic.utah.gov', env: 'KEY_511UT'  },
  { slug: '511vt',  region: 'VT', host: '511vt.com',            env: 'KEY_511VT'  },
  { slug: '511wa',  region: 'WA', host: 'wsdot.wa.gov',         env: 'KEY_WSDOT'  },
  { slug: '511wv',  region: 'WV', host: 'wv511.org',            env: 'KEY_511WV'  },
  { slug: '511wy',  region: 'WY', host: 'wyoroad.info',         env: 'KEY_511WY'  },
  { slug: '511ak',  region: 'AK', host: '511.alaska.gov',       env: 'KEY_511AK'  },
  { slug: '511al',  region: 'AL', host: 'alabama511.com',       env: 'KEY_511AL'  },
  { slug: '511az',  region: 'AZ', host: 'az511.gov',            env: 'KEY_511AZ'  },
  { slug: '511ca',  region: 'CA', host: 'quickmap.dot.ca.gov',  env: 'KEY_511CA'  },
  { slug: '511de',  region: 'DE', host: 'deldot.gov',           env: 'KEY_511DE'  },
  { slug: '511il',  region: 'IL', host: 'travelmidwest.com',    env: 'KEY_511IL'  },
  { slug: '511me',  region: 'ME', host: 'newengland511.org',    env: 'KEY_511ME'  }
];

export async function run() {
  const all = [];
  for (const t of TENANTS) {
    const key = requireEnv(t.env);
    if (!key) continue; // silently skip — no key configured
    try {
      const rows = await scrapeIbi511({ ...t, key });
      all.push(...rows);
      console.log(`  [${t.slug}] ${rows.length}`);
    } catch (e) {
      console.warn(`  [${t.slug}] FAILED: ${e.message.split('\n')[0]}`);
    }
  }
  return all;
}

export const info = { name: 'ibi511-keyed' };
