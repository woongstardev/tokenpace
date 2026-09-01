#!/usr/bin/env node
/**
 * vendor-tokenizer.mjs — copy the exact-tokenizer code into assets/vendor/.
 *
 *   node vendor-tokenizer.mjs            # show what would change
 *   node vendor-tokenizer.mjs --apply    # actually write it
 *
 * The site makes zero external requests, so the tokenizer has to live in the
 * repo rather than being pulled from a CDN at runtime. This walks the import
 * graph from one entry point and copies only the files it actually reaches —
 * about a fifth of the package, and none of the type definitions or sourcemaps.
 *
 * Default is dry-run on purpose. This lands ~2.4 MB of generated data in the
 * repo; that should never happen as a silent side effect of installing deps.
 */

import { readFile, writeFile, mkdir, stat, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

import { REPO_ROOT } from './corpus-config.mjs';

const PACKAGE_ROOT = path.join(REPO_ROOT, 'tools', 'node_modules', 'gpt-tokenizer');
const SRC_ROOT = path.join(PACKAGE_ROOT, 'esm');
const VENDOR_ROOT = path.join(REPO_ROOT, 'assets', 'vendor', 'gpt-tokenizer');

/** Only o200k_base ships. It is the tokenizer behind the current GPT models and
 *  the one the site defaults to; the others stay on measured coefficients until
 *  there is a reason to pay another megabyte. */
const ENTRY = 'encoding/o200k_base.js';

const APPLY = process.argv.includes('--apply');

const IMPORT_RE = /(?:^|\n)\s*(?:import|export)[\s\S]*?from\s*["'](\.[^"']+)["']/g;

async function collect(entry, seen = new Set()) {
  if (seen.has(entry)) return seen;
  seen.add(entry);
  const source = await readFile(path.join(SRC_ROOT, entry), 'utf8');
  for (const match of source.matchAll(IMPORT_RE)) {
    const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(entry), match[1]));
    await collect(resolved, seen);
  }
  return seen;
}

async function main() {
  try {
    await stat(SRC_ROOT);
  } catch {
    throw new Error(`gpt-tokenizer not installed. Run \`npm ci\` in tools/ first.`);
  }

  const pkg = JSON.parse(await readFile(path.join(PACKAGE_ROOT, 'package.json'), 'utf8'));
  const files = [...(await collect(ENTRY))].sort();

  let total = 0;
  let gzipped = 0;
  const contents = new Map();
  for (const f of files) {
    // Strip the sourcemap comment; the .map files are not vendored.
    const body = (await readFile(path.join(SRC_ROOT, f), 'utf8')).replace(/\n\/\/# sourceMappingURL=.*\n?$/, '\n');
    contents.set(f, body);
    total += Buffer.byteLength(body);
    gzipped += gzipSync(body).length;
  }

  console.log(`gpt-tokenizer@${pkg.version} (${pkg.license})`);
  console.log(`entry: ${ENTRY}`);
  console.log(`${files.length} files, ${(total / 1024 / 1024).toFixed(2)} MB raw, ${(gzipped / 1024).toFixed(0)} KB gzipped\n`);
  for (const f of files) console.log(`  ${f}`);

  if (!APPLY) {
    console.log('\nDry run. Re-run with --apply to write assets/vendor/gpt-tokenizer/.');
    return;
  }

  await rm(VENDOR_ROOT, { recursive: true, force: true });
  for (const [f, body] of contents) {
    const dest = path.join(VENDOR_ROOT, f);
    await mkdir(path.dirname(dest), { recursive: true });
    await writeFile(dest, body);
  }

  const manifest = {
    package: 'gpt-tokenizer',
    version: pkg.version,
    license: pkg.license,
    homepage: pkg.homepage ?? 'https://github.com/niieani/gpt-tokenizer',
    entry: ENTRY,
    vendoredBy: 'tools/vendor-tokenizer.mjs',
    files: files.map((f) => ({
      path: f,
      sha256: createHash('sha256').update(contents.get(f)).digest('hex').slice(0, 16),
    })),
  };
  await writeFile(path.join(VENDOR_ROOT, 'VENDOR.json'), JSON.stringify(manifest, null, 2) + '\n');
  await writeFile(path.join(VENDOR_ROOT, 'LICENSE'), await readFile(path.join(PACKAGE_ROOT, 'LICENSE'), 'utf8'));

  console.log(`\nWrote ${VENDOR_ROOT}`);
}

main().catch((err) => {
  console.error(`\nvendor-tokenizer failed: ${err.message}`);
  process.exit(1);
});
