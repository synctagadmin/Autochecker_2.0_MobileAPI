#!/usr/bin/env node
'use strict';

/**
 * Asserts the color / texture / finish normalising still does what both the API and the
 * data migration depend on.
 *
 * It runs against the BUILD OUTPUT, which is the same file
 * scripts/migrations/2026-10-26-product-multiselect.js loads. If these two ever disagree
 * about an edge case - `{}`, `""`, a bare string - the migration converts a row one way
 * and the service reads it another, and the mismatch only shows up on someone's screen.
 *
 * A check rather than a jest test because `npm test` is not a gate in this repository
 * (the scaffold specs have never passed), so a test here would not run. This does.
 */

const fs = require('fs');
const path = require('path');

const DIST = path.join(__dirname, '..', 'dist', 'util', 'partFields.js');
if (!fs.existsSync(DIST)) {
  console.error(`Build output not found: ${DIST}\nRun \`npm run build\` first.`);
  process.exit(1);
}
const { toStringArray, toObjectArray, measurementFields, validatePartFields, deriveFieldChanges, numberOrZero, toNumber } = require(DIST);

const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
let failed = 0;

function check(name, actual, expected) {
  if (eq(actual, expected)) { console.log(`OK    ${name}`); return; }
  failed++;
  console.error(`FAIL  ${name}\n        expected ${JSON.stringify(expected)}\n        got      ${JSON.stringify(actual)}`);
}

function throws(name, fn, shouldThrow) {
  let threw = false;
  try { fn(); } catch { threw = true; }
  if (threw === shouldThrow) { console.log(`OK    ${name}`); return; }
  failed++;
  console.error(`FAIL  ${name} — expected ${shouldThrow ? 'a rejection' : 'no rejection'}, got the opposite`);
}

console.log('— texture / finish: the OLD shape still reads —');
check('bare string becomes a one-item array', toStringArray('Textured'), ['Textured']);
check('empty string becomes []', toStringArray(''), []);
check('undefined becomes []', toStringArray(undefined), []);
check('null becomes []', toStringArray(null), []);

console.log('\n— texture / finish: the new shape —');
check('array passes through', toStringArray(['Cloth', 'Textured']), ['Cloth', 'Textured']);
check('blanks and padding are cleaned', toStringArray([' Cloth ', '', '  ']), ['Cloth']);
check('non-strings are dropped', toStringArray(['Cloth', 5, null, {}]), ['Cloth']);
check('idempotent', toStringArray(toStringArray('Textured')), toStringArray('Textured'));

console.log('\n— color —');
check('single object becomes a one-item array', toObjectArray({ Id: '4', name: 'White' }), [{ Id: '4', name: 'White' }]);
check('empty object becomes [] (the old "no colour")', toObjectArray({}), []);
check('undefined becomes []', toObjectArray(undefined), []);
check('array passes through', toObjectArray([{ Id: '1' }, { Id: '2' }]), [{ Id: '1' }, { Id: '2' }]);
check('nulls inside are dropped', toObjectArray([{ Id: '1' }, null, {}]), [{ Id: '1' }]);
check('idempotent', toObjectArray(toObjectArray({ Id: '4' })), toObjectArray({ Id: '4' }));

console.log('\n— measurements —');
check('Height (capital) is stored as height', measurementFields({ Height: 4 }), { height: 4 });
check('height (lowercase) works too', measurementFields({ height: 4 }), { height: 4 });
check('lowercase wins when both are sent', measurementFields({ height: 9, Height: 4 }), { height: 9 });
check('numeric strings are coerced', measurementFields({ lbs: '2', oz: '8' }), { lbs: 2, oz: 8 });
check('decimals are KEPT, not truncated', measurementFields({ lbs: 2.7 }), { lbs: 2.7 });
check('absent keys stay absent, not zero', measurementFields({}), {});
check('zero is kept, not treated as absent', measurementFields({ oz: 0 }), { oz: 0 });
check('all five together', measurementFields({ lbs: 2, oz: 8, length: 12, width: 6, Height: 4 }), { lbs: 2, oz: 8, length: 12, width: 6, height: 4 });

console.log('\n— validation: shape only, never the values —');
throws('an unknown texture value is allowed (the "Other" option)', () => validatePartFields({ texture: ['Something nobody listed'] }), false);
throws('the old bare string is still accepted', () => validatePartFields({ texture: 'Textured' }), false);
throws('a number in texture is rejected', () => validatePartFields({ texture: [1, 2] }), true);
throws('a number as texture is rejected', () => validatePartFields({ texture: 42 }), true);
throws('a string as color is rejected', () => validatePartFields({ color: 'White' }), true);
throws('the old color object is still accepted', () => validatePartFields({ color: { Id: '4' } }), false);
throws('a proper color array is accepted', () => validatePartFields({ color: [{ Id: '4' }] }), false);
throws('a non-numeric weight is rejected', () => validatePartFields({ lbs: 'heavy' }), true);
throws('a negative weight is rejected', () => validatePartFields({ lbs: -1 }), true);
throws('an empty payload is accepted', () => validatePartFields({}), false);

console.log('');
console.log('— derived activity entries —');
const d = (b, a) => deriveFieldChanges(b, a).map((e) => e.Id + ':' + e.value);
check('first time values are set', d({}, { finish: ['Painted'], lbs: 2 }), ['12:NA -> Painted', '13:NA -> 2']);
check('a measurement changes', d({ lbs: 2 }, { lbs: 3 }), ['13:2 -> 3']);
check('a list grows', d({ finish: ['Painted'] }, { finish: ['Painted', 'Textured'] }), ['12:Painted -> Painted,Textured']);
check('unchanged produces nothing', d({ lbs: 2 }, { lbs: 2 }), []);
check('a key not sent is left alone, not cleared', d({ lbs: 2, finish: ['Painted'] }, { partTitle: 'x' }), []);
check('an explicit clear is recorded', d({ finish: ['Painted'] }, { finish: [] }), ['12:Painted -> NA']);
check('Height (capital) maps to the Height entry', d({}, { Height: 4 }), ['17:NA -> 4']);
check('no previous record at all', d(null, { oz: 8 }), ['14:NA -> 8']);

console.log('');
console.log('— measurements in a response: 0, never null —');
check('absent becomes 0', numberOrZero(undefined), 0);
check('null becomes 0', numberOrZero(null), 0);
check('empty string becomes 0', numberOrZero(''), 0);
check('a real zero stays 0', numberOrZero(0), 0);
check('a value passes through', numberOrZero(2), 2);
check('a numeric string is coerced', numberOrZero('8'), 8);
check('a decimal is kept', numberOrZero(2.7), 2.7);

console.log('');
console.log('— measurements are decimal, not integer —');
check('half an inch survives', toNumber(12.5), 12.5);
check('a quarter inch survives', toNumber(6.25), 6.25);
check('a decimal string coerces', toNumber('8.5'), 8.5);
check('a float artifact is rounded away', toNumber(12.300000000000001), 12.3);
check('an integer is unchanged', toNumber(2), 2);
check('decimals reach storage', measurementFields({ length: 12.5, width: 6.25, Height: 4 }), { length: 12.5, width: 6.25, height: 4 });
check('the activity log shows the decimal', deriveFieldChanges({ length: 12 }, { length: 12.5 }).map((e) => e.value), ['12 -> 12.5']);

// The pair that must NOT be conflated: a response shows 0 for both, but STORAGE keeps
// them apart - an omitted key stays absent in the document rather than being set to 0,
// which is what lets the activity log say "NA -> 2" rather than "0 -> 2".
check('storage still omits a key the request did not send', measurementFields({ lbs: 2 }), { lbs: 2 });

if (failed) { console.error(`\n${failed} check(s) failed.`); process.exit(1); }
console.log('\nAll part-field checks pass.');
