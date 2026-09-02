#!/usr/bin/env node
/**
 * check-site.mjs — enforce the promises this repository makes.
 *
 *   node tools/check-site.mjs
 *
 * Generic linters check that code is tidy. These checks are the ones where
 * being wrong would make the project dishonest rather than merely untidy:
 *
 *   - the page really does load nothing from anywhere
 *   - the published figures really do come from the committed scripts
 *   - the vendored tokenizer really is the file its manifest claims
 *   - every internal link really resolves
 *
 * Runs without installing anything.
 */

import { readFile, readdir, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const failures = [];
const fail = (check, detail) => failures.push(`${check}: ${detail}`);
const ok = (check) => console.log(`  ok   ${check}`);

const IGNORE_DIRS = new Set(['.git', 'node_modules', 'cache', 'vendor']);

async function walk(dir, out = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') && entry.name !== '.github') continue;
    if (IGNORE_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(full, out);
    else out.push(full);
  }
  return out;
}

const rel = (p) => path.relative(ROOT, p);
const exists = async (p) => { try { await stat(p); return true; } catch { return false; } };

/* ─────────────────────────────────────────── 1. no external requests ever */

/**
 * The site must not reach off-origin. Documentation links are fine — a URL a
 * human clicks is not a request the page makes — so this looks only at the
 * places a browser would fetch from: markup attributes, CSS url(), and the
 * network APIs.
 */
async function checkNoExternalRequests() {
  const check = 'no external requests';
  const html = await readFile(path.join(ROOT, 'index.html'), 'utf8');

  // `rel="canonical"` is the one absolute href a browser never fetches — it
  // names the page, it does not request anything. Everything else that carries
  // a src or href is a request, so the rule stays absolute for all of them.
  const canonicalHref = html.match(/<link\s+rel="canonical"\s+href="([^"]*)"/)?.[1];
  for (const [, attr, value] of html.matchAll(/\s(src|href)\s*=\s*"([^"]*)"/g)) {
    if (value === canonicalHref) continue;
    if (/^(https?:)?\/\//.test(value)) fail(check, `index.html has a remote ${attr}: ${value}`);
  }

  const css = await readFile(path.join(ROOT, 'assets', 'css', 'app.css'), 'utf8');
  for (const [, url] of css.matchAll(/url\(\s*['"]?([^'")]+)/g)) {
    if (/^(https?:)?\/\//.test(url)) fail(check, `app.css references a remote asset: ${url}`);
  }
  if (/@import\s+url\(\s*['"]?https?:/.test(css)) fail(check, 'app.css @imports a remote stylesheet');

  const jsDir = path.join(ROOT, 'assets', 'js');
  for (const file of await walk(jsDir)) {
    const source = await readFile(file, 'utf8');
    for (const api of ['fetch(', 'XMLHttpRequest', 'new WebSocket', 'navigator.sendBeacon', 'EventSource']) {
      if (source.includes(api)) fail(check, `${rel(file)} uses ${api}`);
    }
    for (const [, spec] of source.matchAll(/\bimport\s*\(\s*['"]([^'"]+)['"]/g)) {
      if (!spec.startsWith('.')) fail(check, `${rel(file)} dynamically imports a non-relative module: ${spec}`);
    }
  }

  if (!failures.some((f) => f.startsWith(check))) ok(check);
}

/* ─────────────────────────────────────── 2. CSP is present and restrictive */

async function checkCsp() {
  const check = 'content security policy';
  const html = await readFile(path.join(ROOT, 'index.html'), 'utf8');
  const meta = html.match(/http-equiv="Content-Security-Policy"\s+content="([^"]+)"/);
  if (!meta) {
    fail(check, 'index.html has no CSP meta tag');
    return;
  }
  for (const directive of ["default-src 'none'", "script-src 'self'", "connect-src 'none'"]) {
    if (!meta[1].includes(directive)) fail(check, `meta CSP is missing ${directive}`);
  }
  // frame-ancestors is silently ignored in a meta tag; keeping it there would
  // read as protection that is not there.
  if (meta[1].includes('frame-ancestors')) {
    fail(check, 'meta CSP declares frame-ancestors, which browsers ignore — it belongs in _headers');
  }
  if (!(await exists(path.join(ROOT, '_headers')))) {
    fail(check, '_headers is missing, so the real CSP would never be served');
  } else {
    const headers = await readFile(path.join(ROOT, '_headers'), 'utf8');
    if (!headers.includes('frame-ancestors')) fail(check, '_headers does not set frame-ancestors');
  }
  if (!failures.some((f) => f.startsWith(check))) ok(check);
}

/* ────────────────────────────────── 3. vendored files match their manifest */

async function checkVendor() {
  const check = 'vendored tokenizer integrity';
  const root = path.join(ROOT, 'assets', 'vendor', 'gpt-tokenizer');
  const manifestPath = path.join(root, 'VENDOR.json');
  if (!(await exists(manifestPath))) {
    fail(check, 'VENDOR.json is missing — run `npm run vendor -- --apply` in tools/');
    return;
  }
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  if (!(await exists(path.join(root, 'LICENSE')))) fail(check, 'vendored LICENSE is missing');

  for (const entry of manifest.files) {
    const file = path.join(root, entry.path);
    if (!(await exists(file))) {
      fail(check, `${entry.path} is listed in VENDOR.json but missing`);
      continue;
    }
    const digest = createHash('sha256').update(await readFile(file)).digest('hex').slice(0, 16);
    if (digest !== entry.sha256) fail(check, `${entry.path} does not match its recorded hash`);
  }
  if (!failures.some((f) => f.startsWith(check))) ok(`${check} (${manifest.files.length} files, v${manifest.version})`);
}

/* ──────────────────────────────── 4. generated files carry their warning */

async function checkGeneratedMarkers() {
  const check = 'generated files are marked';
  const generated = [
    ['assets/data/density.js', 'GENERATED'],
    ['assets/data/samples.js', 'GENERATED'],
    ['docs/token-density.md', 'GENERATED FILE'],
    ['docs/reading-speed.md', 'GENERATED FILE'],
  ];
  for (const [file, marker] of generated) {
    const full = path.join(ROOT, file);
    if (!(await exists(full))) {
      fail(check, `${file} is missing — run \`npm run all\` in tools/`);
      continue;
    }
    const head = (await readFile(full, 'utf8')).slice(0, 200);
    if (!head.includes(marker)) fail(check, `${file} does not warn that it is generated`);
  }
  if (!failures.some((f) => f.startsWith(check))) ok(check);
}

/* ───────────────────────────────────────── 5. internal links resolve */

async function checkLinks() {
  const check = 'internal links resolve';
  const files = (await walk(ROOT)).filter((f) => f.endsWith('.md'));
  for (const file of files) {
    const source = await readFile(file, 'utf8');
    for (const [, target] of source.matchAll(/\]\(([^)\s]+)\)/g)) {
      if (/^(https?:|mailto:|#)/.test(target)) continue;
      const [cleanTarget] = target.split('#');
      if (!cleanTarget) continue;
      const resolved = path.resolve(path.dirname(file), cleanTarget);
      if (!(await exists(resolved))) fail(check, `${rel(file)} links to missing ${target}`);
    }
  }
  if (!failures.some((f) => f.startsWith(check))) ok(`${check} (${files.length} markdown files)`);
}

/* ────────────────────────── 6. no measurement is committed without a source */

async function checkSources() {
  const check = 'every shipped reading baseline is sourced';
  const sources = JSON.parse(await readFile(path.join(ROOT, 'data', 'reading-speed-sources.json'), 'utf8'));
  for (const [lang, spec] of Object.entries(sources.languages)) {
    if (!spec.available) {
      if (!spec.reason) fail(check, `${lang} is unavailable but gives no reason`);
      continue;
    }
    if (!spec.source?.citation) fail(check, `${lang} ships a rate with no citation`);
    if (!spec.source?.caveats?.length) fail(check, `${lang} ships a rate with no stated limits`);
  }
  if (!failures.some((f) => f.startsWith(check))) ok(check);
}

/* ─────────────────────── 7. every local asset the page names actually exists */

/**
 * A stylesheet or a social card that 404s is invisible in review and obvious to
 * a visitor. og:image is included because nothing else ever loads it: a broken
 * card only shows up as an empty box in someone else's chat client.
 */
async function checkLocalAssets() {
  const check = 'local assets referenced by the page exist';
  const html = await readFile(path.join(ROOT, 'index.html'), 'utf8');

  const referenced = [
    ...[...html.matchAll(/\s(?:src|href)\s*=\s*"([^"]*)"/g)].map((m) => m[1]),
    ...[...html.matchAll(/property="og:image"\s+content="([^"]*)"/g)].map((m) => m[1]),
  ];

  let checked = 0;
  for (const ref of referenced) {
    if (/^(https?:|data:|mailto:|#)/.test(ref) || !ref) continue;
    checked++;
    if (!(await exists(path.join(ROOT, ref.split(/[?#]/)[0])))) {
      fail(check, `index.html references missing ${ref}`);
    }
  }
  if (!failures.some((f) => f.startsWith(check))) ok(`${check} (${checked} references)`);
}

/* ──────────────────────────── 8. the deploy ships the site, and all of it */

/**
 * The site is the page plus the evidence the page cites. Two ways that stops
 * being true, both silent:
 *
 *   - something the page links to is left out of the upload. The deploy
 *     succeeds and the link 404s in production. This is not hypothetical: the
 *     footer links to docs/token-density.md, and the first version of
 *     .assetsignore excluded all of docs/.
 *   - something internal is swept in. An internal note sitting at a public URL
 *     is not a 404, so nothing would ever report it.
 *
 * So this computes the served set exactly and checks it from both ends, plus
 * that the Worker is still script-free and still advertises the origin it
 * deploys to (docs/BRIEF.md §5, §6-3).
 */

/** Top-level entries that ship even though no rule lists them. */
const SERVED_TOP_LEVEL = new Set([
  'index.html',   // the page
  'assets',       // its styles, scripts, data and vendored tokenizer
  '_headers',     // read by the platform, never served as a file
  'data',         // the sourced constants the measurements derive from
  'corpus',       // the manifest and the CC0 samples (cache/ is excluded)
  'docs',         // the two measurement documents (the rest is excluded)
  'LICENSE',      // MIT, for the code
  'LICENSES.md',  // CC BY 4.0 / CC0, for what the site actually distributes
]);

/** Paths that must never reach a public URL, whatever else changes. */
const MUST_NOT_SHIP = [
  'docs/BRIEF.md',
  'docs/screenshots',
  'CLAUDE.md',
  'AGENTS.md',
  'README.md',
  'tools',
  'tests',
  '.git',
  '.github',
  'corpus/cache',
  'wrangler.jsonc',
  '.assetsignore',
];

/** Enough of JSONC to read wrangler.jsonc: comments out, strings untouched. */
function stripJsonComments(text) {
  let out = '';
  let inString = false, inLine = false, inBlock = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i], next = text[i + 1];
    if (inLine) { if (c === '\n') { inLine = false; out += c; } continue; }
    if (inBlock) { if (c === '*' && next === '/') { inBlock = false; i++; } continue; }
    if (inString) {
      out += c;
      if (c === '\\') { out += next; i++; } else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') { inString = true; out += c; continue; }
    if (c === '/' && next === '/') { inLine = true; continue; }
    if (c === '/' && next === '*') { inBlock = true; i++; continue; }
    out += c;
  }
  return out;
}

/**
 * Relative link targets a reader can follow out of one file.
 *
 * Markdown links and HTML hrefs both count, and so do the hrefs inside the
 * i18n strings — the footer's links to the measurement documents live there,
 * not in index.html, which is exactly why nothing was checking them.
 */
function linkTargets(source) {
  return [
    ...[...source.matchAll(/\]\(([^)\s]+)\)/g)].map((m) => m[1]),
    ...[...source.matchAll(/\s(?:src|href)\s*=\s*["']([^"']+)["']/g)].map((m) => m[1]),
  ]
    .map((t) => t.split(/[?#]/)[0])
    .filter((t) => t && !/^(https?:|data:|mailto:|#)/.test(t));
}

async function checkDeployManifest() {
  const check = 'the deploy ships the site, and all of it';
  const configPath = path.join(ROOT, 'wrangler.jsonc');
  const ignorePath = path.join(ROOT, '.assetsignore');

  if (!(await exists(configPath)) || !(await exists(ignorePath))) {
    return fail(check, 'wrangler.jsonc and .assetsignore must both exist');
  }

  /* ── the Worker itself */

  let config;
  try {
    config = JSON.parse(stripJsonComments(await readFile(configPath, 'utf8')));
  } catch (err) {
    return fail(check, `wrangler.jsonc does not parse: ${err.message}`);
  }

  if ('main' in config) {
    fail(check, 'wrangler.jsonc declares a Worker script; this site serves static assets only (BRIEF §5)');
  }
  if (config.assets?.directory !== './') {
    fail(check, 'assets.directory must be "./" — .assetsignore is written against the repository root');
  }

  /* ── the rules, which must stay literal enough to compute a served set */

  const patterns = (await readFile(ignorePath, 'utf8'))
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));

  for (const pattern of patterns) {
    if (!pattern.startsWith('/')) {
      fail(check, `.assetsignore rule "${pattern}" is not anchored — write "/${pattern}". Unanchored, it also matches assets/${pattern}`);
    }
    if (/[*?[\]]/.test(pattern) || pattern.startsWith('!')) {
      fail(check, `.assetsignore rule "${pattern}" uses a glob or a negation; keep rules literal so the served set stays computable`);
    }
  }
  if (failures.some((f) => f.startsWith(check))) return;

  const excluded = patterns.map((p) => p.replace(/^\//, '').replace(/\/+$/, ''));
  const isServed = (relPath) =>
    !excluded.some((e) => relPath === e || relPath.startsWith(`${e}/`));

  /* ── nothing internal escapes */

  for (const secret of MUST_NOT_SHIP) {
    if (isServed(secret)) fail(check, `${secret} would be served at a public URL; add it to .assetsignore`);
  }

  /* ── no new top-level entry joins the upload unnoticed */

  for (const entry of await readdir(ROOT)) {
    if (SERVED_TOP_LEVEL.has(entry)) continue;
    if (!isServed(entry)) continue;
    fail(check, `${entry} would be uploaded; add it to .assetsignore, or to SERVED_TOP_LEVEL if the site really needs it`);
  }

  /* ── and everything the site links to is actually there */

  const html = await readFile(path.join(ROOT, 'index.html'), 'utf8');
  const canonical = html.match(/<link\s+rel="canonical"\s+href="([^"]*)"/)?.[1];
  const sources = [['index.html', html]];
  for (const file of await walk(path.join(ROOT, 'assets', 'js'))) {
    sources.push([rel(file), await readFile(file, 'utf8')]);
  }
  for (const doc of await walk(path.join(ROOT, 'docs'))) {
    if (doc.endsWith('.md') && isServed(rel(doc))) sources.push([rel(doc), await readFile(doc, 'utf8')]);
  }
  const corpusReadme = path.join(ROOT, 'corpus', 'README.md');
  if (isServed('corpus/README.md') && (await exists(corpusReadme))) {
    sources.push(['corpus/README.md', await readFile(corpusReadme, 'utf8')]);
  }

  const reachable = new Set(['index.html']);
  for (const [from, source] of sources) {
    for (const target of linkTargets(source)) {
      const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(from), target));
      if (resolved.startsWith('..')) continue;               // outside the repo, not ours
      reachable.add(resolved);
      if (!(await exists(path.join(ROOT, resolved)))) continue; // checkLinks reports missing files
      if (!isServed(resolved)) {
        fail(check, `${from} links to ${target}, which .assetsignore keeps out of the deploy — it would 404 in production`);
      }
    }
  }

  // docs/ holds both the measurement documents, which ship, and the project's
  // own paperwork, which must not. Nothing distinguishes them by name, so the
  // rule is reachability: a document the site links to belongs on the site, and
  // one nothing links to is either internal or dead. Either way it does not
  // ship silently.
  for (const doc of await walk(path.join(ROOT, 'docs'))) {
    const relative = rel(doc);
    if (!isServed(relative) || reachable.has(relative)) continue;
    fail(check, `${relative} would be served but nothing links to it; add it to .assetsignore, or link it from the page`);
  }

  /* ── the page advertises the origin it deploys to */

  const route = (config.routes ?? []).find((r) => r.custom_domain)?.pattern;
  if (canonical && route) {
    const origin = `https://${route}/`;
    if (!canonical.startsWith(origin)) {
      fail(check, `index.html says canonical ${canonical} but wrangler.jsonc deploys to ${route}`);
    }
    for (const [, value] of html.matchAll(/property="og:(?:url|image)"\s+content="([^"]*)"/g)) {
      if (!value.startsWith(origin)) fail(check, `og tag points at ${value}, outside the deployed origin ${origin}`);
      const asset = value.slice(origin.length);
      if (asset && !(await exists(path.join(ROOT, asset)))) fail(check, `og tag points at missing ${asset}`);
      if (asset && !isServed(asset)) fail(check, `og tag points at ${asset}, which is not deployed`);
    }
  }

  if (!failures.some((f) => f.startsWith(check))) ok(check);
}

/* ──────────────────────────────────────────────────────────────────── run */

console.log('Checking project invariants...\n');
await checkNoExternalRequests();
await checkCsp();
await checkVendor();
await checkGeneratedMarkers();
await checkLinks();
await checkSources();
await checkLocalAssets();
await checkDeployManifest();

if (failures.length) {
  console.error(`\n${failures.length} problem(s):`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log('\nAll invariants hold.');
