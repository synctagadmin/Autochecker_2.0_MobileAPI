/**
 * Removing secrets from anything on its way to Sentry.
 *
 * The dangerous values travel inside ordinary error text rather than in fields anyone
 * would think to exclude:
 *
 *   - the MongoDB connection string. Mongoose puts the whole URI, username and password
 *     included, into the message of a connection failure - the single most likely error
 *     to be reported, carrying the single most sensitive value here. app.module.ts reads
 *     it from MONGO_URI and refuses to start without one, so every deployment has a real
 *     credential in scope;
 *   - the JWT this service issues and accepts. It IS the user's session;
 *   - eBay OAuth and Auth'n'Auth tokens, which appear in the text of a refused eBay call;
 *   - the AES envelope the admin apps wrap their exchanges in, which is useless noise on
 *     an issue and decryptable where it is not.
 *
 * Ported from AdminAPI's rules unchanged, Azure included. This service holds no Azure
 * blob connection string of its own today, but the rules cost nothing and the settings
 * documents these services share do carry one - a rule that is present and unused is
 * cheaper than discovering it was needed from an issue that already leaked.
 *
 * Applied to the message, every exception value, every breadcrumb and the extra data.
 * Pure string in, string out, so the rules are tested without a network or an SDK.
 */

/** What a redacted value looks like, wherever it is found. */
export const REDACTED = '[redacted]';

const RULES: Array<[RegExp, string]> = [
  // mongodb://user:pass@host/db and mongodb+srv://... - keep the shape, lose the secret.
  // The shape is worth keeping: "a Mongo connection failed" is the diagnosis.
  [/\bmongodb(\+srv)?:\/\/[^\s"'<>]+/gi, `mongodb$1://${REDACTED}`],
  // Azure storage. AccountKey is the credential; the account name is not, and losing it
  // would cost the one piece of a blob error worth reading - WHICH account was wrong.
  [/\bAccountKey=[^;\s"']+/gi, `AccountKey=${REDACTED}`],
  [/\bSharedAccessSignature=[^;\s"']+/gi, `SharedAccessSignature=${REDACTED}`],
  // eBay OAuth tokens have a documented, unmistakable prefix. Anchored on it so an
  // ordinary long string is not mangled.
  [/\bv\^1\.1#[A-Za-z0-9#^+/=_-]{32,}/g, REDACTED],
  // A JWT - the admin session, and anything else signed. Three dot-separated b64 parts.
  [/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g, REDACTED],
  // A PEM block, whole. The body is base64 and would otherwise be caught by the envelope
  // rule below, but only in pieces - the header lines would survive and say what kind of
  // key had just leaked. Matched first, and replaced entirely.
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, REDACTED],
  [/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g, REDACTED],
  // Any other URL carrying credentials, e.g. http://user:pass@host.
  [/\b(https?|socks5):\/\/[^\s/:@"']+:[^\s/@"']+@/gi, `$1://${REDACTED}@`],
  // An auth header keeps its scheme and loses its value. Before the generic rule below,
  // which would otherwise redact the word "Bearer" itself and leave a message that no
  // longer says what kind of credential failed.
  [/\b(authorization\s*[:=]\s*)(bearer|basic|token)\s+\S+/gi, `$1$2 ${REDACTED}`],
  [/\bBearer\s+[A-Za-z0-9._~+/-]{12,}=*/g, `Bearer ${REDACTED}`],
  // The common secret-ish assignments, however they are written.
  // The `["']?` after the name is not decoration: `"apiKey": "..."` is the ordinary JSON
  // shape in a Node service, and without it the closing quote sits between the key and
  // the colon and the rule never matches - which is how a JSON-shaped secret would have
  // travelled while an `apiKey=` one was caught.
  [/\b(password|passwd|secret|token|api[_-]?key|accountkey)\b["']?(\s*[:=]\s*)(["']?)[^\s,;&"'}]+\3/gi,
    `$1$2$3${REDACTED}$3`],
];

/**
 * The AES envelope every AdminUI exchange is wrapped in.
 *
 * Long enough that it cannot be an identifier or a part number, and matched only when it
 * looks like the base64 this service produces. Replaced rather than dropped so the issue
 * still records that an encrypted body was involved, which is often the clue.
 */
const ENVELOPE = /\b[A-Za-z0-9+/]{120,}={0,2}/g;

/** The same text with every known secret shape replaced. */
export function scrubString(value: string): string {
  let out = String(value);
  for (const [pattern, replacement] of RULES) out = out.replace(pattern, replacement);
  return out.replace(ENVELOPE, `${REDACTED}(encrypted-body)`);
}

/**
 * Keys whose VALUE is dropped outright, whatever it looks like.
 *
 * Two groups, for two reasons. The credentials, because a password of "hunter2" matches
 * none of the patterns above. And the customer, because this service handles orders and
 * invoices: a name or an address is not a secret in the credential sense but has no place
 * on an issue either, and nothing is diagnosed by reading one.
 */
const DROP_KEY = new RegExp(`^(${[
  // Credentials. The list the monitoring plan names (1.4, control 1), plus the four this
  // codebase has of its own. Anchored, so `auth` and `session` have to be listed even
  // though `authorization` is here - a key named exactly `auth` would otherwise pass
  // straight through, which it did until this was checked against the plan.
  'password', 'passwd', 'secret', 'token', 'access_token', 'refresh_token',
  'authorization', 'auth', 'apikey', 'api_key', 'credential', 'cookie', 'session',
  'jwt', 'key', 'connectionstring', 'accountkey', 'privatekey', 'signature',
  // This codebase's own names for the same things.
  'mongo_uri', 'mongodb_uri', 'jwt_secret', 'loader_key', 'blobconnection',
  'googleplaykey',
  // The customer. Not a secret in the credential sense, but nothing is diagnosed by
  // reading one, and Orders, Invoices and Checkout all pass through this service.
  'email', 'phone', 'phonenumber', 'mobile', 'address', 'address1', 'address2',
  'street', 'postalcode', 'zip', 'buyername', 'customername',
].join('|')})$`, 'i');

/**
 * Bounds, so a huge or hostile payload cannot hang the scrubber.
 *
 * This runs inside an error path: if it does not return, nothing is reported and the
 * failure that triggered it is lost too. A Mongoose document reached through `extra` is
 * deep and wide enough for this to be a real limit rather than a theoretical one.
 */
const MAX_DEPTH = 12;
const MAX_KEYS = 1000;
export const TRUNCATED = '[truncated]';

/**
 * The same structure with every string scrubbed and every secret-named key dropped.
 *
 * Cycles are tracked: an error reached through `extra` can hold a Mongoose document that
 * references itself, and a naive walk would never return.
 */
export function scrubDeep<T>(value: T, seen = new WeakSet<object>(), depth = 0): T {
  if (typeof value === 'string') return scrubString(value) as unknown as T;
  if (value === null || typeof value !== 'object') return value;
  if (seen.has(value as unknown as object)) return value;
  // Past the cap the branch is replaced rather than walked. Replaced, not dropped: an
  // issue that says a structure was too deep is worth more than one that silently lost
  // it - and anything NOT walked is anything NOT scrubbed, so it must not travel.
  if (depth >= MAX_DEPTH) return TRUNCATED as unknown as T;
  seen.add(value as unknown as object);

  if (Array.isArray(value)) {
    const head = value.slice(0, MAX_KEYS).map((v) => scrubDeep(v, seen, depth + 1));
    if (value.length > MAX_KEYS) head.push(TRUNCATED);
    return head as unknown as T;
  }
  const out: Record<string, unknown> = {};
  let n = 0;
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (n >= MAX_KEYS) { out[TRUNCATED] = `${Object.keys(value as unknown as object).length - MAX_KEYS} more`; break; }
    n += 1;
    out[k] = DROP_KEY.test(k) ? REDACTED : scrubDeep(v, seen, depth + 1);
  }
  return out as unknown as T;
}
