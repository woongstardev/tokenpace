#!/usr/bin/env node
/**
 * snapshot-reach.mjs — write down how far the repository has reached, weekly.
 *
 *   cd tools && npm run reach
 *
 * Appends one row to reach/snapshots.csv: GitHub stars, forks and watchers, the
 * 14-day traffic counts, and the Zenodo views and downloads of the concept DOI.
 *
 * Why this exists: GitHub keeps traffic for 14 days and then discards it. The
 * question "did the announcement do anything" is asked weeks after the
 * announcement, by which time the only record of the answer is gone. A weekly
 * sample is the cheapest thing that keeps it.
 *
 * What it is not: page analytics. Every number here is one the platforms
 * already count about the repository and the DOI. The site still fetches
 * nothing and stores nothing (CONTRIBUTING.md, rules 3 and 4), and nothing in
 * this file touches the site.
 *
 * Fails loudly on any GitHub HTTP error or missing field, and writes nothing in
 * that case. A row of zeros from a failed request would be an invented number,
 * and a quiet one: zero reach is a plausible reading for a young repository.
 *
 * Zenodo is the one exception. When it cannot be read, its four cells are left
 * empty — "not measured", never zero — and the GitHub columns are written
 * anyway. GitHub's traffic window is gone in 14 days; Zenodo's counts are
 * cumulative and next week's row recovers them. Letting a Zenodo outage take
 * the GitHub row down with it lost the one thing this file exists to keep
 * (2026-10-16: zenodo.org unreachable from both tower and the Actions runner).
 *
 * Idempotent per UTC date — a second run on the same day replaces that day's
 * row instead of adding another, so re-running a failed workflow is safe.
 */

import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CSV = path.join(ROOT, 'reach', 'snapshots.csv');

const REPO = 'woongstardev/tokenpace';
/** The concept DOI 10.5281/zenodo.22265787 — always resolves to the latest version. */
const ZENODO_CONCEPT = '22265787';

/**
 * Zenodo answers Node's default `User-Agent: node` with 403 Forbidden, an HTML
 * page rather than an API error (measured 2026-10-02). Naming the client is
 * also simply what both APIs ask for.
 */
const USER_AGENT = `tokenpace-reach-snapshot (+https://github.com/${REPO})`;

// Node gives each address 250 ms before trying the next, and Zenodo (at CERN)
// took ~255 ms to accept a connection from Korea, with its IPv6 addresses
// unreachable from the same host. Every attempt then times out and fetch fails
// on a server that is up. Two seconds per address costs nothing when the
// network is fast and is the difference between a row and no row when it is not.
net.setDefaultAutoSelectFamilyAttemptTimeout(2000);

const COLUMNS = [
  'date',
  'stars',
  'forks',
  'watchers',
  'views_14d',
  'views_uniques_14d',
  'clones_14d',
  'clones_uniques_14d',
  'zenodo_views',
  'zenodo_unique_views',
  'zenodo_downloads',
  'zenodo_unique_downloads',
];

/* ─────────────────────────────────────────────────────────────── token */

/**
 * CI passes GITHUB_TOKEN. Locally, `gh` usually already holds one, so asking
 * it saves exporting a token into the shell by hand. The token is never
 * printed, including in error messages.
 */
function githubToken() {
  const fromEnv = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (fromEnv) return fromEnv;
  try {
    const token = execFileSync('gh', ['auth', 'token'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    if (token) return token;
  } catch {
    // fall through to the error below — the reason is the same either way
  }
  throw new Error('no GitHub token: set GITHUB_TOKEN (or GH_TOKEN), or log in with `gh auth login`');
}

/* ─────────────────────────────────────────────────────────────── fetch */

async function getJson(url, headers) {
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT, ...headers }, redirect: 'follow' });
  if (!res.ok) {
    const body = (await res.text()).slice(0, 300);
    throw new Error(`${url}: HTTP ${res.status} ${res.statusText}${body ? ` — ${body}` : ''}`);
  }
  return res.json();
}

/**
 * A missing field must stop the run, not become `undefined` in a cell or a
 * zero in someone's chart. Every value here is a count, so an integer >= 0 is
 * the whole contract.
 */
function count(value, what) {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${what} is not a count: ${JSON.stringify(value)}`);
  }
  return value;
}

async function github() {
  const headers = {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${githubToken()}`,
    'X-GitHub-Api-Version': '2022-11-28',
  };
  const api = `https://api.github.com/repos/${REPO}`;

  // The traffic endpoints answer only to a token with push access to the
  // repository. Anything less is a 403, which getJson turns into a failure —
  // not into an empty window.
  const [repo, views, clones] = await Promise.all([
    getJson(api, headers),
    getJson(`${api}/traffic/views`, headers),
    getJson(`${api}/traffic/clones`, headers),
  ]);

  return {
    stars: count(repo.stargazers_count, 'stargazers_count'),
    forks: count(repo.forks_count, 'forks_count'),
    // watchers_count is a legacy alias for stars; subscribers_count is the
    // number of people actually watching.
    watchers: count(repo.subscribers_count, 'subscribers_count'),
    views_14d: count(views.count, 'traffic/views count'),
    views_uniques_14d: count(views.uniques, 'traffic/views uniques'),
    clones_14d: count(clones.count, 'traffic/clones count'),
    clones_uniques_14d: count(clones.uniques, 'traffic/clones uniques'),
  };
}

async function zenodo() {
  // The concept record id redirects to the latest version's record. Its
  // `views` and `downloads` are totals across every version of the concept;
  // the `version_*` fields beside them are the latest version alone, which
  // would reset to zero with every release and are deliberately not used.
  const record = await getJson(`https://zenodo.org/api/records/${ZENODO_CONCEPT}`, {
    Accept: 'application/json',
  });
  if (String(record.conceptrecid) !== ZENODO_CONCEPT) {
    throw new Error(`Zenodo record ${record.id} belongs to concept ${record.conceptrecid}, not ${ZENODO_CONCEPT}`);
  }
  const stats = record.stats ?? {};
  return {
    zenodo_views: count(stats.views, 'zenodo stats.views'),
    zenodo_unique_views: count(stats.unique_views, 'zenodo stats.unique_views'),
    zenodo_downloads: count(stats.downloads, 'zenodo stats.downloads'),
    zenodo_unique_downloads: count(stats.unique_downloads, 'zenodo stats.unique_downloads'),
  };
}

/* ─────────────────────────────────────────────────────────────── write */

async function readRows() {
  let text;
  try {
    text = await readFile(CSV, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
  const lines = text.split('\n').filter((line) => line.trim());
  if (lines.length === 0) return [];
  // Appending to a file whose columns mean something else would misfile every
  // number from here on. If the header ever changes, that is a migration, and
  // it is done on purpose.
  if (lines[0] !== COLUMNS.join(',')) {
    throw new Error(`${path.relative(ROOT, CSV)} has an unexpected header: ${lines[0]}`);
  }
  return lines.slice(1);
}

const date = new Date().toISOString().slice(0, 10); // UTC, matching the weekly cron

/**
 * Zenodo's columns as empty cells, with the reason on stderr — and, in Actions,
 * as a warning annotation, so a run that kept only half a row does not look
 * like a clean one.
 */
async function zenodoOrBlank() {
  try {
    return await zenodo();
  } catch (err) {
    const reason = err.cause ? `${err.message} (${err.cause.code ?? err.cause.message})` : err.message;
    const message = `Zenodo not recorded, cells left empty: ${reason}`;
    console.error(process.env.GITHUB_ACTIONS ? `::warning title=Zenodo not recorded::${message}` : `warning: ${message}`);
    return {};
  }
}

// Fetch everything before touching the file: a half-measured GitHub row is
// still an invented one. A missing Zenodo is written as empty cells, not zeros.
const values = { date, ...(await github()), ...(await zenodoOrBlank()) };
const row = COLUMNS.map((c) => values[c] ?? '').join(',');

const existing = await readRows();
const kept = existing.filter((line) => !line.startsWith(`${date},`));
const replaced = kept.length !== existing.length;

await mkdir(path.dirname(CSV), { recursive: true });
await writeFile(CSV, [COLUMNS.join(','), ...kept, row].join('\n') + '\n');

console.log(`${replaced ? 'replaced' : 'appended'} ${date} in ${path.relative(ROOT, CSV)}`);
console.log(`  ${COLUMNS.join(',')}`);
console.log(`  ${row}`);
