#!/usr/bin/env node
'use strict';

/**
 * Checks that config/env.profiles.json still REFUSES the mistakes it exists to refuse.
 *
 * Pure: it resolves profiles against made-up environments and never opens a socket, so it
 * runs in CI with no credentials. The URIs below are shaped like the real ones and carry
 * no password.
 *
 * Why this is a check and not a unit test: `npm test` is not a CI gate in this repository
 * (the two scaffold specs have never passed), so a test here would not run. This does.
 *
 * The case that made it necessary: the staging profile deliberately does not hard-code
 * SCRAPER_URL, and resolveProfile only classified upstreams declared IN a profile - so a
 * staging deployment pointed at the production scraper validated clean.
 */

const fs = require('fs');
const path = require('path');
const { resolveProfile } = require('./env-core');

const CONFIG = path.join(__dirname, '..', 'config', 'env.profiles.json');
const config = JSON.parse(fs.readFileSync(CONFIG, 'utf8'));

const uri = (db) => `mongodb+srv://user:pass@autopartscheckerprod.1me3yhq.mongodb.net/${db}`;
const LIVE = uri('autocheckerpartsclone');
const STAGE = uri('autocheckerpartsclonenew');
const PROD_SCRAPER = 'https://scrapernew.autochecker.com/';
const STAGE_SCRAPER = 'http://54.153.64.15:3000/';

const cases = [
  { name: 'production accepts the LIVE database',            profile: 'production', env: { MONGO_URI: LIVE },  expect: true },
  { name: 'production REFUSES the staging database',          profile: 'production', env: { MONGO_URI: STAGE }, expect: false },
  { name: 'production REFUSES a missing MONGO_URI',           profile: 'production', env: {},                   expect: false },
  { name: 'staging accepts the staging database + scraper',   profile: 'staging',    env: { MONGO_URI: STAGE, SCRAPER_URL: STAGE_SCRAPER }, expect: true },
  { name: 'staging REFUSES the LIVE database',                profile: 'staging',    env: { MONGO_URI: LIVE,  SCRAPER_URL: STAGE_SCRAPER }, expect: false },
  { name: 'staging REFUSES the production scraper',           profile: 'staging',    env: { MONGO_URI: STAGE, SCRAPER_URL: PROD_SCRAPER },  expect: false },
  { name: 'staging REFUSES a missing SCRAPER_URL',            profile: 'staging',    env: { MONGO_URI: STAGE }, expect: false },
  { name: 'local REFUSES the LIVE database',                  profile: 'local',      env: { MONGO_URI: LIVE },  expect: false },
  { name: 'local accepts the staging database',               profile: 'local',      env: { MONGO_URI: STAGE }, expect: true },
];

let failed = 0;
for (const c of cases) {
  const r = resolveProfile(config, c.profile, c.env);
  const ok = r.canStart === c.expect;
  if (!ok) {
    failed++;
    console.error(`FAIL  ${c.name}`);
    console.error(`      expected canStart=${c.expect}, got ${r.canStart}`);
    for (const chk of r.checks) console.error(`        ${chk.ok ? 'OK  ' : 'FAIL'} ${chk.label}${chk.detail ? ` — ${chk.detail}` : ''}`);
  } else {
    console.log(`OK    ${c.name}`);
  }
}

if (failed) {
  console.error(`\n${failed} of ${cases.length} profile guard(s) did not hold.`);
  process.exit(1);
}
console.log(`\nAll ${cases.length} profile guards hold.`);
