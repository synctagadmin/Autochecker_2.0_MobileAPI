#!/usr/bin/env node
'use strict';

/**
 * settings.OtherInfo.Finish — drop the "Other" entry.
 *
 * Finish was seeded as Painted / Primer / Textured / Other. "Other" is the free-text
 * affordance: on Texture it is what lets someone type a value that is not in the list.
 * Removing it from Finish removes that prompt from the Finish picker and nothing else -
 * the API does not validate values against these lists (validatePartFields checks shape
 * only), so a custom finish still stores perfectly well if a client sends one.
 *
 * Texture keeps its own "Other" (Id 12). Only Finish is touched here, which is the
 * asymmetry that was asked for.
 *
 * Checked before writing: of the products carrying a finish, none held "Other".
 *
 *   node scripts/migrations/2026-10-27-finish-drop-other.js --confirm-db=<name>
 *   node scripts/migrations/2026-10-27-finish-drop-other.js --confirm-db=<name> --apply
 *
 * SAFE TO RE-RUN: it removes by name and reports "nothing to do" once the entry is gone.
 * The remaining entries keep their existing Ids - renumbering them would orphan any
 * value already stored against an Id.
 */

const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');
require('dotenv').config();

const DROP = 'Other';

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
    const docs = await col.find({}, { projection: { 'OtherInfo.Finish': 1 } }).toArray();
    if (!docs.length) die('No documents in `settings`.');
    if (docs.length > 1) console.log(`NOTE: ${docs.length} settings documents; updating the first only (${docs[0]._id}).\n`);

    const doc = docs[0];
    const current = (doc.OtherInfo && Array.isArray(doc.OtherInfo.Finish)) ? doc.OtherInfo.Finish : [];

    console.log(`BEFORE (${current.length})`);
    for (const f of current) console.log(`  ${String(f.Id).padStart(3)}  ${f.name}`);

    const next = current.filter((f) => String(f.name).trim().toLowerCase() !== DROP.toLowerCase());
    const removed = current.length - next.length;

    console.log(`\nAFTER (${next.length})`);
    for (const f of next) console.log(`  ${String(f.Id).padStart(3)}  ${f.name}`);

    if (!removed) { console.log(`\nNo "${DROP}" entry. Nothing to do.`); return; }
    if (!APPLY) { console.log(`\nWould remove ${removed}. Dry run — nothing written. Re-run with --apply.`); return; }

    const dir = path.join(__dirname, '..', '..', 'reports');
    fs.mkdirSync(dir, { recursive: true });
    const backup = path.join(dir, `settings-Finish-backup-${URI_DB}-${process.env.RUN_STAMP || 'run'}.json`);
    fs.writeFileSync(backup, JSON.stringify({ _id: doc._id, database: URI_DB, Finish: current }, null, 2));
    console.log(`\nBackup of the previous list: ${backup}`);

    const res = await col.updateOne({ _id: doc._id }, { $set: { 'OtherInfo.Finish': next } });
    console.log(`matched ${res.matchedCount}, modified ${res.modifiedCount}`);
  } finally {
    await client.close();
  }
})().catch((e) => { console.error(`\nFailed: ${e.message}`); process.exit(1); });
