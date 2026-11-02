/**
 * A cap on how often the same fault may be reported.
 *
 * One error inside a loop is the failure mode this exists for. This service has 17
 * `forEach(async ...)` call sites, and a fault in one of them does not happen once, it
 * happens once per row. Without a cap a single bad record would send thousands of
 * identical events and exhaust a quota shared with AdminAPI, eBayAPI, the scraper and
 * the admin UI - so the one night it mattered, nothing would have been recorded.
 *
 * Twenty per hour per fingerprint, the same figure the other services use. The first
 * twenty carry the stack, the message and the breadcrumbs; the twenty-first says nothing
 * the first twenty did not.
 *
 * Deliberately NOT a shared clock or a database. A pure counter keyed by fingerprint,
 * with the time passed in, so every rule below is tested exactly rather than by waiting.
 * It is per process: two pm2 instances would each get twenty, which is the right trade
 * against coordinating state in an error path.
 */

/** How many events of one fingerprint may be sent per window. */
export const MAX_PER_WINDOW = 20;

/** The window itself. */
export const WINDOW_MS = 60 * 60 * 1000;

interface Bucket {
  /** When the current window started. */
  startedAt: number;
  /** How many have been sent in it. */
  count: number;
}

/**
 * The state is module-level because beforeSend has nowhere to put it: the SDK gives a
 * bare function, called once per event, with no instance of ours in scope.
 */
const buckets = new Map<string, Bucket>();

/**
 * How many distinct fingerprints to track.
 *
 * Bounded, because the key comes from error text: a message carrying a part number would
 * otherwise make a new bucket per part and grow without end in a long-running process.
 * When full the oldest is dropped - the map preserves insertion order, so the first key
 * is the least recently started.
 */
const MAX_BUCKETS = 500;

/** The counter, for tests that need to start from nothing. */
export function resetRateLimit(): void {
  buckets.clear();
}

/**
 * Whether an event with this fingerprint may be sent now.
 *
 * Counts the event when it answers true, so a caller must ask exactly once per event.
 */
export function allowEvent(fingerprint: string, now: number): boolean {
  const key = fingerprint || 'unknown';
  const bucket = buckets.get(key);

  if (!bucket || now - bucket.startedAt >= WINDOW_MS) {
    // A fresh window. Re-inserted rather than mutated so it moves to the end of the
    // map's order and is the last to be evicted.
    buckets.delete(key);
    if (buckets.size >= MAX_BUCKETS) {
      const oldest = buckets.keys().next();
      if (!oldest.done) buckets.delete(oldest.value);
    }
    buckets.set(key, { startedAt: now, count: 1 });
    return true;
  }

  if (bucket.count >= MAX_PER_WINDOW) return false;
  bucket.count += 1;
  return true;
}

/**
 * The key an event is counted under.
 *
 * Type and message, with the digits removed. The digits are what differ between one row
 * and the next - "part 44020 failed" and "part 19200 failed" are one fault, and keying
 * on the raw message would give each its own allowance and defeat the cap entirely.
 */
export function fingerprintOf(type: string | undefined, message: string | undefined): string {
  const text = `${type || 'Error'}: ${message || ''}`;
  return text.replace(/\d+/g, '#').slice(0, 200);
}
