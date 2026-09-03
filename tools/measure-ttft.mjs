#!/usr/bin/env node
/**
 * measure-ttft.mjs — measure time to first token on one named configuration.
 *
 *   node tools/measure-ttft.mjs --model <ollama model> [--runs 5]
 *
 * This is the odd one out in tools/. Every other script here produces a figure
 * CI can re-derive from committed inputs; this one produces a figure that
 * belongs to a machine. It cannot run in CI, and its output is **reported, not
 * reproduced**. That is written into the JSON it emits so a reader never has to
 * infer it.
 *
 * Why bother, given the rest of the repository's standards: the project's
 * conclusion is that past reading speed the remaining felt variable is TTFT,
 * and it shipped without ever having measured one. A figure with its
 * configuration named and its limits stated is worth more than a gap, as long
 * as it is never presented as a typical value. TTFT belongs to a deployment —
 * see data/ttft-sources.json for why no typical value exists.
 *
 * What it controls for:
 *
 *   Prompt length   — prefill is roughly linear in it, so a TTFT quoted
 *                     without one says nothing. Four buckets, and the x-axis
 *                     is the token count Ollama itself reports rather than
 *                     one this repo guessed with a different tokenizer.
 *   Prefix cache    — every prompt is unique (a per-run nonce plus a seeded
 *                     shuffle), because a cache hit measures the cache.
 *   Model reloads   — Ollama reports load_duration per request. Any run that
 *                     reloaded the model is a measurement of the reload, so it
 *                     is discarded and the count of discards is published.
 *   Cold start      — measured separately and deliberately, by unloading
 *                     first. On consumer hardware this dominates everything
 *                     else, which is the point.
 *
 * Prompt text comes from corpus/samples/ (CC0, written for this project), so
 * the input is committed and carries no licence question.
 */

import { readFile, readdir, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';

import { REPO_ROOT, SAMPLES_DIR } from './corpus-config.mjs';

const run = promisify(execFile);

const HOST = process.env.OLLAMA_HOST || 'http://localhost:11434';
const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};

const MODEL = arg('model');
const RUNS = Number(arg('runs', 5));
const COLD_RUNS = Number(arg('cold-runs', 3));

/** Prompt sizes in characters, chosen to land near 128 / 1k / 4k / 8k tokens. */
const TARGET_CHARS = [600, 4500, 18000, 36000];

/** A reload costs seconds; a warm request reports single-digit milliseconds.
 *  Anything above this had the model loaded underneath it. */
const RELOAD_MS = 500;

if (!MODEL) {
  console.error('usage: node tools/measure-ttft.mjs --model <ollama model> [--runs 5]');
  process.exit(2);
}

/* ------------------------------------------------------------------ inputs */

/** Deterministic PRNG, so two people running this build the same prompts. */
function mulberry32(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function loadSentences() {
  const files = (await readdir(SAMPLES_DIR)).filter((f) => f.endsWith('.txt'));
  const out = [];
  for (const f of files.sort()) {
    const text = await readFile(path.join(SAMPLES_DIR, f), 'utf8');
    for (const line of text.split('\n')) {
      const t = line.trim();
      if (t) out.push(t);
    }
  }
  return out;
}

/**
 * A prompt of roughly `chars` characters, unique to this run.
 *
 * The nonce goes first on purpose: llama.cpp caches by common prefix, so a
 * shared opening would let later runs skip prefill and report a TTFT that is
 * really a cache lookup.
 */
function buildPrompt(sentences, chars, seed) {
  const rand = mulberry32(seed);
  const parts = [`[run ${seed}]`];
  let n = parts[0].length;
  while (n < chars) {
    const s = sentences[Math.floor(rand() * sentences.length)];
    parts.push(s);
    n += s.length + 1;
  }
  return parts.join(' ');
}

/* --------------------------------------------------------------- measuring */

/**
 * One request. Returns wall-clock time to the first token — what a person
 * actually waits — alongside the server's own accounting of where it went.
 */
async function timeOne(prompt, { keepAlive = -1 } = {}) {
  const started = performance.now();
  const res = await fetch(`${HOST}/api/generate`, {
    method: 'POST',
    body: JSON.stringify({
      model: MODEL,
      prompt,
      stream: true,
      keep_alive: keepAlive,
      // Thinking models emit a reasoning block before any visible text. Left
      // on, "first token" would mean something different per model, and a
      // small num_predict can leave the request waiting for a block that
      // never closes.
      think: false,
      options: { num_predict: 4, temperature: 0 },
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${await res.text()}`);

  let ttftMs = null;
  let final = null;
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i);
      buf = buf.slice(i + 1);
      if (!line.trim()) continue;
      const chunk = JSON.parse(line);
      if (ttftMs === null && chunk.response) ttftMs = performance.now() - started;
      if (chunk.done) final = chunk;
    }
  }
  if (!final) throw new Error('stream ended without a final message');

  return {
    ttftMs: Number(ttftMs?.toFixed(1)),
    loadMs: Number((final.load_duration / 1e6).toFixed(1)),
    promptTokens: final.prompt_eval_count,
    prefillMs: Number((final.prompt_eval_duration / 1e6).toFixed(1)),
  };
}

/** Ask Ollama to drop the model, so the next request pays a cold start. */
async function unload() {
  await fetch(`${HOST}/api/generate`, {
    method: 'POST',
    body: JSON.stringify({ model: MODEL, keep_alive: 0 }),
  });
  // The runner exits asynchronously; give it room before asking for it back.
  await new Promise((r) => setTimeout(r, 3000));
}

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const summarise = (xs) => ({
  n: xs.length,
  medianMs: Number(median(xs).toFixed(1)),
  minMs: Number(Math.min(...xs).toFixed(1)),
  maxMs: Number(Math.max(...xs).toFixed(1)),
});

/* -------------------------------------------------------------- provenance */

async function describeMachine() {
  const machine = {};
  try {
    const { stdout } = await run('nvidia-smi', [
      '--query-gpu=name,memory.total,driver_version',
      '--format=csv,noheader',
    ]);
    const [name, memory, driver] = stdout.trim().split(', ');
    machine.accelerator = name;
    machine.acceleratorMemory = memory;
    machine.driver = driver;
  } catch {
    machine.accelerator = 'unknown (nvidia-smi unavailable)';
  }
  try {
    machine.runtime = `ollama ${(await (await fetch(`${HOST}/api/version`)).json()).version}`;
  } catch {
    machine.runtime = 'ollama (version unavailable)';
  }
  try {
    const show = await (
      await fetch(`${HOST}/api/show`, { method: 'POST', body: JSON.stringify({ model: MODEL }) })
    ).json();
    machine.parameters = show.details?.parameter_size;
    machine.quantisation = show.details?.quantization_level;
    machine.contextLength =
      show.model_info?.['general.context_length'] ??
      show.model_info?.[`${show.details?.family}.context_length`];
  } catch {
    /* metadata is a nicety; the measurement is not */
  }
  return machine;
}

/* --------------------------------------------------------------------- run */

async function main() {
  console.log(`Measuring TTFT — ${MODEL}\n`);
  const sentences = await loadSentences();
  const machine = await describeMachine();
  for (const [k, v] of Object.entries(machine)) console.log(`  ${k.padEnd(18)} ${v}`);
  console.log();

  // Warm the model so the first bucket is not measuring a load.
  await timeOne('warmup');

  const byLength = [];
  for (const chars of TARGET_CHARS) {
    const kept = [];
    const discarded = [];
    let tokens = null;
    let prefill = [];

    for (let i = 0; i < RUNS; i++) {
      const prompt = buildPrompt(sentences, chars, chars * 1000 + i);
      const r = await timeOne(prompt);
      tokens ??= r.promptTokens;
      if (r.loadMs > RELOAD_MS) {
        discarded.push(r);
        continue;
      }
      kept.push(r.ttftMs);
      prefill.push(r.prefillMs);
    }

    if (!kept.length) {
      console.log(`  ${String(tokens).padStart(6)} tok   all ${RUNS} runs reloaded the model — no clean sample`);
      byLength.push({ promptTokens: tokens, warm: null, discardedForReload: discarded.length });
      continue;
    }

    const s = summarise(kept);
    byLength.push({
      promptTokens: tokens,
      warm: s,
      prefillMedianMs: Number(median(prefill).toFixed(1)),
      discardedForReload: discarded.length,
    });
    console.log(
      `  ${String(tokens).padStart(6)} tok   median ${String(s.medianMs).padStart(8)} ms` +
        `   (${s.minMs}–${s.maxMs}, n=${s.n}${discarded.length ? `, ${discarded.length} discarded` : ''})`
    );
  }

  // Cold start: the model is not resident and has to be read from disk first.
  console.log();
  const cold = [];
  for (let i = 0; i < COLD_RUNS; i++) {
    await unload();
    const r = await timeOne(buildPrompt(sentences, TARGET_CHARS[0], 900000 + i));
    cold.push(r.ttftMs);
    console.log(`  cold start    ${String(r.ttftMs).padStart(8)} ms   (of which load ${r.loadMs} ms)`);
  }

  const out = {
    $comment: [
      'TTFT measured on one machine. REPORTED, NOT REPRODUCED — unlike every',
      'other figure in data/, CI cannot re-derive this, and a different machine',
      'will get different numbers. That is the point: TTFT is a property of a',
      'deployment. See data/ttft-sources.json.',
      '',
      'Re-run: node tools/measure-ttft.mjs --model <model>',
    ],
    measuredAt: new Date().toISOString().slice(0, 10),
    reproducedByCI: false,
    configurations: [
      {
        id: 'rtx3090-qwen3-27b-q4',
        model: MODEL,
        ...machine,
        method: {
          note: 'Wall-clock from request to first streamed token, which is what a person waits.',
          promptSource: 'corpus/samples/ (CC0), seeded shuffle, unique nonce per run to defeat the prefix cache',
          runsPerLength: RUNS,
          thinking: 'disabled, so "first token" means the same thing across models',
          discardRule: `runs reporting load_duration > ${RELOAD_MS} ms had the model reloaded underneath them and are excluded`,
        },
        byPromptLength: byLength,
        coldStart: cold.length ? { ...summarise(cold), note: 'model not resident; includes reading weights from disk' } : null,
      },
    ],
  };

  const target = path.join(REPO_ROOT, 'data', 'ttft-hardware.json');
  await writeFile(target, JSON.stringify(out, null, 2) + '\n');
  console.log(`\nWrote data/ttft-hardware.json`);

  // Leave the model resident and pinned, which is how this script found it.
  await timeOne('warmup', { keepAlive: -1 });
}

main().catch((err) => {
  console.error(`\nmeasure-ttft failed: ${err.message}`);
  process.exit(1);
});
