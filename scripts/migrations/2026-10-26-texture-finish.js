#!/usr/bin/env node
'use strict';

/**
 * settings.OtherInfo — extend Texture, add Finish.
 *
 *   Texture : keep every existing value, add "Suede", sort alphabetically,
 *             and append "Other" last as the manual-entry option.
 *   Finish  : new array — Painted, Primer, Textured, then "Other".
 *
 * "Other" is appended AFTER the alphabetical run rather than sorted into it
 * (it would otherwise land between Metallic and Plastic, reading like a value).
 * Placement already uses a literal "Other" entry, so this follows the house style.
 *
 * SAFE TO RE-RUN. It computes the target from the union of what is there and what
 * is wanted, so a second run is a no-op and a value added by hand in between is
 * kept rather than reverted.
 *
 * Renumbering the Ids is safe: nothing stores a Texture Id. `products.texture` is a
 * free String holding the NAME (product.model.ts:30), and the React admin UI reads
 * names only (EditProductModal `optNames('Texture')`). This is NOT true of
 * Condition, where conditionId = Id — which is why this script touches neither
 * Condition nor anything else in the document.
 *
 * That document also holds BlobConnection, AWSAccessKey and AWSSecretKey. The update
 * is a $set on exactly two paths; nothing else is read back, written or printed.
 *
 *   node scripts/migrations/2026-10-26-texture-finish.js --confirm-db=<name>
 *   node scripts/migrations/2026-10-26-texture-finish.js --confirm-db=<name> --apply
 *
 * Without --apply it is a dry run. MONGO_URI comes from the environment or .env.
 */

const fs = require('fs');
const path = require('path');

const WANT_TEXTURE = ['Carpet', 'Cloth', 'Leather', 'Rubber', 'Suede', 'Vinyl'];
const WANT_FINISH = ['Painted', 'Primer', 'Textured'];
const MANUAL_ENTRY = 'Other';

/** Existing values first (original order preserved for the diff), then any missing wanted ones. */
function targetNames(existing, wanted) {
  const seen = new Map();
  for (const e of existing) {
    const n = typeof e === 'string' ? e : (e && e.name);
    if (typeof n === 'string' && n.trim() !== '' && n !== MANUAL_ENTRY) seen.set(n.toLowerCase(), n);
  }
  for (const w of wanted) if (!seen.has(w.toLowerCase())) seen.set(w.toLowerCase(), w);
  const names = Array.from(seen.values()).sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }));
  names.push(MANUAL_ENTRY);                       // catch-all last, never sorted in
  return names;
}

const toArray = (names) => names.map((name, i) => ({ Id: String(i + 1), name }));

module.exports = { targetNames, toArray, WANT_TEXTURE, WANT_FINISH, MANUAL_ENTRY };

// Required as a module (by the test) — define the transform and stop there.
if (require.main !== module) return;

const { MongoClient } = require('mongodb');
require('dotenv').config();

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

const show = (label, arr) => {
  console.log(`  ${label} (${arr.length})`);
  for (const x of arr) console.log(`    ${String(x.Id).padStart(3)}  ${x.name}`);
};

(async () => {
  console.log(`\ncluster  ${CLUSTER}`);
  console.log(`database ${URI_DB}`);
  console.log(`mode     ${APPLY ? 'APPLY — this writes' : 'dry run'}\n`);

  const client = new MongoClient(URI, { useNewUrlParser: true, useUnifiedTopology: true });
  await client.connect();
  try {
    const col = client.db(URI_DB).collection('settings');

    // Only OtherInfo is read back: the rest of this document is credentials.
    const docs = await col.find({}, { projection: { OtherInfo: 1 } }).toArray();
    if (!docs.length) die('No documents in `settings`.');
    if (docs.length > 1) console.log(`NOTE: ${docs.length} settings documents; updating the first only (${docs[0]._id}).\n`);

    const doc = docs[0];
    const oi = doc.OtherInfo || {};
    const curTexture = Array.isArray(oi.Texture) ? oi.Texture : [];
    const curFinish = Array.isArray(oi.Finish) ? oi.Finish : [];

    console.log('BEFORE');
    show('Texture', curTexture);
    show('Finish', curFinish.length ? curFinish : [{ Id: '-', name: '(does not exist)' }]);

    const nextTexture = toArray(targetNames(curTexture, WANT_TEXTURE));
    const nextFinish = toArray(targetNames(curFinish, WANT_FINISH));

    console.log('\nAFTER');
    show('Texture', nextTexture);
    show('Finish', nextFinish);

    const names = (a) => a.map((x) => x.name);
    const added = (before, after) => names(after).filter((n) => !names(before).some((b) => b.toLowerCase() === n.toLowerCase()));
    const removed = (before, after) => names(before).filter((n) => !names(after).some((a) => a.toLowerCase() === n.toLowerCase()));

    console.log('\nCHANGE');
    console.log(`  Texture added:   ${added(curTexture, nextTexture).join(', ') || '(none)'}`);
    console.log(`  Texture removed: ${removed(curTexture, nextTexture).join(', ') || '(none)'}`);
    console.log(`  Finish  added:   ${added(curFinish, nextFinish).join(', ') || '(none)'}`);
    console.log(`  Finish  removed: ${removed(curFinish, nextFinish).join(', ') || '(none)'}`);

    const unchanged =
      JSON.stringify(curTexture) === JSON.stringify(nextTexture) &&
      JSON.stringify(curFinish) === JSON.stringify(nextFinish);
    if (unchanged) { console.log('\nAlready in the target state. Nothing to do.'); return; }

    if (removed(curTexture, nextTexture).length) die('\nABORT: this would remove a Texture value. It is only meant to add.');

    if (!APPLY) { console.log('\nDry run — nothing written. Re-run with --apply.'); return; }

    const dir = path.join(__dirname, '..', '..', 'reports');
    fs.mkdirSync(dir, { recursive: true });
    const backup = path.join(dir, `settings-OtherInfo-backup-${URI_DB}-${process.env.RUN_STAMP || 'run'}.json`);
    fs.writeFileSync(backup, JSON.stringify({ _id: doc._id, database: URI_DB, cluster: CLUSTER, Texture: curTexture, Finish: curFinish }, null, 2));
    console.log(`\nBackup of the previous values: ${backup}`);

    const res = await col.updateOne(
      { _id: doc._id },
      { $set: { 'OtherInfo.Texture': nextTexture, 'OtherInfo.Finish': nextFinish } },
    );
    console.log(`matched ${res.matchedCount}, modified ${res.modifiedCount}`);
  } finally {
    await client.close();
  }
})().catch((e) => { console.error(`\nFailed: ${e.message}`); process.exit(1); });
