/**
 * token-pieces.js — split text into the strings a streaming client receives.
 *
 * Shared by the build step (tools/build-site-data.mjs) and the browser, because
 * getting this subtly wrong is easy and having two copies drift would be worse.
 *
 * ── Why this is not just `decode([id])` ──────────────────────────────────────
 *
 * Byte-level BPE tokenises bytes, not characters, so a single Hangul syllable
 * routinely straddles two tokens. Decoding a prefix that ends mid-character
 * yields a replacement character, and — this is the part that bites — not
 * necessarily at the end:
 *
 *     decode(ids[0..4])  ->  "대체로� 짧"
 *     decode(ids[0..5])  ->  "대체로 짧은"
 *
 * The broken byte sits at index 3 while later complete bytes decode fine after
 * it. So the naive `soFar.slice(prev.length)` produces pieces that concatenate
 * back into corrupted text, while the final decode still matches the source —
 * which means the obvious integrity check passes and the bug ships.
 *
 * Instead: measure how much of the *source* each prefix has definitely covered,
 * never let that number go backwards, and cut the pieces out of the source.
 * A token that completes no new character emits an empty string, which is
 * exactly what a real client renders at that moment.
 */

function commonPrefixLength(a, b) {
  const n = Math.min(a.length, b.length);
  let i = 0;
  while (i < n && a[i] === b[i]) i++;
  return i;
}

/**
 * @param {{encode: (t: string) => Iterable<number>, decode: (ids: number[]) => string}} tokenizer
 * @param {string} text
 * @returns {{pieces: string[], tokenCount: number, lossless: boolean}}
 */
export function tokenPieces(tokenizer, text) {
  const ids = Array.from(tokenizer.encode(text));
  const pieces = [];
  let covered = 0;

  for (let i = 0; i < ids.length; i++) {
    const soFar = tokenizer.decode(ids.slice(0, i + 1));
    const next = Math.max(covered, commonPrefixLength(text, soFar));
    pieces.push(text.slice(covered, next));
    covered = next;
  }

  return { pieces, tokenCount: ids.length, lossless: covered === text.length };
}

const WORD_CHAR = /[A-Za-z0-9'’]/;

/** How far past a token boundary a Latin word may run before it is cut. */
const WORD_OVERRUN = 1.4;

/**
 * Approximate token boundaries from a measured chars-per-token figure, for text
 * we have no tokenizer for.
 *
 * The token *count* is what the animation timing depends on, so that is what
 * this gets right: each character costs `1/charsPerToken`, and the overshoot
 * past a boundary is carried into the next piece rather than discarded. Without
 * the carry, the word-preserving rule below would quietly inflate every piece
 * and the whole stream would run a quarter too fast.
 *
 * Boundaries are a lesser concern — real BPE splits long words too — but Latin
 * words are kept whole within a small allowance, because cutting "the" in half
 * reads as a rendering bug rather than as tokenisation.
 */
export function approximatePieces(text, charsPerToken) {
  if (!text) return [];
  const chars = [...text];
  const costPerChar = 1 / charsPerToken;
  const pieces = [];

  let current = '';
  let cost = 0;

  for (let i = 0; i < chars.length; i++) {
    current += chars[i];
    cost += costPerChar;
    if (cost < 1) continue;

    const midLatinWord =
      cost < WORD_OVERRUN &&
      WORD_CHAR.test(chars[i]) &&
      i + 1 < chars.length &&
      WORD_CHAR.test(chars[i + 1]);
    if (midLatinWord) continue;

    pieces.push(current);
    current = '';
    cost -= 1;
  }
  if (current) pieces.push(current);
  return pieces;
}
