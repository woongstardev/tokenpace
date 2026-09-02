#!/usr/bin/env node
/**
 * build-site-data.mjs — turn the measurement output into the modules the site imports.
 *
 *   node build-site-data.mjs   # writes assets/data/*.js
 *
 * Two things are generated:
 *
 *   density.js  — measured chars-per-token and reading-pace figures.
 *   samples.js  — the built-in demo texts, already split into real tokens.
 *
 * The second one is the point. Tokenising at build time means the default
 * experience streams on genuine token boundaries with nothing to download —
 * the tokenizer itself is only ever fetched when someone pastes their own text.
 *
 * ES modules rather than JSON so the page needs no extra round trip and no
 * loading state before the first frame.
 */

import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';

import { REPO_ROOT, SAMPLES_DIR, TOKENIZERS, SAMPLE_ORDER } from './corpus-config.mjs';
import { tokenPieces } from '../assets/js/token-pieces.js';

const OUT_DIR = path.join(REPO_ROOT, 'assets', 'data');

/** Site languages. Density is measured for more, but a language only ships if
 *  it has UI strings and a sourced reading baseline. */
const SITE_LANGUAGES = ['ko', 'en'];

async function loadTokenizer(spec) {
  if (spec.kind === 'gpt') {
    const mod = await import(`gpt-tokenizer/encoding/${spec.encoding}`);
    return { encode: (t) => mod.encode(t), decode: (ids) => mod.decode(ids) };
  }
  const { AutoTokenizer } = await import('@huggingface/transformers');
  const tk = await AutoTokenizer.from_pretrained(spec.repo);
  return {
    encode: (t) => tk.encode(t, { add_special_tokens: false }),
    decode: (ids) => tk.decode(ids, { skip_special_tokens: true }),
  };
}

async function loadSamples() {
  const files = (await readdir(SAMPLES_DIR)).filter((f) => f.endsWith('.txt'));
  // Seed the map in the declared order so the generated object — and therefore
  // the site's dropdown — is ordered deliberately rather than alphabetically.
  const byId = new Map(SAMPLE_ORDER.map((id) => [id, {}]));
  for (const f of files) {
    const [id, lang] = f.replace(/\.txt$/, '').split('.');
    if (!SITE_LANGUAGES.includes(lang)) continue;
    if (!byId.has(id)) byId.set(id, {});
    byId.get(id)[lang] = (await readFile(path.join(SAMPLES_DIR, f), 'utf8')).trim();
  }
  return byId;
}

function banner(source) {
  return `// GENERATED — do not edit. Run \`npm run build-site\` in tools/ after changing ${source}.\n`;
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const density = JSON.parse(await readFile(path.join(REPO_ROOT, 'data', 'token-density.json'), 'utf8'));
  const pace = JSON.parse(await readFile(path.join(REPO_ROOT, 'data', 'reading-pace.json'), 'utf8'));
  const sources = JSON.parse(await readFile(path.join(REPO_ROOT, 'data', 'reading-speed-sources.json'), 'utf8'));

  /* ------------------------------------------------------------ density.js */

  const tokenizers = TOKENIZERS.map((spec) => ({
    id: spec.id,
    label: spec.label,
    // Only o200k_base can be tokenised in the browser for now; the rest fall
    // back to the measured coefficient. See assets/js/tokenize.js.
    exactAvailable: spec.id === 'o200k_base',
    charsPerToken: Object.fromEntries(
      SITE_LANGUAGES.map((l) => [l, Number(density.tokenizers[spec.id].languages[l].charsPerToken.toFixed(3))])
    ),
    tokenRatioVsEnglish: Object.fromEntries(
      SITE_LANGUAGES.map((l) => [l, Number(density.tokenizers[spec.id].languages[l].tokenRatioVsEnglish.toFixed(3))])
    ),
  }));

  const readingPace = Object.fromEntries(
    SITE_LANGUAGES.map((l) => {
      const p = pace.languages[l];
      const src = sources.languages[l];
      return [
        l,
        p.available
          ? {
              available: true,
              rate: p.rate,
              rateUnit: p.rateUnit,
              unit: src.unit,
              tokensPerSecond: p.tokensPerSecond,
              readerSpread: p.readerSpread,
              source: p.source,
              sourceUrl: p.sourceUrl,
            }
          : { available: false, reason: p.reason },
      ];
    })
  );

  const densityModule =
    banner('tools/measure-density.mjs or data/reading-speed-sources.json') +
    `export const MEASURED_AT = ${JSON.stringify(density.measuredAt)};\n\n` +
    `export const TOKENIZERS = ${JSON.stringify(tokenizers, null, 2)};\n\n` +
    `export const READING_PACE = ${JSON.stringify(readingPace, null, 2)};\n`;

  await writeFile(path.join(OUT_DIR, 'density.js'), densityModule);
  console.log(`  assets/data/density.js   ${(densityModule.length / 1024).toFixed(1)} KB`);

  /* ------------------------------------------------------------ samples.js */

  const samples = await loadSamples();
  const out = {};
  let warnings = 0;

  for (const spec of TOKENIZERS) {
    const tk = await loadTokenizer(spec);
    for (const [id, byLang] of samples) {
      for (const [lang, text] of Object.entries(byLang)) {
        out[id] ??= {};
        out[id][lang] ??= { text, tokens: {} };
        const { pieces, lossless, tokenCount } = tokenPieces(tk, text);
        if (!lossless) {
          console.warn(`  ! ${id}.${lang} via ${spec.id}: round-trip is lossy, falling back to approximation`);
          warnings++;
          continue;
        }
        out[id][lang].tokens[spec.id] = pieces;
        out[id][lang].tokenCount ??= {};
        out[id][lang].tokenCount[spec.id] = tokenCount;
      }
    }
  }

  const samplesModule =
    banner('corpus/samples/') +
    `export const SAMPLES = ${JSON.stringify(out)};\n`;

  await writeFile(path.join(OUT_DIR, 'samples.js'), samplesModule);
  console.log(`  assets/data/samples.js   ${(samplesModule.length / 1024).toFixed(1)} KB`);

  if (warnings) console.log(`\n${warnings} lossy round-trip(s) — those combinations ship without exact tokens.`);
}

main().catch((err) => {
  console.error(`\nbuild-site-data failed: ${err.message}`);
  process.exit(1);
});
