/**
 * Tests for the pure logic the page depends on.
 *
 *   node --test tests/
 *
 * No DOM, no browser, no test framework — the interesting parts of this site
 * are arithmetic and string handling, and those are the parts that have
 * actually been wrong. Both the token-splitting and the approximation tests
 * below were written after they caught a real bug.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { tokensDueAt, finishTime, snapshotTimes, StreamClock } from '../assets/js/engine.js';
import { tokenPieces, approximatePieces } from '../assets/js/token-pieces.js';
import { readState, toSearch, DEFAULTS } from '../assets/js/url-state.js';
import { SAMPLES } from '../assets/data/samples.js';
import { TOKENIZERS, READING_PACE, MEASURED_AT } from '../assets/data/density.js';

const URL_CONFIG = {
  languages: ['ko', 'en'],
  tokenizers: TOKENIZERS.map((t) => t.id),
  samples: Object.keys(SAMPLES),
};

/* ────────────────────────────────────────────────────────────────── engine */

test('a lane emits nothing until TTFT has passed', () => {
  const lane = { ttftSeconds: 1, tokensPerSecond: 10, total: 100 };
  assert.equal(tokensDueAt(lane, 0), 0);
  assert.equal(tokensDueAt(lane, 0.999), 0);
  assert.equal(tokensDueAt(lane, 1), 0);
  assert.equal(tokensDueAt(lane, 1.1), 1);
});

test('emission is a function of elapsed time, not of frame count', () => {
  const lane = { ttftSeconds: 0, tokensPerSecond: 37, total: 10_000 };
  // Sampling the same instant twice must give the same answer, and sampling
  // sparsely must give the same answer as sampling densely.
  assert.equal(tokensDueAt(lane, 3.5), tokensDueAt(lane, 3.5));
  assert.equal(tokensDueAt(lane, 10), 370);
});

test('a lane never exceeds its token count', () => {
  const lane = { ttftSeconds: 0, tokensPerSecond: 500, total: 12 };
  assert.equal(tokensDueAt(lane, 1e6), 12);
});

test('finishTime accounts for TTFT', () => {
  assert.equal(finishTime({ ttftSeconds: 2, tokensPerSecond: 10, total: 100 }), 12);
});

test('the last snapshot is the moment everything is done', () => {
  const lane = { ttftSeconds: 1, tokensPerSecond: 10, total: 100 };
  const times = snapshotTimes([lane]);
  assert.equal(times.at(-1), finishTime(lane));
  assert.equal(times[0], 0);
});

test('a paused clock does not advance', async () => {
  const clock = new StreamClock();
  assert.equal(clock.elapsed(), 0, 'idle clock reads zero');
  clock.start();
  clock.pause();
  const frozen = clock.elapsed();
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(clock.elapsed(), frozen);
  const paused = clock.resume();
  assert.ok(paused >= 0.02, `resume reports the pause (${paused}s)`);
});

/* ───────────────────────────────────────────────────────────── token pieces */

test('every precomputed sample reconstructs its source text exactly', () => {
  let combinations = 0;
  for (const [sampleId, byLang] of Object.entries(SAMPLES)) {
    for (const [lang, entry] of Object.entries(byLang)) {
      for (const [tokenizerId, pieces] of Object.entries(entry.tokens)) {
        combinations++;
        assert.equal(
          pieces.join(''),
          entry.text,
          `${sampleId}.${lang} via ${tokenizerId} does not round-trip`
        );
      }
    }
  }
  assert.ok(combinations >= 12, `expected a full matrix, got ${combinations}`);
});

test('tokenPieces survives a character split across two tokens', () => {
  // Reproduces the real failure: a prefix decode puts the replacement character
  // in the middle of the string, so a length-based delta corrupts the output
  // while the final decode still matches.
  const text = '대체로 짧은 단어';
  const fake = {
    encode: () => [0, 1, 2, 3, 4, 5],
    decode: (ids) =>
      ['대', '대체', '대체로', '대체로 ', '대체로� 짧', '대체로 짧은 단어'][ids.length - 1],
  };
  const { pieces, lossless } = tokenPieces(fake, text);
  assert.equal(lossless, true);
  assert.equal(pieces.join(''), text);
  assert.equal(pieces[4], '', 'a token that completes no character emits nothing');
});

test('approximation lands close to the real token count', () => {
  for (const lang of ['ko', 'en']) {
    const entry = SAMPLES.explainer[lang];
    const charsPerToken = TOKENIZERS.find((t) => t.id === 'o200k_base').charsPerToken[lang];
    const approx = approximatePieces(entry.text, charsPerToken).length;
    const exact = entry.tokens.o200k_base.length;
    const error = Math.abs(approx - exact) / exact;
    assert.ok(error < 0.15, `${lang}: approx ${approx} vs exact ${exact} (${(error * 100).toFixed(1)}% off)`);
  }
});

test('approximation never loses or reorders text', () => {
  for (const lang of ['ko', 'en']) {
    const { text } = SAMPLES.technical[lang];
    assert.equal(approximatePieces(text, 3.1).join(''), text);
  }
  assert.deepEqual(approximatePieces('', 4), []);
});

/* ─────────────────────────────────────────────────────────────── url state */

test('URL state round-trips', () => {
  const parsed = readState('?lang=en&tps=7,120&ttft=3.5&tok=gemma-3&read=310&theme=dark', URL_CONFIG);
  assert.equal(parsed.lang, 'en');
  assert.deepEqual(parsed.speeds, [7, 120]);
  assert.equal(parsed.ttft, 3.5);
  assert.equal(parsed.tokenizer, 'gemma-3');
  assert.equal(parsed.reading, 310);
  assert.deepEqual(readState(toSearch(parsed), URL_CONFIG), parsed);
});

test('a hand-edited URL degrades to defaults rather than breaking', () => {
  const junk = readState('?lang=xx&tps=abc&tok=nope&theme=pink&read=-5', URL_CONFIG);
  assert.equal(junk.lang, DEFAULTS.lang);
  assert.deepEqual(junk.speeds, DEFAULTS.speeds);
  assert.equal(junk.tokenizer, DEFAULTS.tokenizer);
  assert.equal(junk.theme, DEFAULTS.theme);
  assert.equal(junk.reading, 50, 'out-of-range values clamp instead of passing through');
});

test('out-of-range speeds are clamped and the lane count is capped', () => {
  const wild = readState('?tps=0,9999,3,4,5,6,7,8', URL_CONFIG);
  assert.ok(wild.speeds.every((s) => s >= 1 && s <= 500));
  assert.ok(wild.speeds.length <= 5);
});

test('a default-valued state serialises to an empty query', () => {
  assert.equal(toSearch({ ...DEFAULTS }), '');
});

/* ──────────────────────────────────────────────────────────── measured data */

test('shipped density figures are in a plausible range', () => {
  for (const tk of TOKENIZERS) {
    assert.ok(tk.charsPerToken.en > 3 && tk.charsPerToken.en < 7, `${tk.id} en=${tk.charsPerToken.en}`);
    assert.ok(tk.charsPerToken.ko > 0.7 && tk.charsPerToken.ko < 3, `${tk.id} ko=${tk.charsPerToken.ko}`);
  }
});

test('every shipped language has a sourced reading baseline', () => {
  for (const lang of ['ko', 'en']) {
    const pace = READING_PACE[lang];
    assert.equal(pace.available, true, `${lang} must not ship without a baseline`);
    assert.ok(pace.source && pace.sourceUrl, `${lang} baseline must carry its citation`);
    for (const [tokenizerId, tps] of Object.entries(pace.tokensPerSecond)) {
      assert.ok(tps > 2 && tps < 20, `${lang}/${tokenizerId} reading pace is ${tps} tok/s`);
    }
  }
});

test('the measurement date is stamped', () => {
  assert.match(MEASURED_AT, /^\d{4}-\d{2}-\d{2}$/);
});
