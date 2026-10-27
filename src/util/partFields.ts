import { BadRequestException } from '@nestjs/common';

/**
 * color, texture and finish are multi-select: each holds an ARRAY.
 *
 * They did not always. `color` was a single object and `texture` a single string, so
 * the collection holds both shapes - every product written before this change still
 * carries the old one. A migration converts them
 * (scripts/migrations/2026-10-26-product-multiselect.js), but the readers below keep
 * tolerating the old shape anyway: a mobile app that has not been updated still sends
 * a bare string, and nothing here should throw on data it wrote yesterday.
 *
 * So: normalise on the way in and on the way out, and never assume the array.
 */

export interface ColorOption {
  Id?: string;
  name?: string;
  colorCode?: string;
}

/** Anything -> string[]. `"Textured"` -> `["Textured"]`, absent/blank -> `[]`. */
export function toStringArray(value: any): string[] {
  if (value === undefined || value === null) return [];
  const raw = Array.isArray(value) ? value : [value];
  return raw
    .filter((v) => typeof v === 'string')
    .map((v) => v.trim())
    .filter((v) => v !== '');
}

/**
 * Anything -> object[]. A single `{Id, name, colorCode}` becomes `[{...}]`.
 *
 * `{}` is the old "no colour" value (product.service wrote it as the empty case) and
 * must come back as `[]`, not `[{}]` - otherwise the app renders an empty swatch.
 */
export function toObjectArray(value: any): ColorOption[] {
  if (value === undefined || value === null) return [];
  const raw = Array.isArray(value) ? value : [value];
  return raw.filter((v) => v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length > 0);
}

/**
 * Anything -> a non-negative integer, or undefined when not supplied.
 *
 * undefined (not zero) for absent, so an app that does not send weights yet leaves the
 * stored value alone rather than overwriting it with 0.
 */
export function toInt(value: any): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const n = Number(value);
  if (!Number.isFinite(n)) return undefined;
  return Math.trunc(n);
}

/** The five measurement fields, normalised. Keys absent from the input stay absent. */
export function measurementFields(input: any): Record<string, number> {
  // `Height` is accepted as well as `height`: the API spec was written with a capital H
  // while the other four are lowercase. Stored as `height` either way.
  const sources: Array<[string, any]> = [
    ['lbs', input.lbs],
    ['oz', input.oz],
    ['length', input.length],
    ['width', input.width],
    ['height', input.height !== undefined ? input.height : input.Height],
  ];
  const out: Record<string, number> = {};
  for (const [key, raw] of sources) {
    const n = toInt(raw);
    if (n !== undefined) out[key] = n;
  }
  return out;
}

/**
 * Type checking only - values are NOT checked against the OtherInfo lists.
 *
 * They cannot be: Texture and Finish both carry an "Other" option whose whole purpose
 * is to let a user type something that is not in the list. Rejecting unknown values
 * would break the feature that option exists for.
 *
 * What this does catch is a client sending the wrong SHAPE, which would otherwise be
 * stored and only surface later as a rendering bug on someone's screen.
 */
export function validatePartFields(input: any): void {
  const bad: string[] = [];

  for (const key of ['texture', 'finish']) {
    const v = input[key];
    if (v === undefined || v === null) continue;
    // A bare string is the OLD shape, still accepted - normalised by toStringArray.
    if (typeof v === 'string') continue;
    if (!Array.isArray(v) || v.some((x) => typeof x !== 'string')) {
      bad.push(`${key} must be an array of strings`);
    }
  }

  const color = input.color;
  if (color !== undefined && color !== null) {
    const isOldShape = !Array.isArray(color) && typeof color === 'object';
    if (!isOldShape) {
      if (!Array.isArray(color) || color.some((x) => !x || typeof x !== 'object' || Array.isArray(x))) {
        bad.push('color must be an array of objects');
      }
    }
  }

  for (const key of ['lbs', 'oz', 'length', 'width', 'height', 'Height']) {
    const v = input[key];
    if (v === undefined || v === null || v === '') continue;
    if (!Number.isFinite(Number(v))) bad.push(`${key} must be a number`);
    else if (Number(v) < 0) bad.push(`${key} must not be negative`);
  }

  if (bad.length) throw new BadRequestException(bad.join('; '));
}

/**
 * Activity-log entries derived on the SERVER, for fields the mobile app does not
 * report changes for.
 *
 * The history list is built from whatever the client sends in `changes` - it arrives
 * pre-formatted as "before -> after" and the API only records it. That means a field
 * the app does not know about is silently absent from a part's history, which is what
 * happened to finish and the five measurements when they were added.
 *
 * Deriving them here instead of waiting for an app release also makes them impossible
 * to skip: a client that forgets, or an older version still in the field, still
 * produces a complete history.
 *
 * The existing eleven types are deliberately NOT derived - the app already sends them,
 * and computing them here as well would log every change twice.
 */
export interface ActivityChange {
  Id: number;
  name: string;
  value: string;
  colorValue: any[];
}

/**
 * Ids continue from the eleven the app already uses (1-11, ending at SerialNumber).
 * Note 11 is not in settings.OtherInfo.Activity either - that list only drives the
 * filter dropdown, it does not gate what can be recorded.
 */
const DERIVED_FIELDS: Array<{ Id: number; name: string; key: string; list: boolean }> = [
  { Id: 12, name: 'Finish', key: 'finish', list: true },
  { Id: 13, name: 'Lbs', key: 'lbs', list: false },
  { Id: 14, name: 'Oz', key: 'oz', list: false },
  { Id: 15, name: 'Length', key: 'length', list: false },
  { Id: 16, name: 'Width', key: 'width', list: false },
  { Id: 17, name: 'Height', key: 'height', list: false },
];

/** "NA" for absent, matching what the app sends for an empty previous value. */
function display(value: any, list: boolean): string {
  if (list) {
    const items = toStringArray(value);
    return items.length ? items.join(',') : 'NA';
  }
  const n = toInt(value);
  return n === undefined ? 'NA' : String(n);
}

/**
 * One entry per field that actually changed. A key the request did not send means
 * "leave it alone", not "cleared", so it produces no entry.
 */
export function deriveFieldChanges(before: any, after: any): ActivityChange[] {
  const out: ActivityChange[] = [];
  if (!after || typeof after !== 'object') return out;
  const measured = measurementFields(after);

  for (const f of DERIVED_FIELDS) {
    let next: any;
    if (f.list) {
      if (after[f.key] === undefined || after[f.key] === null) continue;
      next = after[f.key];
    } else {
      if (!(f.key in measured)) continue;
      next = measured[f.key];
    }

    const from = display(before ? before[f.key] : undefined, f.list);
    const to = display(next, f.list);
    if (from === to) continue;

    out.push({ Id: f.Id, name: f.name, value: from + ' -> ' + to, colorValue: [] });
  }
  return out;
}

/**
 * A measurement for a RESPONSE: 0 when nothing is recorded.
 *
 * The API returns 0 rather than null for an unrecorded weight or dimension, so every
 * field in a product row has a value of its own type and no client has to guard for
 * null. The trade-off is deliberate and worth stating: a part weighing 0 lbs and a
 * part whose weight nobody has entered look identical on the wire.
 *
 * Storage keeps the distinction - measurementFields() omits a key the request did not
 * send, so an absent value is absent in the document rather than being written as 0,
 * and the activity log still reports "NA -> 2" the first time one is set.
 */
export function numberOrZero(value: any): number {
  const n = toInt(value);
  return n === undefined ? 0 : n;
}
