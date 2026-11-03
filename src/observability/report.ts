/**
 * Reporting a fault by hand, for the places the SDK cannot see on its own.
 *
 * Two of them matter here:
 *
 *   - the process guards in main.ts. An unhandled rejection in one of this service's 17
 *     `forEach(async ...)` calls happens after the response has gone, so nothing is
 *     returned to the phone and nothing is logged anywhere a person looks. Those are the
 *     bugs nobody has ever seen.
 *   - the global exception filter, which turns a thrown error into a 500. The app shows
 *     "Internal server error" and the stack goes to the pm2 log; without this the only
 *     record of WHY is a line in a file nobody reads.
 *
 * Every call is a no-op when Sentry was not initialised, so a local run without a DSN
 * behaves exactly as it did before.
 */
import * as Sentry from '@sentry/node';
import { sentryEnabled } from '../instrument';
import { isReportable } from './reportable';
import { scrubString } from './scrub';

/**
 * A fault from one of the process-level guards.
 *
 * Reported before anything else happens: pm2 restarts in seconds and an uncaught
 * exception's reason would be gone with the process.
 */
export function reportProcessFault(err: unknown, kind: 'uncaughtException' | 'unhandledRejection'): void {
  if (!sentryEnabled || !isReportable(err)) return;
  Sentry.withScope((scope) => {
    scope.setLevel('fatal');
    scope.setTag('fault', kind);
    Sentry.captureException(normalise(err));
  });
}

/**
 * A fault that became a 500, with the request that caused it.
 *
 * The route is a tag rather than part of the message so that one broken endpoint groups
 * as one issue however many different parts it was called with.
 */
export function reportRequestFault(err: unknown, method?: string, url?: string): void {
  if (!sentryEnabled || !isReportable(err)) return;
  Sentry.withScope((scope) => {
    scope.setLevel('error');
    scope.setTag('fault', 'request');
    if (method) scope.setTag('http.method', method);
    // The path without its query string: the query is where an identifier would be, and
    // a thousand part numbers would otherwise become a thousand issues.
    if (url) scope.setTag('http.route', scrubString(String(url).split('?')[0]));
    Sentry.captureException(normalise(err));
  });
}

/**
 * Something thrown that is not an Error.
 *
 * This codebase throws strings and plain objects in places. Sentry can only group what
 * has a stack, so anything else is wrapped - without one, every such event lands in a
 * single unreadable issue.
 */
export function normalise(err: unknown): Error {
  if (err instanceof Error) return err;
  return new Error(scrubString(typeof err === 'string' ? err : safeStringify(err)));
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    // Circular, or a getter that throws. The type is still worth having.
    return Object.prototype.toString.call(value);
  }
}
