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

  for (const [, attr, value] of html.matchAll(/\s(src|href)\s*=\s*"([^"]*)"/g)) {
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

/* ───────────────────────────────────── 8. the deploy ships the site only */

/**
 * The deployed site is index.html plus assets/. Everything else here exists to
 * make the numbers checkable, and it is checkable in the repository — uploading
 * it would publish files with no reader and no route into the page.
 *
 * Two ways that quietly stops being true: a new top-level entry joins the
 * upload because nobody thought about it, or an ignore rule grows until it
 * swallows something the page loads. This checks both directions, and that the
 * Worker is still script-free (docs/BRIEF.md §5).
 */
const SITE_ENTRIES = new Set(['index.html', 'assets', '_headers']);

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
 * The subset of .gitignore syntax .assetsignore is allowed to use: a
 * root-anchored name, or a root-anchored `*.ext` glob. Nothing else.
 *
 * The anchor is not a style preference. A .gitignore rule without a leading
 * slash matches at every depth, so `data/` also hides `assets/data/`, which is
 * where the page reads its density figures from. Wrangler reports no error for
 * that — the file is simply absent and the page 404s at runtime (measured
 * against workerd, 2026-09-02). checkDeployManifest therefore rejects an
 * unanchored rule outright instead of reasoning about what it might match.
 */
function ignoreMatches(pattern, name) {
  const p = pattern.replace(/^\//, '').replace(/\/+$/, '');
  if (p === name) return true;
  if (p.startsWith('*.')) return name.endsWith(p.slice(1));
  return false;
}

async function checkDeployManifest() {
  const check = 'the deploy ships the site and nothing else';
  const configPath = path.join(ROOT, 'wrangler.jsonc');
  const ignorePath = path.join(ROOT, '.assetsignore');

  if (!(await exists(configPath)) || !(await exists(ignorePath))) {
    return fail(check, 'wrangler.jsonc and .assetsignore must both exist');
  }

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

  const patterns = (await readFile(ignorePath, 'utf8'))
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));

  for (const pattern of patterns) {
    if (!pattern.startsWith('/')) {
      fail(check, `.assetsignore rule "${pattern}" is not anchored — write "/${pattern}". Unanchored, it also hides assets/${pattern}`);
    }
  }

  for (const entry of await readdir(ROOT)) {
    const rule = patterns.find((p) => ignoreMatches(p, entry));
    if (SITE_ENTRIES.has(entry)) {
      if (rule) fail(check, `.assetsignore rule "${rule}" excludes ${entry}, which the site needs`);
    } else if (!rule) {
      fail(check, `${entry} would be uploaded; add it to .assetsignore or to the site itself`);
    }
  }

  if (!failures.some((f) => f.startsWith(check))) ok(check);
}

/*
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
