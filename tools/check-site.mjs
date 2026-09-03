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
  'CITATION.cff', // how to cite the measurements the site distributes
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
  // workers_dev must stay off. Turning it on without a registered account-level
  // workers.dev subdomain does not fail loudly: `wrangler deploy` uploads every
  // asset, then aborts on the workers.dev step *before* binding the custom
  // domain, leaving a Worker that exists and answers on no address at all. The
  // error reads like a permissions problem and is not one. It cost one broken
  // deploy on 2026-09-02; this line is why it cannot cost a second.
  if (config.workers_dev !== false) {
    fail(check, 'wrangler.jsonc must set "workers_dev": false — publishing there needs a permanent account subdomain, and enabling it aborts the deploy before the custom domain is bound');
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

/* ──────────────────────────────────── 9. the one number nobody measured */

/**
 * The TTFT slider needs a starting position, and no source or script produced
 * one — TTFT is a property of a deployment, not of a model, so no constant
 * could be right for most readers. That is a defensible gap. What is not
 * defensible is the gap being invisible, which is what it was: the value sat
 * in url-state.js as a bare literal, indistinguishable from the measured
 * constants beside it.
 *
 * So the number is allowed to exist on one condition — that it stays tied to
 * the file admitting it is a setting, and that the page keeps saying so.
 */
async function checkUnmeasuredDefault() {
  const check = 'the unmeasured default admits it';
  const record = JSON.parse(await readFile(path.join(ROOT, 'data', 'ttft-sources.json'), 'utf8'));

  const declared = record.sliderDefault?.seconds;
  if (typeof declared !== 'number') return fail(check, 'data/ttft-sources.json declares no sliderDefault.seconds');
  if (record.representativeValue?.available !== false) {
    fail(check, 'data/ttft-sources.json now claims a representative TTFT; it needs a source and a caveat list like the reading baselines, and this check needs rewriting');
  }
  if (!record.sliderDefault?.why) fail(check, 'the slider default gives no reason for its value');

  const state = await readFile(path.join(ROOT, 'assets', 'js', 'url-state.js'), 'utf8');
  const literal = state.match(/^\s*ttft:\s*([0-9.]+)\s*,/m)?.[1];
  if (literal === undefined) return fail(check, 'could not find the ttft default in url-state.js');
  if (Number(literal) !== declared) {
    fail(check, `url-state.js defaults ttft to ${literal}, data/ttft-sources.json says ${declared}`);
  }

  // The page has to carry the admission, in both languages, or the record is
  // just a file nobody visiting the site will ever open.
  const i18n = await readFile(path.join(ROOT, 'assets', 'js', 'i18n.js'), 'utf8');
  const admissions = [...i18n.matchAll(/^\s*hintTtftUnmeasured:/gm)].length;
  if (admissions < 2) fail(check, `hintTtftUnmeasured is defined ${admissions} time(s); every language needs it`);

  const html = await readFile(path.join(ROOT, 'index.html'), 'utf8');
  if (!html.includes('data-i18n="hintTtftUnmeasured"')) {
    fail(check, 'index.html no longer shows the note saying the TTFT default is not measured');
  }
  if (!html.includes('href="data/ttft-sources.json"')) {
    fail(check, 'index.html no longer links to data/ttft-sources.json, so the reasoning is unreachable from the page');
  }

  if (!failures.some((f) => f.startsWith(check))) ok(check);
}

/* ─────────────────────────────── 10. the bilingual documents point straight */

/**
 * The measurement documents are served as text/plain, because text/markdown
 * makes a browser download them instead of showing them. That is the right
 * trade, and it has one cost: markdown anchors are dead in plain text. The
 * "English ↓" link at the top of each file tells a reader nothing about
 * whether the English half is ten lines down or two hundred.
 *
 * So each document carries a line number instead, written at generation time.
 * A line number is exactly the kind of fact that rots the moment anyone adds a
 * paragraph, and rots silently — so it is checked rather than trusted.
 */
async function checkLanguagePointers() {
  const check = 'each bilingual document points at its other half';
  const docs = [
    ['docs/reading-speed.md', '# Reading speed, in tok/s'],
    ['docs/token-density.md', '# Token density, measured'],
  ];

  for (const [rel, heading] of docs) {
    const lines = (await readFile(path.join(ROOT, rel), 'utf8')).split('\n');
    const claimed = lines.find((l) => /행부터입니다/.test(l))?.match(/(\d+)행부터/)?.[1];
    if (!claimed) {
      fail(check, `${rel} has no pointer to its English half`);
      continue;
    }
    const actual = lines.findIndex((l) => l.startsWith(heading)) + 1;
    if (!actual) {
      fail(check, `${rel} has no "${heading}" heading`);
    } else if (Number(claimed) !== actual) {
      fail(check, `${rel} says the English half starts at line ${claimed}; it starts at ${actual}`);
    }
  }

  if (!failures.some((f) => f.startsWith(check))) ok(check);
}

/* ───────────────────────────────────────────────── 11. the citation file */

/**
 * Being cited is this project's stated goal, so the citation metadata is a
 * product surface, not paperwork. What makes it rot is that nothing reads it:
 * the site can be renamed, moved to another origin or re-licensed and
 * CITATION.cff would go on describing the old one, silently, to exactly the
 * people who took the trouble to cite properly.
 *
 * This does not parse YAML — the repository installs nothing to run its own
 * checks — it reads the few top-level scalars that have to agree with
 * something else in the tree, which is all that can drift.
 */
async function checkCitation() {
  const check = 'the citation file describes this project';
  const file = path.join(ROOT, 'CITATION.cff');
  if (!(await exists(file))) return fail(check, 'CITATION.cff is missing');
  const text = await readFile(file, 'utf8');

  const scalar = (key) =>
    text.match(new RegExp(`^${key}:[ \\t]*(.+?)[ \\t]*$`, 'm'))?.[1];

  if (scalar('cff-version') !== '1.2.0') {
    fail(check, `cff-version must be 1.2.0, found ${scalar('cff-version') ?? 'nothing'}`);
  }
  if (scalar('title') !== 'tokenpace') {
    fail(check, `title must be the project name, found ${scalar('title') ?? 'nothing'}`);
  }

  // The url must be the origin the site actually deploys to. index.html's
  // canonical is already tied to wrangler.jsonc by checkDeployManifest, so
  // agreeing with canonical means agreeing with the deploy.
  const html = await readFile(path.join(ROOT, 'index.html'), 'utf8');
  const canonical = html.match(/<link\s+rel="canonical"\s+href="([^"]*)"/)?.[1];
  const url = scalar('url');
  if (canonical && url !== canonical) {
    fail(check, `url is ${url}, but the page's canonical is ${canonical}`);
  }

  // CC BY 4.0 is the licence on data/ and docs/ — the measurements, which are
  // the thing this file exists to get cited. If LICENSES.md ever moves them to
  // something else, this has to move with it.
  const licenses = await readFile(path.join(ROOT, 'LICENSES.md'), 'utf8');
  const license = scalar('license');
  if (license !== 'CC-BY-4.0') {
    fail(check, `license should be CC-BY-4.0, the licence on the measurements; found ${license ?? 'nothing'}`);
  } else if (!licenses.includes('CC BY 4.0')) {
    fail(check, 'CITATION.cff claims CC-BY-4.0 but LICENSES.md no longer mentions CC BY 4.0');
  }

  // A DOI is optional — there is not one yet — but a malformed one would be
  // worse than none, because it is the field people paste without looking.
  const doi = scalar('doi');
  if (doi !== undefined && !/^10\.\d{4,9}\/\S+$/.test(doi)) {
    fail(check, `doi is not a DOI: ${doi}`);
  } else if (doi !== undefined) {
    // The whole point of having one is that a reader lands on it. The
    // measurement documents generate their citation from this file, so they
    // cannot disagree about the string — but they can stop printing it, and
    // nothing else would notice.
    for (const rel of ['docs/reading-speed.md', 'docs/token-density.md']) {
      const text = await readFile(path.join(ROOT, rel), 'utf8');
      const hits = text.split(doi).length - 1;
      if (hits < 2) fail(check, `${rel} cites the DOI ${hits} time(s); both language halves need it`);
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
await checkUnmeasuredDefault();
await checkLanguagePointers();
await checkCitation();

if (failures.length) {
  console.error(`\n${failures.length} problem(s):`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log('\nAll invariants hold.');
