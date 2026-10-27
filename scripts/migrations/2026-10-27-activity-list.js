#!/usr/bin/env node
'use strict';

/**
 * settings.OtherInfo.Activity — add the activity types that can now be recorded.
 *
 * This list does NOT gate what the history can store: createActivityLog records any
 * {Id, name, value} it is handed. It drives the FILTER on the history screen - a type
 * missing from here records perfectly well, it just cannot be filtered by. So a row is
 * only worth adding when someone should be able to filter on it.
 *
 * The six fields updateProduct now derives on the server:
 *
 *   12  Finish
 *   13  Lbs
 *   14  Oz
 *   15  Length
 *   16  Width
 *   17  Height
 *
 * Note the Ids here are NUMBERS, unlike Texture/Finish where they are strings. That is
 * how the existing entries are stored and the app matches on them, so it is preserved.
 *
 *   node scripts/migrations/2026-10-27-activity-list.js --confirm-db=<name>
 *   node scripts/migrations/2026-10-27-activity-list.js --confirm-db=<name> --apply
 *
 * SAFE TO RE-RUN: entries are matched by Id and only missing ones are appended; an
 * entry someone has renamed by hand is left exactly as it is.
 */

const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');
require('dotenv').config();

/*
 * Id 11 is NOT here, and that is deliberate.
 *
 * An earlier version of this script added it as `SerialNumber`, on the reasoning that
 * the app records Id 11 but the list never offered it. The reasoning was wrong twice
 * over. The team had removed that row from the live list ON PURPOSE, and id 11 has since
 * been reused: `SerialNumber` was written up to June 2025 (37 rows) and `Stock Notes`
 * from June 2025 onward (35 rows, still being written). So re-adding it would have put
 * back a row someone had deliberately taken out, under a name that no longer describes
 * what the id records.
 *
 * Do not add it back without asking. The absence is a decision, not an oversight.
 */
const WANT = [
  { Id: 12, name: 'Finish', value: '' },
  { Id: 13, name: 'Lbs', value: '' },
  { Id: 14, name: 'Oz', value: '' },
  { Id: 15, name: 'Length', value: '' },
  { Id: 16, name: 'Width', value: '' },
  { Id: 17, name: 'Height', value: '' },
];

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const confirmArg = args.find((a) => a.startsWith('--confirm-db='));
const CONFIRM_DB = confirmArg ? confirmArg.slice('--confirm-db='.length) : '';

function die(msg) { console.error(msg); process.exit(1); }

if (!CONFIRM_DB) die('Refusing to run without --confirm-db=<database>. Name the database you mean.');

const URI = process.env.MONGO_URI;
if (!URI) die('MONGO_URI is not set (environment or .env).');

const m = /^mongodb(\+srv)?:\/\/(?:[^@/]*@)?([^/?]+)(?:\/([^?]*))?/i.exec(URI.trim());
if (!m) die('MONGO_URI is not a MongoDB connection string.');
const URI_DB = decodeURIComponent((m[3] || '').trim());
const CLUSTER = (m[2] || '').split(',')[0].split(':')[0];

if (URI_DB !== CONFIRM_DB) {
  die(`Refusing to run: MONGO_URI names "${URI_DB}" but --confirm-db says "${CONFIRM_DB}".`);
}

(async () => {
  console.log(`\ncluster  ${CLUSTER}`);
  console.log(`database ${URI_DB}`);
  console.log(`mode     ${APPLY ? 'APPLY — this writes' : 'dry run'}\n`);

  const client = new MongoClient(URI, { useNewUrlParser: true, useUnifiedTopology: true });
  await client.connect();
  try {
    const col = client.db(URI_DB).collection('settings');
    const docs = await col.find({}, { projection: { 'OtherInfo.Activity': 1 } }).toArray();
    if (!docs.length) die('No documents in `settings`.');
    if (docs.length > 1) console.log(`NOTE: ${docs.length} settings documents; updating the first only (${docs[0]._id}).\n`);

    const doc = docs[0];
    const current = (doc.OtherInfo && Array.isArray(doc.OtherInfo.Activity)) ? doc.OtherInfo.Activity : [];

    console.log(`BEFORE (${current.length})`);
    for (const a of current) console.log(`  ${String(a.Id).padStart(3)}  ${a.name}`);

    const have = new Set(current.map((a) => Number(a.Id)));
    const missing = WANT.filter((w) => !have.has(w.Id));
    const next = current.concat(missing);

    console.log(`\nADDING (${missing.length})`);
    if (!missing.length) console.log('  (none)');
    for (const a of missing) console.log(`  ${String(a.Id).padStart(3)}  ${a.name}`);

    if (!missing.length) { console.log('\nAlready in the target state. Nothing to do.'); return; }
    if (!APPLY) { console.log('\nDry run — nothing written. Re-run with --apply.'); return; }

    const dir = path.join(__dirname, '..', '..', 'reports');
    fs.mkdirSync(dir, { recursive: true });
    const backup = path.join(dir, `settings-Activity-backup-${URI_DB}-${process.env.RUN_STAMP || 'run'}.json`);
    fs.writeFileSync(backup, JSON.stringify({ _id: doc._id, database: URI_DB, Activity: current }, null, 2));
    console.log(`\nBackup of the previous list: ${backup}`);

    const res = await col.updateOne({ _id: doc._id }, { $set: { 'OtherInfo.Activity': next } });
    console.log(`matched ${res.matchedCount}, modified ${res.modifiedCount}`);
  } finally {
    await client.close();
  }
})().catch((e) => { console.error(`\nFailed: ${e.message}`); process.exit(1); });
