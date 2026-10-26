'use strict';

/**
 * Resolving and checking an environment profile, with nothing that touches the world.
 *
 * Every AutoChecker application is deployed to its own server, so each repo carries its
 * own copy of this file and its own config/env.profiles.json. An app configures ITSELF
 * and nothing else: there is no workspace launcher, and `npm run env:status` means the
 * same thing on a laptop and on the staging box.
 *
 * What it exists to stop: a chain that is local at one end and production at the other,
 * with nothing on screen to say so. A local AdminAPI spent an afternoon calling the
 * production eBay service and the staging scraper while its own UI ran on localhost, and
 * the only way to find out was to read four .env files across three repositories.
 *
 * Pure on purpose - strings in, verdict out - so every rule below is tested without
 * spawning a process, opening a socket or reading a file.
 */

/** Where a host belongs, from the profile's own lists. "unknown" is never assumed safe. */
function classifyHost(hostname, classify) {
  const host = String(hostname || '').toLowerCase();
  if (!host) return 'unknown';
  for (const kind of ['local', 'staging', 'production']) {
    const list = (classify && classify[kind]) || [];
    if (list.some((h) => String(h).toLowerCase() === host)) return kind;
  }
  return 'unknown';
}

/** The hostname of a URL, or null when it is not one. */
function hostOf(url) {
  try {
    return new URL(String(url)).hostname;
  } catch {
    return null;
  }
}

/**
 * The cluster and database a MongoDB connection string points at.
 *
 * Credentials are never returned, so a caller cannot print them by accident. The cluster
 * is the first label of the host - `autopartscheckerprod.1me3yhq.mongodb.net` is the
 * production CLUSTER, which is not the same thing as the production DATABASE: our staging
 * database is hosted on it.
 */
function parseMongoUri(uri) {
  const raw = String(uri || '').trim();
  if (!raw) return { ok: false, reason: 'empty' };
  const m = /^mongodb(\+srv)?:\/\/(?:[^@/]*@)?([^/?]+)(?:\/([^?]*))?/i.exec(raw);
  if (!m) return { ok: false, reason: 'not a MongoDB connection string' };
  const host = (m[2] || '').split(',')[0].split(':')[0];
  const database = decodeURIComponent((m[3] || '').trim());
  if (!host) return { ok: false, reason: 'no host' };
  if (!database) return { ok: false, reason: 'no database in the connection string' };
  return { ok: true, cluster: host.split('.')[0], clusterHost: host, database };
}

/**
 * The environment a profile actually resolves to, and whether it is allowed to start.
 *
 * `env` is what would be handed to the child process. `checks` is every rule that ran,
 * so the status output and the failure message come from one place and cannot disagree.
 */
function resolveProfile(config, profileName, processEnv) {
  const profiles = (config && config.profiles) || {};
  const profile = profiles[profileName];
  const checks = [];
  const app = (config && config.app) || 'application';

  if (!profile) {
    return {
      app,
      profile: profileName,
      env: {},
      upstreams: [],
      database: null,
      checks: [{ ok: false, label: `Unknown profile "${profileName}"`, detail: `Known profiles: ${Object.keys(profiles).join(', ') || 'none'}` }],
      canStart: false,
      deployOnly: false,
    };
  }

  const env = Object.assign({}, profile.env || {});
  const classify = (config && config.classify) || {};

  // ── upstreams ──
  //
  // Classified from the profile's own env AND from any `requires` variable that the
  // environment supplies as a URL.
  //
  // The second half matters. A profile that deliberately does NOT hard-code an upstream -
  // because defaulting it would be the dangerous thing - declares it in `requires` and
  // leaves the value to .env instead. Reading only `env` meant that value was checked for
  // PRESENCE and never for where it pointed, so MobileAPI's staging profile accepted the
  // production scraper: the one case the profile was shaped that way to prevent.
  const candidates = Object.entries(env).slice();
  for (const key of profile.requires || []) {
    if (key in env) continue; // the profile's own value already covers it
    const supplied = (processEnv || {})[key];
    if (supplied !== undefined) candidates.push([key, supplied]);
  }

  const upstreams = [];
  for (const [key, value] of candidates) {
    if (!/^https?:\/\//i.test(String(value))) continue;
    const host = hostOf(value);
    upstreams.push({ key, url: value, host, kind: host ? classifyHost(host, classify) : 'invalid' });
  }

  for (const u of upstreams) {
    if (u.kind === 'invalid') {
      checks.push({ ok: false, label: `${u.key} is not a valid URL`, detail: String(u.url) });
    }
  }

  // A local profile that reaches anywhere but localhost is the exact failure this exists
  // for, so it blocks rather than warns - including on "unknown", which is not a promise.
  if (profileName === 'local') {
    for (const u of upstreams) {
      if (u.kind === 'invalid') continue;
      checks.push({
        ok: u.kind === 'local',
        label: `${u.key} → ${u.host}`,
        detail: u.kind === 'local' ? 'local' : `${u.kind} — a local profile must not call it`,
      });
    }
  } else {
    for (const u of upstreams) {
      if (u.kind === 'invalid') continue;
      const bad = profileName === 'staging' && u.kind === 'production';
      checks.push({
        ok: !bad,
        label: `${u.key} → ${u.host}`,
        detail: bad ? 'production — a staging profile must not call it' : u.kind,
      });
    }
  }

  // ── database ──
  let database = null;
  if (profile.database) {
    const known = (config && config.databases) || {};
    const expected = known[profile.database] || null;
    const fromVar = profile.databaseFrom || 'MONGO_URI';
    const uri = (processEnv || {})[fromVar];

    if (!uri) {
      // Explicit configuration required: nothing is guessed, and no default is applied
      // that could quietly be the wrong database.
      checks.push({
        ok: false,
        label: `${fromVar} is not set`,
        detail: `The "${profileName}" profile requires ${fromVar} to point at ${profile.database}. Set it in this repository's .env — it is a credential and must not go in config/env.profiles.json.`,
      });
      database = { configured: false, expected: profile.database, fromVar };
    } else {
      const parsed = parseMongoUri(uri);
      if (!parsed.ok) {
        checks.push({ ok: false, label: `${fromVar} is not usable`, detail: parsed.reason });
        database = { configured: false, expected: profile.database, fromVar };
      } else {
        const actual = known[parsed.database] || null;
        const kind = actual ? actual.kind : 'unknown';
        database = {
          configured: true,
          name: parsed.database,
          cluster: parsed.cluster,
          clusterHost: parsed.clusterHost,
          kind,
          note: actual && actual.note ? actual.note : '',
          expected: profile.database,
          fromVar,
        };

        const nameOk = parsed.database === profile.database;
        checks.push({
          ok: nameOk,
          label: `database ${parsed.database} @ ${parsed.cluster}`,
          detail: nameOk
            ? (database.note || kind)
            : `the "${profileName}" profile expects ${profile.database}`,
        });

        if (expected && expected.cluster && parsed.cluster !== expected.cluster) {
          checks.push({
            ok: false,
            label: `cluster ${parsed.cluster}`,
            detail: `${profile.database} lives on ${expected.cluster}`,
          });
        }

        // The last line of defence, independent of the name check above: a local profile
        // never writes to a production database, whatever the profile claims to expect.
        if (profileName === 'local' && kind === 'production') {
          checks.push({
            ok: false,
            label: `${parsed.database} is a PRODUCTION database`,
            detail: 'a local profile must never connect to it',
          });
        }
      }
    }
  }

  // ── required variables ──
  for (const key of profile.requires || []) {
    const present = Boolean((processEnv || {})[key] || env[key]);
    checks.push({
      ok: present,
      label: `${key}`,
      detail: present ? 'set' : 'required by this profile and not set',
    });
  }

  const deployOnly = profile.deployOnly === true;
  const failed = checks.some((c) => !c.ok);
  return {
    app,
    profile: profileName,
    description: profile.description || '',
    env,
    upstreams,
    database,
    checks,
    deployOnly,
    // A deploy-only profile never starts from here however clean it validates.
    canStart: !failed && !deployOnly,
  };
}

/** The resolved environment as lines to print. Never includes a credential. */
function statusLines(resolved) {
  const out = [];
  out.push(`${resolved.app} — profile: ${String(resolved.profile).toUpperCase()}`);
  if (resolved.description) out.push(`  ${resolved.description}`);
  out.push('');
  for (const u of resolved.upstreams) {
    out.push(`  ${u.key.padEnd(22)} ${u.url}   [${u.kind}]`);
  }
  for (const [k, v] of Object.entries(resolved.env)) {
    if (/^https?:\/\//i.test(String(v))) continue;
    // A blank is a value nobody has filled in yet, which must not look like a value.
    out.push(`  ${k.padEnd(22)} ${String(v) === '' ? '(not set yet)' : v}`);
  }
  if (resolved.database) {
    const d = resolved.database;
    out.push(
      d.configured
        ? `  ${'database'.padEnd(22)} ${d.name} @ ${d.cluster}   [${d.kind}]${d.note ? `  — ${d.note}` : ''}`
        : `  ${'database'.padEnd(22)} not configured (expects ${d.expected} via ${d.fromVar})`,
    );
  }
  out.push('');
  for (const c of resolved.checks) {
    out.push(`  ${c.ok ? 'OK  ' : 'FAIL'} ${c.label}${c.detail ? ` — ${c.detail}` : ''}`);
  }
  return out;
}

module.exports = { classifyHost, hostOf, parseMongoUri, resolveProfile, statusLines };
