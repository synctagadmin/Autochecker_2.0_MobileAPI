#!/usr/bin/env node
'use strict';

/**
 * productdetails — convert `texture` and `color` to the multi-select array shape.
 *
 *   texture: "Textured"              ->  ["Textured"]
 *   texture: ""        / missing     ->  []
 *   color:   {Id,name,colorCode}     ->  [{Id,name,colorCode}]
 *   color:   {}        / missing     ->  []
 *
 * `finish`, `lbs`, `oz`, `length`, `width` and `height` are NOT backfilled. They are
 * new, nobody has recorded them, and writing a default would be inventing data - the
 * API returns [] and null for absent, which is the honest answer.
 *
 * It converts with the SAME functions the running service uses, loaded from the build
 * output (dist/util/partFields.js). Re-implementing the rules here is how a migration
 * and its application quietly disagree about an edge case like `{}` or `""`.
 *
 *   npm run build                       # dist/ must exist and be current
 *   node scripts/migrations/2026-10-26-product-multiselect.js --confirm-db=<name>
 *   node scripts/migrations/2026-10-26-product-multiselect.js --confirm-db=<name> --apply
 *
 * SAFE TO RE-RUN: a document already holding arrays produces an identical value and is
 * not written. Dry run unless --apply.
 */

const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');
require('dotenv').config();

const DIST = path.join(__dirname, '..', '..', 'dist', 'util', 'partFields.js');
if (!fs.existsSync(DIST)) {
  console.error(`Build output not found: ${DIST}\nRun \`npm run build\` first - this script converts with the service's own functions.`);
  process.exit(1);
}
const { toStringArray, toObjectArray } = require(DIST);

const BATCH = 500;

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

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

(async () => {
  console.log(`\ncluster  ${CLUSTER}`);
  console.log(`database ${URI_DB}`);
  console.log(`mode     ${APPLY ? 'APPLY — this writes' : 'dry run'}\n`);

  const client = new MongoClient(URI, { useNewUrlParser: true, useUnifiedTopology: true });
  await client.connect();
  try {
    const col = client.db(URI_DB).collection('productdetails');
    const total = await col.countDocuments({});
    console.log(`${total} products in the collection.`);

    const cursor = col.find({}, { projection: { texture: 1, color: 1 } });
    const changes = [];
    let scanned = 0;

    while (await cursor.hasNext()) {
      const d = await cursor.next();
      scanned++;
      const nextTexture = toStringArray(d.texture);
      const nextColor = toObjectArray(d.color);
      if (same(d.texture, nextTexture) && same(d.color, nextColor)) continue;
      changes.push({ _id: d._id, from: { texture: d.texture, color: d.color }, to: { texture: nextTexture, color: nextColor } });
    }

    console.log(`scanned ${scanned}, need converting: ${changes.length}\n`);

    if (!changes.length) { console.log('Already in the target state. Nothing to do.'); return; }

    console.log('Sample of what changes (first 5):');
    for (const c of changes.slice(0, 5)) {
      console.log(`  ${c._id}`);
      console.log(`    texture  ${JSON.stringify(c.from.texture)}  ->  ${JSON.stringify(c.to.texture)}`);
      console.log(`    color    ${JSON.stringify(c.from.color)}  ->  ${JSON.stringify(c.to.color)}`);
    }

    // Anything that converts to an EMPTY array while it held something is a value being
    // dropped - the one outcome this must never produce silently.
    const lossy = changes.filter((c) =>
      (c.to.texture.length === 0 && typeof c.from.texture === 'string' && c.from.texture.trim() !== '') ||
      (c.to.color.length === 0 && c.from.color && typeof c.from.color === 'object' && !Array.isArray(c.from.color) && Object.keys(c.from.color).length > 0));
    if (lossy.length) {
      console.error(`\nABORT: ${lossy.length} document(s) would lose a value. First: ${JSON.stringify(lossy[0])}`);
      process.exit(1);
    }

    if (!APPLY) { console.log(`\nDry run — nothing written. ${changes.length} document(s) would be converted.`); return; }

    const dir = path.join(__dirname, '..', '..', 'reports');
    fs.mkdirSync(dir, { recursive: true });
    const backup = path.join(dir, `productdetails-multiselect-backup-${URI_DB}-${process.env.RUN_STAMP || 'run'}.json`);
    fs.writeFileSync(backup, JSON.stringify(changes.map((c) => ({ _id: c._id, texture: c.from.texture, color: c.from.color })), null, 1));
    console.log(`\nPrevious values for every converted row: ${backup}`);

    let written = 0;
    for (let i = 0; i < changes.length; i += BATCH) {
      const slice = changes.slice(i, i + BATCH);
      const res = await col.bulkWrite(
        slice.map((c) => ({ updateOne: { filter: { _id: c._id }, update: { $set: { texture: c.to.texture, color: c.to.color } } } })),
        { ordered: false },
      );
      written += res.modifiedCount;
      console.log(`  ${Math.min(i + BATCH, changes.length)}/${changes.length} (modified ${written})`);
    }
    console.log(`\nDone. ${written} document(s) converted.`);
  } finally {
    await client.close();
  }
})().catch((e) => { console.error(`\nFailed: ${e.message}`); process.exit(1); });
