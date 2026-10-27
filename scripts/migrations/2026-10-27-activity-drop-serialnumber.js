#!/usr/bin/env node
'use strict';

/**
 * settings.OtherInfo.Activity — take Id 11 (SerialNumber) back out.
 *
 * It was added by 2026-10-27-activity-list.js on the reasoning that the app records Id
 * 11 while the list never offered it, so it could not be filtered. That reasoning was
 * wrong twice over:
 *
 *   - The team had removed that row from the live list ON PURPOSE. The live document
 *     carries 11 entries, 0-10, and stops at Texture.
 *   - Id 11 has since been reused. `SerialNumber` was written up to June 2025 (37 rows)
 *     and `Stock Notes` from June 2025 onward (35 rows, still being written). The name
 *     no longer describes what the id records, so the row would have offered a filter
 *     labelled with a retired meaning that returned both sets.
 *
 * This undoes the addition on whichever database it reached. Production never had it.
 *
 *   node scripts/migrations/2026-10-27-activity-drop-serialnumber.js --confirm-db=<name>
 *   node scripts/migrations/2026-10-27-activity-drop-serialnumber.js --confirm-db=<name> --apply
 *
 * SAFE TO RE-RUN: it reports "nothing to do" once Id 11 is gone. Entries 12-17 are left
 * alone - those are wanted, and they are what the migration was actually asked for.
 */

const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');
require('dotenv').config();

const DROP_ID = 11;

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

    const next = current.filter((a) => Number(a.Id) !== DROP_ID);
    const removed = current.length - next.length;

    console.log(`\nAFTER (${next.length})`);
    for (const a of next) console.log(`  ${String(a.Id).padStart(3)}  ${a.name}`);

    if (!removed) { console.log(`\nNo Id ${DROP_ID} entry. Nothing to do.`); return; }
    if (!APPLY) { console.log(`\nWould remove ${removed}. Dry run — nothing written. Re-run with --apply.`); return; }

    const dir = path.join(__dirname, '..', '..', 'reports');
    fs.mkdirSync(dir, { recursive: true });
    const backup = path.join(dir, `settings-Activity-drop11-backup-${URI_DB}-${process.env.RUN_STAMP || 'run'}.json`);
    fs.writeFileSync(backup, JSON.stringify({ _id: doc._id, database: URI_DB, Activity: current }, null, 2));
    console.log(`\nBackup of the previous list: ${backup}`);

    const res = await col.updateOne({ _id: doc._id }, { $set: { 'OtherInfo.Activity': next } });
    console.log(`matched ${res.matchedCount}, modified ${res.modifiedCount}`);
  } finally {
    await client.close();
  }
})().catch((e) => { console.error(`\nFailed: ${e.message}`); process.exit(1); });
