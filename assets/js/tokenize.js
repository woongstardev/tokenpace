/**
 * tokenize.js — turn text into the pieces a streaming client would receive.
 *
 * Three sources, in descending order of fidelity:
 *
 *   1. precomputed  — built-in samples, tokenised at build time by the real
 *                     tokenizer. Exact, and costs nothing to load.
 *   2. exact        — the vendored tokenizer, fetched on demand (~1 MB gzipped)
 *                     when someone pastes their own text and asks for it.
 *   3. approximate  — measured chars-per-token, used until (2) is loaded.
 *
 * The site always says which one produced the numbers on screen. An unlabelled
 * approximation would undermine the only thing this project is for.
 */

import { SAMPLES } from '../data/samples.js';
import { tokenPieces, approximatePieces } from './token-pieces.js';

/** Tokenizers that can be run in the browser. The rest use their measured
 *  coefficient — see tools/vendor-tokenizer.mjs for why only one ships. */
const EXACT_LOADERS = {
  o200k_base: () => import('../vendor/gpt-tokenizer/encoding/o200k_base.js'),
};

/** In-flight loads, so a double click does not fetch a megabyte twice. */
const pending = new Map();
/** Modules that have finished loading. getPieces() is synchronous, so it can
 *  only use what is already here. */
const loaded = new Map();

export function canBeExact(tokenizerId) {
  return tokenizerId in EXACT_LOADERS;
}

export function isExactLoaded(tokenizerId) {
  return loaded.has(tokenizerId);
}

/** Fetch the tokenizer for `tokenizerId`. Idempotent. */
export async function ensureExact(tokenizerId) {
  if (loaded.has(tokenizerId)) return loaded.get(tokenizerId);
  if (!canBeExact(tokenizerId)) throw new Error(`no browser tokenizer for ${tokenizerId}`);

  if (!pending.has(tokenizerId)) {
    pending.set(
      tokenizerId,
      EXACT_LOADERS[tokenizerId]().then((mod) => {
        loaded.set(tokenizerId, mod);
        pending.delete(tokenizerId);
        return mod;
      })
    );
  }
  return pending.get(tokenizerId);
}

/**
 * Resolve the best available pieces for the current selection.
 *
 * Returns `{ pieces, fidelity }` where fidelity is one of
 * 'precomputed' | 'exact' | 'approximate'.
 */
export function getPieces({ sampleId, lang, text, tokenizerId, charsPerToken }) {
  if (sampleId && SAMPLES[sampleId]?.[lang]?.tokens?.[tokenizerId]) {
    return { pieces: SAMPLES[sampleId][lang].tokens[tokenizerId], fidelity: 'precomputed' };
  }

  if (loaded.has(tokenizerId)) {
    return { pieces: tokenPieces(loaded.get(tokenizerId), text).pieces, fidelity: 'exact' };
  }

  return { pieces: approximatePieces(text, charsPerToken), fidelity: 'approximate' };
}

export { SAMPLES, approximatePieces };
