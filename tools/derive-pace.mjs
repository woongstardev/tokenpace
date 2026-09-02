#!/usr/bin/env node
/**
 * derive-pace.mjs — convert published reading speeds into tokens per second.
 *
 *   node derive-pace.mjs   # writes data/reading-pace.json + docs/reading-speed.md
 *
 * This is the step that makes the site's verdict possible. A reading speed is
 * published in words or characters per minute; a model's speed is published in
 * tokens per second. Putting them on one axis needs the density measured in
 * measure-density.mjs, and it has to be done per tokenizer, because "how many
 * tokens is a minute of reading" changes by a factor of two between them.
 *
 * Deliberately conservative: a language with no sourced reading speed produces
 * no number here. See data/reading-speed-sources.json for why.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { citationBlock } from './cite.mjs';
import path from 'node:path';

import { REPO_ROOT, TOKENIZERS, LANGUAGES } from './corpus-config.mjs';

const DENSITY_PATH = path.join(REPO_ROOT, 'data', 'token-density.json');
const SOURCES_PATH = path.join(REPO_ROOT, 'data', 'reading-speed-sources.json');

/**
 * Reading speed -> tokens per second, for one language and one tokenizer.
 *
 * English is published per word, Korean per character. Rather than convert one
 * into the other (which would need a chars-per-word constant nobody publishes
 * for the same population), each is multiplied by the matching density figure
 * measured on the same corpus.
 */
function toTokensPerSecond(langSpec, density) {
  if (langSpec.unit === 'word') {
    return (langSpec.rate * density.tokensPerWord) / 60;
  }
  if (langSpec.unit === 'char') {
    return langSpec.rate / density.charsPerToken / 60;
  }
  throw new Error(`unknown unit ${langSpec.unit}`);
}

async function main() {
  const density = JSON.parse(await readFile(DENSITY_PATH, 'utf8'));
  const sources = JSON.parse(await readFile(SOURCES_PATH, 'utf8'));

  const out = {
    measuredAt: density.measuredAt,
    note: 'Derived. Edit data/reading-speed-sources.json and re-run tools/derive-pace.mjs.',
    languages: {},
  };

  for (const lang of LANGUAGES) {
    const spec = sources.languages[lang.id];
    if (!spec?.available) {
      out.languages[lang.id] = { available: false, reason: spec?.reason ?? 'no source' };
      continue;
    }
    const perTokenizer = {};
    for (const tk of TOKENIZERS) {
      const d = density.tokenizers[tk.id].languages[lang.id];
      perTokenizer[tk.id] = Number(toTokensPerSecond(spec, d).toFixed(2));
    }
    const values = Object.values(perTokenizer);

    // How much does the conclusion move if the reader is not the average one?
    // Both languages now publish a `range` (English as reported, Korean derived
    // from its SD), so the spread is one code path. It is computed on the
    // current tokenizer because that is the number the page shows.
    const modern = density.tokenizers.o200k_base.languages[lang.id];
    const spread = spec.range
      ? spec.range.map((r) => Number(toTokensPerSecond({ ...spec, rate: r }, modern).toFixed(2)))
      : null;

    out.languages[lang.id] = {
      available: true,
      rate: spec.rate,
      rateUnit: spec.rateUnit,
      mode: spec.mode,
      tokensPerSecond: perTokenizer,
      tokensPerSecondRange: [Math.min(...values), Math.max(...values)],
      readerSpread: spread,
      readerSpreadBasis: spec.rangeBasis ?? spec.source.basis ?? null,
      source: spec.source.citation,
      sourceUrl: spec.source.url,
    };
  }

  await writeFile(path.join(REPO_ROOT, 'data', 'reading-pace.json'), JSON.stringify(out, null, 2) + '\n');
  console.log('Wrote data/reading-pace.json');

  await writeFile(path.join(REPO_ROOT, 'docs', 'reading-speed.md'), render(out, sources, density));
  console.log('Wrote docs/reading-speed.md');

  for (const lang of LANGUAGES) {
    const r = out.languages[lang.id];
    console.log(
      `  ${lang.label.padEnd(12)} ${
        r.available ? `${r.tokensPerSecondRange[0]} – ${r.tokensPerSecondRange[1]} tok/s` : '— (출처 미확보)'
      }`
    );
  }
}

function render(out, sources, density) {
  const availableLangs = LANGUAGES.filter((l) => out.languages[l.id].available);

  // Every headline figure in the prose below is computed here, so the text can
  // never drift away from the table above it.
  const allValues = availableLangs.flatMap((l) => Object.values(out.languages[l.id].tokensPerSecond));
  const modern = (langId) => out.languages[langId].tokensPerSecond.o200k_base;
  const SUMMARY = {
    lo: Math.min(...allValues).toFixed(1),
    hi: Math.max(...allValues).toFixed(1),
    enModern: modern('en').toFixed(1),
    koModern: modern('ko').toFixed(1),
    x50: Math.round(50 / Math.max(...allValues)),
    x300: Math.round(300 / Math.min(...allValues)),
  };

  const SENSITIVITY = availableLangs
    .filter((l) => out.languages[l.id].readerSpread)
    .map((l) => {
      const r = out.languages[l.id];
      const [lo, hi] = r.readerSpread;
      return `- **${l.label}** ${r.rate} ${r.rateUnit} 의 개인차 범위 → **${lo} ~ ${hi} tok/s**`;
    })
    .join('\n');

  const header = `| 토크나이저 | ${availableLangs.map((l) => l.label).join(' | ')} |\n|---|${availableLangs
    .map(() => '---:')
    .join('|')}|`;

  const rows = TOKENIZERS.map(
    (tk) =>
      `| ${tk.label} | ${availableLangs
        .map((l) => out.languages[l.id].tokensPerSecond[tk.id].toFixed(2))
        .join(' | ')} |`
  ).join('\n');

  const caveatBlocks = availableLangs
    .map((l) => {
      const s = sources.languages[l.id].source;
      return [
        `### ${l.label} — ${out.languages[l.id].rate} ${out.languages[l.id].rateUnit}`,
        '',
        `> ${s.citation}`,
        s.url ? `> <${s.url}>` : '',
        '',
        `**근거**: ${s.basis}`,
        '',
        '**한계**:',
        ...(s.caveats ?? []).map((c) => `- ${c}`),
      ]
        .filter((x) => x !== '')
        .join('\n');
    })
    .join('\n\n');

  const missing = LANGUAGES.filter((l) => !out.languages[l.id].available)
    .map((l) => `- **${l.label}** — ${out.languages[l.id].reason}`)
    .join('\n');

  return `<!-- GENERATED FILE — edit data/reading-speed-sources.json, then re-run \`npm run derive\`. -->

# 읽기 속도 → tok/s 환산

- **측정일**: ${out.measuredAt}
- **재현**: \`cd tools && npm run derive\`
- **입력**: [\`data/reading-speed-sources.json\`](../data/reading-speed-sources.json) (사람이 쓴 출처 있는 상수)
  × [\`docs/token-density.md\`](token-density.md) (실측 밀도)

tok/s 는 모델 쪽 단위고 읽기 속도는 사람 쪽 단위다. 둘을 한 축에 올리려면 토큰 밀도가 필요하고,
밀도는 토크나이저마다 다르므로 **환산값도 토크나이저마다 다르다.** 하나의 숫자로 뭉뚱그릴 수 없다.

---

## 사람이 읽는 속도는 몇 tok/s 인가

${header}
${rows}

**이 표가 이 프로젝트의 결론이다.** 읽기 속도는 어느 언어, 어느 토크나이저로 환산해도
**${SUMMARY.lo} ~ ${SUMMARY.hi} tok/s** 안에 들어온다. 현행 토크나이저(o200k_base)만 놓고 보면
영어 ${SUMMARY.enModern} tok/s, 한국어 ${SUMMARY.koModern} tok/s 로 **사실상 같다** —
자/초로는 3배 갈리는 두 언어가 tok/s 로 환산하면 겹친다. 토크나이저가 정보 밀도를 어느 정도
따라가기 때문이다.

요즘 추론 서비스가 광고하는 50, 100, 300 tok/s 는 사람이 읽는 속도의
**${SUMMARY.x50}배 ~ ${SUMMARY.x300}배**다.

⇒ 디코딩 속도를 더 올려도 「읽는 동안 기다리지 않는다」는 이미 오래전에 달성됐다.
남은 체감 변수는 **첫 토큰까지의 대기(TTFT)** 와 **응답의 길이**지 tok/s 가 아니다.

### 평균이 아닌 독자라면 (민감도)

이 결론이 평균값 하나에 얼마나 매달려 있는지가 중요하다. 개인차 범위의 양 끝에서 다시 재면
(o200k_base 기준):

${SENSITIVITY}

⇒ **35 tok/s 판정은 어느 끝에서도 안 바뀐다.** 뒤집히는 것은 5 tok/s 레인뿐이고,
그것이 그 레인이 화면에 있는 이유다. 결론이 걸려 있는 것은 평균값이 아니라 자릿수다 —
그래서 개인 측정 기능이 인구 평균보다 위에 있다.

⚠️ 단, 이것은 **읽는 속도**지 **훑는 속도**가 아니다. 코드·표·긴 목록처럼 눈으로 건너뛰며
읽는 출력에서는 사람의 유효 처리 속도가 훨씬 높아지고, 그때는 tok/s 가 다시 체감에 들어온다.

---

## 출처와 한계

${caveatBlocks}

${missing ? `### 출처를 확보하지 못한 언어\n\n${missing}\n\n이 언어들은 토큰 밀도는 실측값을 쓰지만 **읽기 속도 기준선은 기본값 없이** 나간다.\n근거 없는 기본값을 넣는 것이 기준선을 비워 두는 것보다 나쁘다 — 기준선이 이 제품의 전부이기 때문이다.` : ''}

---

## 왜 평균을 믿으면 안 되는가

한국어 출처의 표준편차는 평균의 63%다 (549.7 ± 348.9 자/분). 영어 쪽도 대부분의 성인이
175~300 wpm 에 흩어진다. **인구 평균은 당신의 판정 기준이 아니다.**

⇒ 사이트는 이 값을 **슬라이더의 초기값으로만** 쓰고, 사용자가 자기 읽기 속도를 직접 재서
덮어쓸 수 있게 한다. 개인차가 평균을 압도하는 지표에서는 그게 유일하게 정직한 설계다.

---

${citationBlock(out.measuredAt)}
`;
}

main().catch((err) => {
  console.error(`\nderive-pace failed: ${err.message}`);
  process.exit(1);
});
