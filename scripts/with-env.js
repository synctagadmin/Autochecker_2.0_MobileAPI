#!/usr/bin/env node
'use strict';

/**
 * Run this repository's own start command under a named environment profile.
 *
 *   node scripts/with-env.js <profile> -- <command> [args...]   start under the profile
 *   node scripts/with-env.js <profile> --status                 print the wiring, start nothing
 *   node scripts/with-env.js <profile> --validate               check it, exit 1 if wrong
 *
 * The profile's values are put into the CHILD's environment. No .env file is read,
 * written or moved: this repo's .env stays exactly as it is on disk, and the injected
 * values simply win, because dotenv does not overwrite a variable that is already set.
 * `npm start` and every other existing script therefore behave exactly as before.
 *
 * Nothing starts until the whole resolved chain has passed. A profile that reaches the
 * wrong environment prints what it would have done and exits non-zero.
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { resolveProfile, statusLines } = require('./env-core');

const REPO = path.resolve(__dirname, '..');
const CONFIG = path.join(REPO, 'config', 'env.profiles.json');

function die(msg) {
  console.error(msg);
  process.exit(1);
}

const argv = process.argv.slice(2);
const profileName = argv[0];
if (!profileName || profileName.startsWith('-')) {
  die('Usage: node scripts/with-env.js <profile> [--status|--validate] [-- <command> ...]');
}
const wantStatus = argv.includes('--status');
const wantValidate = argv.includes('--validate');
const dashdash = argv.indexOf('--');
const command = dashdash === -1 ? [] : argv.slice(dashdash + 1);

let config;
try {
  config = JSON.parse(fs.readFileSync(CONFIG, 'utf8'));
} catch (e) {
  die(`Could not read ${CONFIG}: ${e.message}`);
}

/**
 * What the application will actually see, which is not the same as this shell.
 *
 * The app loads its own .env through dotenv, so a credential like MONGO_URI can be set
 * there and absent here. Validating against the shell alone reported "not set" for a
 * value the app would go on to use - a check that passes or fails on something other
 * than what runs is worse than no check.
 *
 * Read for VALIDATION only. Nothing from here is passed to the child: its own dotenv
 * does that, with the same precedence (a variable already set is never overwritten).
 * Values are never printed - only whether they are present and what they resolve to.
 */
function envAsAppWillSeeIt() {
  const merged = Object.assign({}, process.env);
  let text;
  try {
    text = fs.readFileSync(path.join(REPO, '.env'), 'utf8');
  } catch {
    return merged; // no .env is normal for some of these services
  }
  for (const line of text.split(/\r?\n/)) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!m) continue;
    const key = m[1];
    if (merged[key] !== undefined) continue; // dotenv does not override; neither do we
    let value = m[2].trim();
    const quoted = /^(['"])([\s\S]*)\1$/.exec(value);
    if (quoted) value = quoted[2];
    else value = value.replace(/\s+#.*$/, '').trim();
    merged[key] = value;
  }
  return merged;
}

const resolved = resolveProfile(config, profileName, envAsAppWillSeeIt());
console.log('');
for (const line of statusLines(resolved)) console.log(line);
console.log('');

if (wantStatus && !wantValidate) process.exit(0);

if (!resolved.canStart) {
  if (resolved.deployOnly) {
    console.error(`The "${resolved.profile}" profile is for deployment and does not start from here.`);
    console.error('It is shown so the configuration can be read and checked; starting it from a');
    console.error('workstation is how a developer ends up writing to production.');
  } else {
    console.error(`Blocked: the "${resolved.profile}" profile did not validate (see FAIL above).`);
    console.error('Nothing was started and no file was changed.');
  }
  process.exit(1);
}

if (wantValidate && command.length === 0) {
  console.log('Configuration valid.');
  process.exit(0);
}

if (command.length === 0) {
  die('Nothing to run. Pass the command after `--`, or use --status / --validate.');
}

// npm and npx are .cmd shims on Windows and need a shell; a bare binary does not.
const needsShell = process.platform === 'win32' && /^(npm|npx|yarn|pnpm)$/.test(command[0]);
const child = spawn(command[0], command.slice(1), {
  cwd: REPO,
  env: Object.assign({}, process.env, resolved.env),
  stdio: 'inherit',
  shell: needsShell,
});

// Ctrl+C must stop what this script started and nothing else - no process sweeping, no
// killing by name. The child gets the signal; its own tooling decides how to stop.
let stopping = false;
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    if (stopping) return;
    stopping = true;
    if (!child.killed) child.kill(sig);
  });
}

child.on('error', (e) => {
  console.error(`Could not start ${command.join(' ')}: ${e.message}`);
  process.exit(1);
});
child.on('exit', (code, signal) => {
  if (signal) process.exit(0);
  process.exit(code === null ? 1 : code);
});
