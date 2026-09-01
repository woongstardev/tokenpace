#!/usr/bin/env node
/**
 * fetch-corpus.mjs — download and sample the parallel corpora used to measure
 * token density.
 *
 * We do NOT commit the corpus text. TED2020 derives from TED talk transcripts
 * (CC BY-NC-ND 4.0), which we may read and measure but should not redistribute.
 * What we commit instead is this script, the sha256 of each archive, and the
 * measurement output — which is enough for anyone to reproduce the numbers.
 *
 *   node fetch-corpus.mjs            # download + sample into corpus/cache/
 *   node fetch-corpus.mjs --verify   # re-check checksums, download nothing new
 *
 * Sampling is deterministic (fixed stride, no RNG) so two runs on the same
 * archive produce byte-identical sample files.
 */

import { createWriteStream } from 'node:fs';
import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';
import { unzipSync, strFromU8 } from 'fflate';

import { REPO_ROOT, CACHE_DIR, PARALLEL_SETS, SAMPLE_SIZE } from './corpus-config.mjs';

const VERIFY_ONLY = process.argv.includes('--verify');

async function sha256(file) {
  const h = createHash('sha256');
  h.update(await readFile(file));
  return h.digest('hex');
}

async function exists(p) {
  try { await stat(p); return true; } catch { return false; }
}

async function download(url, dest) {
  process.stdout.write(`  downloading ${url}\n`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  await pipeline(Readable.fromWeb(res.body), createWriteStream(dest));
}

/**
 * Pick pairs that are usable as reading material: both sides present, and the
 * English side long enough to be a real sentence but short enough that one bad
 * segment cannot dominate the totals.
 */
function usablePair(a, b) {
  const en = a.trim();
  const other = b.trim();
  if (!en || !other) return false;
  if (en.length < 40 || en.length > 400) return false;
  if (other.length < 8) return false;
  return true;
}

async function buildSet(set) {
  const archive = path.join(CACHE_DIR, `${set.id}.zip`);

  if (!(await exists(archive))) {
    if (VERIFY_ONLY) {
      console.log(`  ${set.id}: MISSING (run without --verify to download)`);
      return null;
    }
    await download(set.url, archive);
  }

  const digest = await sha256(archive);
  const known = set.sha256;
  if (known && known !== digest) {
    throw new Error(
      `checksum mismatch for ${set.id}\n  expected ${known}\n  actual   ${digest}\n` +
      `The upstream archive changed. Re-measure before trusting old numbers.`
    );
  }

  if (VERIFY_ONLY) {
    console.log(`  ${set.id}: sha256 ${digest}${known ? ' (matches)' : ' (unrecorded)'}`);
    return { id: set.id, sha256: digest };
  }

  const zip = unzipSync(await readFile(archive));
  const pick = (suffix) => {
    const name = Object.keys(zip).find((n) => n.endsWith(suffix));
    if (!name) throw new Error(`${set.id}: no member ending in ${suffix}`);
    return strFromU8(zip[name]).split('\n');
  };

  const enLines = pick(`.${set.enSide}`);
  const otherLines = pick(`.${set.otherSide}`);
  const n = Math.min(enLines.length, otherLines.length);

  const pairs = [];
  for (let i = 0; i < n; i++) {
    if (usablePair(enLines[i], otherLines[i])) pairs.push([enLines[i].trim(), otherLines[i].trim()]);
  }

  // Deterministic stride sample — spreads the sample across the whole corpus
  // instead of taking a contiguous (topic-correlated) head.
  const stride = Math.max(1, Math.floor(pairs.length / SAMPLE_SIZE));
  const sampled = [];
  for (let i = 0; i < pairs.length && sampled.length < SAMPLE_SIZE; i += stride) sampled.push(pairs[i]);

  const outDir = path.join(CACHE_DIR, 'sampled');
  await mkdir(outDir, { recursive: true });
  await writeFile(path.join(outDir, `${set.id}.en.txt`), sampled.map((p) => p[0]).join('\n') + '\n');
  await writeFile(path.join(outDir, `${set.id}.${set.lang}.txt`), sampled.map((p) => p[1]).join('\n') + '\n');

  console.log(
    `  ${set.id}: ${pairs.length.toLocaleString()} usable pairs -> sampled ${sampled.length} (stride ${stride})`
  );
  return { id: set.id, sha256: digest, usablePairs: pairs.length, sampled: sampled.length, stride };
}

async function main() {
  await mkdir(CACHE_DIR, { recursive: true });
  console.log(VERIFY_ONLY ? 'Verifying corpus archives...' : 'Fetching corpora...');

  const results = [];
  for (const set of PARALLEL_SETS) {
    results.push(await buildSet(set));
  }

  if (!VERIFY_ONLY) {
    const manifest = {
      generatedBy: 'tools/fetch-corpus.mjs',
      sampleSize: SAMPLE_SIZE,
      sets: results.filter(Boolean),
    };
    await writeFile(
      path.join(REPO_ROOT, 'corpus', 'CHECKSUMS.json'),
      JSON.stringify(manifest, null, 2) + '\n'
    );
    console.log('\nWrote corpus/CHECKSUMS.json');
    console.log('Next: node measure-density.mjs');
  }
}

main().catch((err) => {
  console.error(`\nfetch-corpus failed: ${err.message}`);
  process.exit(1);
});
