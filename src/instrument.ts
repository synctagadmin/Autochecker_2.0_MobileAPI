/**
 * Sentry for MobileAPI, started before the application loads.
 *
 * Imported from main.ts as its FIRST import, ahead of ./app.module: the SDK instruments
 * http and mongoose by patching those modules, so anything required before this line is
 * never seen. app.module.ts is what pulls Mongoose in, which is why the order matters
 * rather than being a style preference.
 *
 * dotenv is loaded HERE as well, and deliberately. This service calls dotenv.config()
 * inside app.module.ts - its own comment explains that a module's imports run before its
 * body, so that is the first point the connection string can still be read. By the same
 * rule it is too LATE for this file, which runs earlier still: without its own call,
 * SENTRY_DSN would not be in the environment yet and Sentry would silently never start.
 *
 * Four rules, the same ones AdminAPI, eBayAPI, the scraper and the admin UI hold:
 *
 *   1. No DSN, no Sentry. A developer's machine sends nothing unless it is asked to.
 *   2. No environment, no Sentry. An event filed with no environment cannot be told
 *      apart from a production one, and a production alarm that is really a developer is
 *      worse than no alarm. It refuses loudly rather than guessing.
 *   3. Every event carries `service: mobile-api`, because the project is shared.
 *   4. Nothing leaves with a credential or a customer in it - see observability/scrub.
 *
 * @sentry/node rather than @sentry/nestjs, which is what AdminAPI uses. That package
 * declares `@nestjs/common ^8 || ^9 || ^10 || ^11 || ^12` and this service is on 7.6, so
 * it is not installable here without forcing a combination nobody supports. The Nest
 * integration it would have provided is one global exception filter, which this service
 * has of its own - see sentry-exception.filter.ts.
 *
 * TRACING IS OFF BY DEFAULT, and that is a decision rather than an oversight. Tracing is
 * what attaches the Mongo query to the request that failed, which is the most useful
 * thing this service could tell us. It is also billed per span on a shared quota, so
 * turning it on blind is how a monitoring bill arrives unannounced.
 * SENTRY_TRACES_SAMPLE_RATE turns it on when there is real volume to judge by.
 */
import * as dotenv from 'dotenv';

dotenv.config();

import * as Sentry from '@sentry/node';
import { scrubDeep, scrubString } from './observability/scrub';
import { allowEvent, fingerprintOf } from './observability/rate-limit';

const dsn = (process.env.SENTRY_DSN || '').trim();
const environment = (process.env.SENTRY_ENVIRONMENT || '').trim();

/** Whether this process reports to Sentry at all. Read by the helpers, and by the tests. */
export const sentryEnabled = Boolean(dsn && environment);

/**
 * How much tracing to do, between 0 and 1. Unset or unreadable means none.
 *
 * Parsed defensively: a typo in a deployment's .env must not stop this service starting.
 * That is not hypothetical here - this service failed to start on 28 Oct 2026 because a
 * missing variable threw during boot.
 */
export function tracesSampleRateFrom(raw: string | undefined): number {
  const n = Number((raw || '').trim());
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(n, 1);
}

if (dsn && !environment) {
  // Not thrown: a monitoring misconfiguration must never stop the API serving.
  console.error(
    '[sentry] SENTRY_DSN is set but SENTRY_ENVIRONMENT is not, so Sentry is OFF. '
    + 'Events with no environment cannot be told apart from production ones.',
  );
}

if (sentryEnabled) {
  Sentry.init({
    dsn,
    environment,
    // "mobile-api@<version>" rather than a bare version: several services share this
    // project and a release called "0.0.1" in it would belong to any of them.
    release: process.env.SENTRY_RELEASE || `mobile-api@${process.env.npm_package_version || 'dev'}`,
    initialScope: { tags: { service: 'mobile-api' } },
    tracesSampleRate: tracesSampleRateFrom(process.env.SENTRY_TRACES_SAMPLE_RATE),


    /**
     * The last gate before anything leaves the process.
     *
     * Two jobs, in this order. Drop what the quota should not carry - see rate-limit -
     * and scrub what remains. Scrubbing second so a dropped event costs nothing.
     *
     * Wrapped whole: a throw in here loses the event AND, depending on the SDK version,
     * the ones behind it. Returning the event unscrubbed on failure would be worse than
     * losing it, so the catch drops it.
     */
    beforeSend(event) {
      try {
        const first = event.exception?.values?.[0];
        const fingerprint = fingerprintOf(first?.type, first?.value || event.message);
        if (!allowEvent(fingerprint, Date.now())) return null;

        if (event.message) event.message = scrubString(event.message);
        if (event.exception?.values) {
          for (const value of event.exception.values) {
            if (value.value) value.value = scrubString(value.value);
          }
        }
        if (event.extra) event.extra = scrubDeep(event.extra);
        if (event.breadcrumbs) {
          event.breadcrumbs = event.breadcrumbs.map((b) => ({
            ...b,
            message: b.message ? scrubString(b.message) : b.message,
            data: b.data ? scrubDeep(b.data) : b.data,
          }));
        }
        if (event.request?.url) event.request.url = scrubString(event.request.url);
        // The hostname says nothing a tag does not and is one more thing leaving the
        // box. Dropped here rather than via an init option: @sentry/node v8 has no
        // includeServerName, and doing it in beforeSend cannot go stale with the SDK.
        delete event.server_name;
        return event;
      } catch {
        return null;
      }
    },
  });
}

/** Re-exported so callers need not depend on the SDK package name directly. */
export { Sentry };
