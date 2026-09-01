/**
 * reading-test.js — let the reader replace the population average with their own number.
 *
 * The Korean source has a standard deviation of 63% of its mean, and the
 * English meta-analysis puts most adults anywhere between 175 and 300 wpm. A
 * verdict built on either average is a verdict about nobody in particular, so
 * the page offers thirty seconds of measurement instead.
 *
 * Deliberately crude: one passage, one timer, no comprehension check. It is not
 * a psychometric instrument, it is a better default than the mean.
 */

import { SAMPLES } from '../data/samples.js';

/** Below this, the reader clicked through rather than read. */
const IMPLAUSIBLY_FAST_CHARS_PER_MIN = 2000;
const IMPLAUSIBLY_FAST_WORDS_PER_MIN = 600;

const countChars = (text) => [...text].length;
const countWords = (text) => text.split(/\s+/).filter(Boolean).length;

/**
 * Roughly twenty seconds of reading at the published average, per language.
 *
 * Long enough that a click's worth of reaction time does not dominate, short
 * enough that people finish. The full sample would take about a minute, which
 * in testing is long enough that nobody would.
 */
const TARGET_LENGTH = { ko: 190, en: 480 };

export function passageFor(lang) {
  // The explainer register is closest to what an LLM actually produces, which
  // is the thing the measured speed will be compared against.
  const full = SAMPLES.explainer?.[lang]?.text ?? '';
  const budget = TARGET_LENGTH[lang] ?? 300;
  if (full.length <= budget) return full;

  // Cut on a sentence boundary — a passage ending mid-clause makes people
  // hesitate, and the hesitation lands in the measurement.
  const sentences = full.match(/[^.!?。\n]+[.!?。]?\s*/g) ?? [full];
  let passage = '';
  for (const sentence of sentences) {
    if (passage && passage.length + sentence.length > budget) break;
    passage += sentence;
  }
  return passage.trim();
}

export class ReadingTest {
  #startedAt = null;
  #passage = '';
  #unit = 'char';

  constructor({ lang, unit }) {
    this.#passage = passageFor(lang);
    this.#unit = unit;
  }

  get passage() {
    return this.#passage;
  }

  start() {
    this.#startedAt = performance.now();
  }

  get started() {
    return this.#startedAt !== null;
  }

  /**
   * @returns {{ ok: true, rate: number, unit: string, seconds: number }
   *          | { ok: false, reason: 'not-started' | 'too-fast' }}
   */
  finish() {
    if (this.#startedAt === null) return { ok: false, reason: 'not-started' };
    const minutes = (performance.now() - this.#startedAt) / 60000;
    this.#startedAt = null;
    if (minutes <= 0) return { ok: false, reason: 'too-fast' };

    const amount = this.#unit === 'word' ? countWords(this.#passage) : countChars(this.#passage);
    const rate = amount / minutes;

    const ceiling =
      this.#unit === 'word' ? IMPLAUSIBLY_FAST_WORDS_PER_MIN : IMPLAUSIBLY_FAST_CHARS_PER_MIN;
    if (rate > ceiling) return { ok: false, reason: 'too-fast' };

    return { ok: true, rate: Math.round(rate), unit: this.#unit, seconds: minutes * 60 };
  }
}
