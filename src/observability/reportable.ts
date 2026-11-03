/**
 * Which MobileAPI failures are worth an alert, and which are the weather.
 *
 * The Sentry quota is shared with AdminAPI, eBayAPI, the scraper and the admin UI, so
 * anything reported here is reported instead of something else. Two kinds of noise would
 * drown the rest if they were let through:
 *
 *   1. The caller's own mistakes. This service answers a mobile app, so a 400 on a
 *      half-filled form, a 401 on an expired session and a 404 for a part that does not
 *      exist are its ordinary working day - and every one of them is already shown on
 *      the phone. A flaky signal produces them by the hundred.
 *   2. eBay having a moment. Six files here reach eBay, and its transient errors and the
 *      HTML pages it serves under load are weather rather than faults.
 *
 * What this must never drop is the opposite case: a 500 nobody saw, or a Mongo write
 * that threw inside one of this service's 17 detached `forEach(async ...)` calls, where
 * the response has already gone and the error has nowhere to surface. Those are the
 * errors the whole exercise exists for, so the rules below are narrow and name only what
 * is positively known to be ordinary.
 *
 * Pure: an error in, a verdict out.
 */

/** The text to judge an error by, however it was thrown. */
export function messageOf(err: unknown): string {
  if (!err) return '';
  if (typeof err === 'string') return err;
  const e = err as { message?: unknown; name?: unknown };
  return [e.name, e.message].filter(Boolean).map(String).join(': ') || String(err);
}

/**
 * The HTTP status an error carries, or 0.
 *
 * Nest's HttpException exposes getStatus(); other throwers set `status` or `statusCode`.
 * Read defensively because this runs inside an error path and must not throw itself.
 */
export function statusOf(err: unknown): number {
  if (!err || typeof err !== 'object') return 0;
  const e = err as { getStatus?: () => number; status?: unknown; statusCode?: unknown };
  try {
    if (typeof e.getStatus === 'function') {
      const s = Number(e.getStatus());
      if (Number.isFinite(s)) return s;
    }
  } catch {
    // An HttpException subclass with a broken getStatus is still an error worth seeing.
  }
  const raw = Number(e.status ?? e.statusCode);
  return Number.isFinite(raw) ? raw : 0;
}

/**
 * Failures that are the caller's, not ours.
 *
 * 4xx only. 5xx is this service admitting it broke, and a 500 raised deliberately is
 * still a 500 somebody should look at.
 */
export function isClientFault(err: unknown): boolean {
  const status = statusOf(err);
  return status >= 400 && status < 500;
}

/**
 * eBay being briefly unavailable, and ordinary network weather.
 *
 * Deliberately narrow, and every eBay entry is a phrase eBay produced rather than one of
 * ours - a rule matching our own wording would grow until it covered our own bugs.
 */
const TRANSIENT = [
  // "Internal error to the application" - eBay's own transient marker.
  /\berrorId["'\s:=]*62000\b/i,
  /\bInternal error to the application\b/i,
  // eBay answers with an HTML error page under load; a JSON parse then fails here.
  /<!DOCTYPE html|<html[\s>]/i,
  // Ordinary network weather, to eBay or to Atlas. A phone on a bad connection and a
  // momentary Atlas blip look the same from in here, and neither is a defect.
  /\b(ETIMEDOUT|ECONNRESET|ECONNREFUSED|ENOTFOUND|EAI_AGAIN|EPIPE|ESOCKETTIMEDOUT)\b/,
  /\bsocket hang up\b/i,
];

export function isTransient(err: unknown): boolean {
  const msg = messageOf(err);
  return msg ? TRANSIENT.some((re) => re.test(msg)) : false;
}

/**
 * True when this failure is worth reporting.
 *
 * Named for the question actually being asked, rather than its inverse - the call sites
 * read better for it.
 */
export function isReportable(err: unknown): boolean {
  if (!err) return false;
  if (isClientFault(err)) return false;
  if (isTransient(err)) return false;
  return true;
}
