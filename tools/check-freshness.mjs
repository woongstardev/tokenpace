#!/usr/bin/env node
/**
 * check-freshness.mjs — ask whether the published table is still current.
 *
 *   node tools/check-freshness.mjs
 *
 * The rest of the harness proves the numbers are *reproducible*. Reproducible
 * is not the same as current: a table that regenerates perfectly can still be
 * describing tokenizers nobody runs any more, and every check in this
 * repository would stay green while that happened.
 *
 * Two kinds of decay, and only one of them is detectable by a machine.
 *
 *   Drift  — a tokenizer this project measures changes upstream. Detectable,
 *            and detected here: each Hub entry is pinned to a commit, and this
 *            compares the tokenizer files at that commit against the ones at
 *            the branch head. It compares git object ids from the Hub API
 *            rather than downloading, so a repository owner editing a README
 *            does not raise a false alarm — only the tokenizer moving does.
 *
 *   Staleness — the roster stops representing what people use, because models
 *            shipped that are not on it. **Not detectable here.** No amount of
 *            checking tells this script that a new model family exists. What
 *            it can do is refuse to let the age go unnoticed, so the question
 *            gets asked by a person on a schedule instead of never.
 *
 * Runs in the weekly job rather than on every push: it needs the network, and
 * a contributor's pull request should not fail because time passed.
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { REPO_ROOT, TOKENIZERS } from './corpus-config.mjs';

/** Past this, the roster is reviewed before the table is quoted as current. */
const STALE_AFTER_DAYS = 365;
/** Past this, say so, but do not fail — it is a nudge, not a verdict. */
const REVIEW_AFTER_DAYS = 180;

const problems = [];
const notes = [];

async function hubTree(repo, ref) {
  const res = await fetch(`https://huggingface.co/api/models/${repo}/tree/${ref}`);
  if (!res.ok) throw new Error(`${repo}@${ref}: HTTP ${res.status}`);
  const entries = await res.json();
  return Object.fromEntries(
    entries.filter((e) => e.path.startsWith('tokenizer')).map((e) => [e.path, e.oid])
  );
}

async function checkPins() {
  for (const spec of TOKENIZERS.filter((t) => t.kind === 'hf')) {
    let pinned, head;
    try {
      [pinned, head] = await Promise.all([hubTree(spec.repo, spec.revision), hubTree(spec.repo, 'main')]);
    } catch (err) {
      problems.push(`${spec.id}: could not read ${spec.repo} from the Hub — ${err.message}`);
      continue;
    }

    const paths = new Set([...Object.keys(pinned), ...Object.keys(head)]);
    const moved = [...paths].filter((f) => pinned[f] !== head[f]);
    if (moved.length === 0) {
      console.log(`  ok   ${spec.id.padEnd(14)} ${spec.repo} — pinned files match the branch head`);
      continue;
    }
    problems.push(
      `${spec.id}: ${spec.repo} changed upstream (${moved.join(', ')}). ` +
        `The published figures were measured at ${spec.revision}. Re-pin and re-run to see whether they move, ` +
        `or record why the old pin stands.`
    );
  }
}

async function checkAge() {
  const density = JSON.parse(await readFile(path.join(REPO_ROOT, 'data', 'token-density.json'), 'utf8'));
  const days = Math.floor((Date.now() - Date.parse(`${density.measuredAt}T00:00:00Z`)) / 86_400_000);
  const roster = TOKENIZERS.map((t) => t.label).join(', ');

  if (days >= STALE_AFTER_DAYS) {
    problems.push(
      `the published measurement is ${days} days old (${density.measuredAt}). The roster is ${roster}. ` +
        `Nothing here can tell you whether that is still the set a reader is choosing between — go and look, ` +
        `then either re-measure or move the date forward deliberately. See tools/corpus-config.mjs for what earns a place.`
    );
  } else if (days >= REVIEW_AFTER_DAYS) {
    notes.push(`the published measurement is ${days} days old (${density.measuredAt}); worth reviewing the roster before it turns ${STALE_AFTER_DAYS}.`);
  } else {
    console.log(`  ok   measured ${days} days ago (${density.measuredAt})`);
  }
}

console.log('Checking whether the published table is still current...\n');
await checkPins();
await checkAge();

for (const note of notes) console.log(`  note ${note}`);
if (problems.length) {
  console.error(`\n${problems.length} thing(s) to look at:`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log('\nStill current.');
