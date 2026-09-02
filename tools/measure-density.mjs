#!/usr/bin/env node
/**
 * measure-density.mjs — measure how many characters one token buys you, per
 * language and per tokenizer, and turn that into the numbers the site ships.
 *
 *   node fetch-corpus.mjs      # once, to populate corpus/cache/
 *   node measure-density.mjs   # writes data/token-density.json + docs/token-density.md
 *
 * Two things are measured, and they answer different questions:
 *
 *   charsPerToken  — how much text one token renders as. This is what turns a
 *                    tok/s number into a characters-per-second animation.
 *   tokenRatio     — tokens needed for the same meaning, relative to English.
 *                    This is the "language tax": what you pay per API call.
 *
 * They are not reciprocals of each other. Korean is denser per character than
 * English, so the two diverge, and conflating them is the usual source of
 * wrong numbers in write-ups on this topic.
 */

import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { citationBlock } from './cite.mjs';
import path from 'node:path';

import { REPO_ROOT, CACHE_DIR, SAMPLES_DIR, PARALLEL_SETS, TOKENIZERS, LANGUAGES } from './corpus-config.mjs';

const ISO_DATE = process.env.TOKENPACE_MEASURED_AT || new Date().toISOString().slice(0, 10);

/* ------------------------------------------------------------------ loaders */

async function loadTokenizer(spec) {
  if (spec.kind === 'gpt') {
    const mod = await import(`gpt-tokenizer/encoding/${spec.encoding}`);
    return { encode: (text) => mod.encode(text) };
  }
  const { AutoTokenizer } = await import('@huggingface/transformers');
  const tk = await AutoTokenizer.from_pretrained(spec.repo);
  return { encode: (text) => tk.encode(text, { add_special_tokens: false }) };
}

/** Count Unicode code points, not UTF-16 units — otherwise emoji and rarer CJK
 *  count double and every ratio drifts. */
const charCount = (text) => [...text].length;

/* -------------------------------------------------------------- corpus load */

async function loadParallelCorpora() {
  const dir = path.join(CACHE_DIR, 'sampled');
  const corpora = [];
  for (const set of PARALLEL_SETS) {
    const en = await readFile(path.join(dir, `${set.id}.en.txt`), 'utf8');
    const other = await readFile(path.join(dir, `${set.id}.${set.lang}.txt`), 'utf8');
    corpora.push({
      id: set.id,
      lang: set.lang,
      pairs: en.trimEnd().split('\n').map((line, i) => [line, other.trimEnd().split('\n')[i]]),
      enText: en.trimEnd().split('\n'),
      otherText: other.trimEnd().split('\n'),
    });
  }
  return corpora;
}

async function loadRegisterSamples() {
  const files = await readdir(SAMPLES_DIR);
  const byRegister = new Map();
  for (const f of files.filter((f) => f.endsWith('.txt'))) {
    const [register, lang] = f.replace(/\.txt$/, '').split('.');
    if (!byRegister.has(register)) byRegister.set(register, {});
    byRegister.get(register)[lang] = (await readFile(path.join(SAMPLES_DIR, f), 'utf8')).trim();
  }
  return byRegister;
}

/* ----------------------------------------------------------------- measuring */

/** Whitespace-delimited units. For English this is a word; for Korean it is an
 *  어절, which is the unit the reading-speed literature counts. Neither is
 *  meaningful for Japanese or Chinese, which is why the reading-pace derivation
 *  uses characters for those. */
const wordCount = (text) => text.split(/\s+/).filter(Boolean).length;

function measureLines(tokenizer, lines) {
  let chars = 0;
  let tokens = 0;
  let words = 0;
  for (const line of lines) {
    if (!line) continue;
    chars += charCount(line);
    words += wordCount(line);
    tokens += tokenizer.encode(line).length;
  }
  return { chars, words, tokens, charsPerToken: chars / tokens, tokensPerWord: tokens / words };
}

async function main() {
  console.log(`Measuring token density (${ISO_DATE})\n`);

  const parallel = await loadParallelCorpora();
  const registers = await loadRegisterSamples();

  // English side is shared across the three pairs but they are different
  // sentence sets, so each pair carries its own English baseline.
  const results = { measuredAt: ISO_DATE, tokenizers: {}, registers: {} };

  for (const spec of TOKENIZERS) {
    process.stdout.write(`  ${spec.label.padEnd(34)}`);
    const tk = await loadTokenizer(spec);

    const perLang = {};
    for (const corpus of parallel) {
      const en = measureLines(tk, corpus.enText);
      const other = measureLines(tk, corpus.otherText);

      // English appears in every pair; keep the mean rather than the last one.
      perLang.en ??= { chars: 0, words: 0, tokens: 0 };
      perLang.en.chars += en.chars;
      perLang.en.words += en.words;
      perLang.en.tokens += en.tokens;

      perLang[corpus.lang] = {
        chars: other.chars,
        words: other.words,
        tokens: other.tokens,
        charsPerToken: other.charsPerToken,
        tokensPerWord: other.tokensPerWord,
        // Tokens for the same meaning, English = 1.00
        tokenRatioVsEnglish: other.tokens / en.tokens,
        corpus: corpus.id,
      };
    }
    perLang.en.charsPerToken = perLang.en.chars / perLang.en.tokens;
    perLang.en.tokensPerWord = perLang.en.tokens / perLang.en.words;
    perLang.en.tokenRatioVsEnglish = 1;

    results.tokenizers[spec.id] = { label: spec.label, source: spec.repo || `tiktoken:${spec.encoding}`, languages: perLang };
    console.log(
      LANGUAGES.map((l) => `${l.id} ${perLang[l.id].charsPerToken.toFixed(2)}`).join('  ')
    );

    for (const [register, texts] of registers) {
      results.registers[register] ??= {};
      for (const [lang, text] of Object.entries(texts)) {
        const m = measureLines(tk, text.split('\n'));
        results.registers[register][lang] ??= {};
        results.registers[register][lang][spec.id] = Number(m.charsPerToken.toFixed(3));
      }
    }
  }

  await mkdir(path.join(REPO_ROOT, 'data'), { recursive: true });
  await writeFile(
    path.join(REPO_ROOT, 'data', 'token-density.json'),
    JSON.stringify(results, null, 2) + '\n'
  );
  console.log('\nWrote data/token-density.json');

  await writeFile(path.join(REPO_ROOT, 'docs', 'token-density.md'), renderMarkdown(results));
  console.log('Wrote docs/token-density.md');
}

/* ------------------------------------------------------------------ report */

function renderMarkdown(r) {
  const langs = LANGUAGES;
  const rows = (pick) =>
    TOKENIZERS.map((spec) => {
      const L = r.tokenizers[spec.id].languages;
      return `| ${spec.label} | ${langs.map((l) => pick(L[l.id])).join(' | ')} |`;
    }).join('\n');

  const header = `| 토크나이저 | ${langs.map((l) => l.label).join(' | ')} |\n|---|${langs.map(() => '---:').join('|')}|`;

  const registerRows = Object.entries(r.registers)
    .map(([register, byLang]) => {
      const ko = byLang.ko?.o200k_base;
      const en = byLang.en?.o200k_base;
      if (ko == null || en == null) return null;
      return `| ${register} | ${en.toFixed(2)} | ${ko.toFixed(2)} | ${(en / ko).toFixed(2)}× |`;
    })
    .filter(Boolean)
    .join('\n');

  return `<!-- GENERATED FILE — edit tools/measure-density.mjs, then re-run \`npm run measure\`. -->

# 토큰 밀도 실측 (token density)

- **측정일**: ${r.measuredAt}
- **재현**: \`cd tools && npm ci && npm run fetch-corpus && npm run measure\`
- **코퍼스**: TED2020 (OPUS), 언어쌍별 3,000 문장쌍을 고정 stride 로 표본 추출.
  아카이브 sha256 은 [\`corpus/CHECKSUMS.json\`](../corpus/CHECKSUMS.json) 에 고정돼 있다.
- **집계**: 문장별 토큰 수의 합 / 문자 수의 합. 문자는 UTF-16 단위가 아니라 **유니코드 코드포인트**로 센다.
  특수 토큰은 제외한다.

---

## 1. 자/토큰 — 토큰 하나가 화면에 찍는 글자 수

tok/s 를 화면에서의 초당 글자 수로 바꿀 때 쓰는 계수다. **크면 빠르게 보인다.**

${header}
${rows((x) => x.charsPerToken.toFixed(2))}

## 2. 토큰 비율 — 같은 내용을 쓰는 데 드는 토큰 수 (영어 = 1.00)

API 청구서에 찍히는 축이다. **크면 비싸다.** 1번 표의 역수가 아니다 —
언어마다 같은 내용을 담는 데 필요한 글자 수 자체가 다르기 때문이다.

${header}
${rows((x) => x.tokenRatioVsEnglish.toFixed(2) + '×')}

## 3. 문체별 편차 (o200k_base, 자/토큰)

TED2020 은 구어체 산문이다. LLM 이 실제로 쏟아내는 설명문·코드·대화는 밀도가 다르므로,
같은 뜻으로 직접 작성한 병렬 샘플([\`corpus/samples/\`](../corpus/README.md), CC0)로 따로 잰다.

| 문체 | 영어 | 한국어 | 격차 |
|---|---:|---:|---:|
${registerRows}

---

## 출처·라이선스

- 코퍼스: TED2020 — Reimers & Gurevych (2020), [OPUS](https://opus.nlpl.eu/TED2020/).
  원문 TED 자막은 CC BY-NC-ND 4.0 이므로 **이 리포에 본문을 담지 않는다.** 내려받는 스크립트와
  체크섬만 커밋한다.
- 토크나이저: OpenAI 계열은 [gpt-tokenizer](https://github.com/niieani/gpt-tokenizer) (MIT, tiktoken 포팅).
  나머지는 Hugging Face Hub 의 \`tokenizer.json\`. **게이트 없는 리포만 쓴다** — 재현에 HF 계정이
  필요해지면 재현이 아니다. Llama·Gemma 는 같은 파일의 커뮤니티 미러를 읽는다.
- 이 문서의 수치: CC BY 4.0.

---

${citationBlock(r.measuredAt)}
`;
}

main().catch((err) => {
  console.error(`\nmeasure-density failed: ${err.message}`);
  process.exit(1);
});
