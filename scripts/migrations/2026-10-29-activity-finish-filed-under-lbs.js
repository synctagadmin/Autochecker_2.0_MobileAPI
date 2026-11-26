#!/usr/bin/env node
'use strict';

/**
 * productactivitylogs — move finish rows off the Lbs activityId.
 *
 * The app numbers Finish 13. The server numbers Lbs 13 (util/partFields.ts,
 * DERIVED_FIELDS). Until mergeActivityChanges landed on 2026-10-27, updateProduct wrote
 * the app's row as well as the server's, so every finish edit produced TWO rows a second
 * apart - the server's under Id 12, and the app's under Id 13, where Lbs lives.
 *
 * The effect on the history screen is what gets reported: filter by Lbs and finish
 * changes come back with it. Filter by Finish and only half of them are there.
 *
 * The code fix stops new ones. It cannot repair the rows already written, and nothing
 * else does - hence this.
 *
 *   node scripts/migrations/2026-10-29-activity-finish-filed-under-lbs.js --confirm-db=<name>
 *   node scripts/migrations/2026-10-29-activity-finish-filed-under-lbs.js --confirm-db=<name> --apply
 *
 * WHAT IT TOUCHES, and why it cannot hit a real Lbs row: only documents where
 * activityId is 13 AND the name says Finish. A genuine Lbs row is {13, 'Lbs'} and does
 * not match. A finish row already at 12 does not match either.
 *
 * It MOVES rather than deletes. The server's Id-12 twin usually exists, so the moved row
 * often becomes a near-duplicate of it - differing only in the spaces after the commas,
 * which is the signature of the app's copy. Deleting looked tempting and is not done
 * here: a row the server never derived (the values can be equal server-side and
 * different app-side, see the spec) would be destroyed with no way back. A duplicate in
 * the right place is recoverable; a deleted row is not. De-duplicating is a separate
 * decision, on a separate run, with the counts from this one in hand.
 *
 * SAFE TO RE-RUN: a second run matches nothing, because the first moved them all.
 */

const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');
require('dotenv').config();

/** The server's Ids. Changing either of these means the data model changed - read partFields.ts. */
const FINISH_ID = 12;
const LBS_ID = 13;

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

/** Case-insensitive and anchored: 'Finish' and 'finish', but never 'Finished something'. */
const FINISH_NAME = /^finish$/i;
const SELECTOR = { activityId: LBS_ID, activityName: { $regex: FINISH_NAME } };

(async () => {
  console.log(`\ncluster  ${CLUSTER}`);
  console.log(`database ${URI_DB}`);
  console.log(`mode     ${APPLY ? 'APPLY — this writes' : 'dry run'}\n`);

  const client = new MongoClient(URI, { useNewUrlParser: true, useUnifiedTopology: true });
  await client.connect();
  try {
    const col = client.db(URI_DB).collection('productactivitylogs');

    // Prove the collection before trusting a count of zero. An empty result from the
    // wrong collection name reads exactly like "nothing to fix".
    const total = await col.countDocuments({});
    if (!total) {
      const names = (await client.db(URI_DB).listCollections().toArray()).map((c) => c.name);
      die(`\`productactivitylogs\` is empty or absent. Collections here:\n  ${names.join('\n  ')}`);
    }
    console.log(`productactivitylogs holds ${total} rows`);

    const onLbs = await col.countDocuments({ activityId: LBS_ID });
    const wrong = await col.countDocuments(SELECTOR);
    console.log(`  at Id ${LBS_ID} (Lbs):            ${onLbs}`);
    console.log(`  of those, named Finish:     ${wrong}   <- to move to Id ${FINISH_ID}`);
    console.log(`  genuine Lbs rows, untouched: ${onLbs - wrong}\n`);

    if (!wrong) { console.log('Nothing filed wrongly. Nothing to do.'); return; }

    const sample = await col.find(SELECTOR).sort({ createdDate: -1 }).limit(5)
      .project({ activityId: 1, activityName: 1, value: 1, createdDate: 1 }).toArray();
    console.log('Most recent of them:');
    for (const d of sample) {
      console.log(`  ${new Date(d.createdDate).toISOString().slice(0, 19)}  ${String(d.value).slice(0, 56)}`);
    }

    if (!APPLY) { console.log('\nDry run — nothing written. Re-run with --apply.'); return; }

    // Every _id, before the write - so a mistaken run is reversible by selecting these
    // back to 13. A count alone would not be enough to find them again afterwards.
    const dir = path.join(__dirname, '..', '..', 'reports');
    fs.mkdirSync(dir, { recursive: true });
    const backup = path.join(dir, `activity-finish-under-lbs-${URI_DB}-${process.env.RUN_STAMP || 'run'}.json`);
    const ids = (await col.find(SELECTOR).project({ _id: 1 }).toArray()).map((d) => String(d._id));
    fs.writeFileSync(backup, JSON.stringify({ database: URI_DB, from: LBS_ID, to: FINISH_ID, ids }, null, 2));
    console.log(`\nThe ${ids.length} _ids being moved: ${backup}`);

    const res = await col.updateMany(SELECTOR, { $set: { activityId: FINISH_ID } });
    console.log(`matched ${res.matchedCount}, modified ${res.modifiedCount}`);
  } finally {
    await client.close();
  }
})().catch((e) => { console.error(`\nFailed: ${e.message}`); process.exit(1); });
