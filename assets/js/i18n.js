/**
 * i18n.js — UI strings.
 *
 * A language ships only when it has both a full string set here and a sourced
 * reading baseline in data/reading-speed-sources.json. Token density is
 * measured for Japanese and Chinese too, but without a reading baseline the
 * page would have nothing to compare against, which is the whole product.
 */

export const STRINGS = {
  ko: {
    htmlLang: 'ko',
    docTitle: 'tokenpace — tok/s를 내 읽기 속도에 견줘 보기',
    tagline: 'tok/s가 내 언어에서 실제로 얼마나 빠른지, 내가 읽는 속도에 견줘 재봅니다.',
    skipToLanes: '본문으로 건너뛰기',
    themeToggle: '테마 전환',

    controlsHeading: '설정',
    labelText: '텍스트',
    hintText: '문체에 따라 토큰 밀도가 달라집니다.',
    labelModel: '모델 (토크나이저)',
    labelTtft: 'TTFT — 첫 토큰까지 대기',
    hintTtft: '모델이 첫 글자를 내놓기 전까지의 침묵. 디코딩 속도와 별개입니다.',
    labelReading: '내 읽기 속도',
    labelLanes: '비교할 속도 (tok/s)',
    addLane: '+ 레인 추가',
    removeLane: '레인 삭제',
    play: '▶ 시작',
    playing: '■ 정지',
    reset: '↺ 초기화',
    share: '🔗 링크 복사',
    shareCopied: '복사했습니다',
    shareFailed: '복사 실패 — 주소창의 URL을 그대로 쓰세요',
    measureMine: '내 속도 직접 재기',

    lanesHeading: '스트리밍 비교',
    reducedMotionNote: '시스템 설정이 「모션 줄이기」라서 애니메이션 대신 시간대별 스냅샷으로 보여줍니다.',
    baselineLane: '내 읽기 속도',
    laneSpeed: (n) => `${n} tok/s`,
    laneWaiting: 'TTFT 대기 중…',
    laneDone: '완료',
    snapshotAt: (t) => `${t}초 시점`,
    resumedAfterHidden: (s) => `탭이 가려진 ${s}초 동안 시계를 멈췄습니다.`,

    verdictHeading: '판정',
    verdictIntro: (tps, unit) =>
      `내 읽기 속도 ${unit} → 이 토크나이저·언어에서 <strong>${tps} tok/s</strong> 에 해당합니다.`,
    verdictRow: (speed, ratio) =>
      ratio >= 1
        ? `<strong>${speed} tok/s</strong> — 읽기 속도의 <strong>${ratio}배</strong>. 읽는 동안 기다리지 않습니다.`
        : `<strong>${speed} tok/s</strong> — 읽기 속도의 <strong>${ratio}배</strong>. 글자가 나오길 기다리게 됩니다.`,
    verdictTiming: (total, ttft, reading) =>
      `전부 나오는 데 ${total}초 (그중 TTFT ${ttft}초). 같은 글을 읽는 데는 ${reading}초.`,
    verdictTtftNote: (pct) =>
      `이 설정에서는 전체 대기 시간의 <strong>${pct}%</strong> 가 TTFT입니다.`,
    verdictNoReading: '이 언어는 읽기 속도 기준선이 없어 판정을 내지 않습니다.',

    evidenceHeading: '이 숫자는 어디서 왔나',
    evidenceDensity: (cpt, lang, tok, date) =>
      `<strong>토큰 밀도</strong> — ${lang} 기준 1토큰 ≈ ${cpt}자 (${tok}). TED2020 병렬 코퍼스 3,000 문장쌍 실측, ${date}.`,
    evidenceReading: (rate, unit, source) =>
      `<strong>읽기 속도</strong> — 기본값 ${rate} ${unit}. 출처: ${source}`,
    evidenceSpread: (lo, hi) =>
      `<strong>개인차</strong> — 이 기준선은 인구 평균입니다. 개인차 범위의 양 끝에서는 ` +
      `${lo} ~ ${hi} tok/s 가 되지만, 35 tok/s 판정은 어느 끝에서도 바뀌지 않습니다. 직접 재보세요.`,
    evidenceFidelity: {
      precomputed: '<strong>토큰 경계</strong> — 실제 토크나이저로 빌드 시점에 계산한 정확한 경계입니다.',
      exact: '<strong>토큰 경계</strong> — 브라우저에서 실제 토크나이저로 계산했습니다.',
      approximate:
        '<strong>토큰 경계</strong> — ⚠️ 실측 계수 기반 <em>근사치</em>입니다. 토큰 수는 맞지만 경계는 대략입니다.',
    },
    loadExact: '이 텍스트를 정확히 세기 (토크나이저 내려받기 ~1MB)',
    loadingExact: '토크나이저 불러오는 중…',
    exactUnavailable: '이 토크나이저는 브라우저에서 실행할 수 없어 실측 계수를 씁니다.',
    caveatHeading: '이 비교의 한계',
    caveats: [
      '이건 <em>읽는</em> 속도지 <em>훑는</em> 속도가 아닙니다. 코드·표·긴 목록은 눈으로 건너뛰므로 실제 처리 속도는 더 높습니다.',
      '읽기 속도는 개인차가 평균을 압도합니다 (한국어 출처의 표준편차가 평균의 63%). 위 기본값은 슬라이더 초기값일 뿐이니 직접 재보세요.',
      '출처는 안과·심리학 실험이지 「LLM 응답 읽기」 실험이 아닙니다.',
      '실제 서비스의 tok/s 는 일정하지 않습니다. 여기서는 일정한 속도로 단순화했습니다.',
    ],

    rtTitle: '읽기 속도 재기',
    rtIntro: '아래 글을 평소 속도로 읽으세요. 다 읽으면 버튼을 누릅니다. 평균값이 아니라 당신의 값을 씁니다.',
    rtStart: '시작',
    rtDone: '다 읽었습니다',
    rtCancel: '닫기',
    rtResult: (rate, unit, tps) => `${rate} ${unit} — 이 설정에서 약 ${tps} tok/s 에 해당합니다.`,
    rtTooFast: '너무 빠릅니다. 실제로 읽으셨나요? 다시 해보세요.',

    unitCharsPerMin: '자/분',
    unitWordsPerMin: 'wpm',
    footer: (date) =>
      `측정일 ${date} · 수치는 <a href="docs/token-density.md">token-density.md</a> · ` +
      `<a href="docs/reading-speed.md">reading-speed.md</a> 에서 재현 가능합니다. 이 페이지가 만드는 외부 요청 0, 추적 0.`,
    customText: '직접 입력',
    customPlaceholder: '여기에 텍스트를 붙여넣으세요…',
  },

  en: {
    htmlLang: 'en',
    docTitle: 'tokenpace — how fast is a tok/s number, really?',
    tagline: 'How fast a tok/s number actually is in your language, measured against your own reading speed.',
    skipToLanes: 'Skip to content',
    themeToggle: 'Toggle theme',

    controlsHeading: 'Settings',
    labelText: 'Text',
    hintText: 'Token density varies with register.',
    labelModel: 'Model (tokenizer)',
    labelTtft: 'TTFT — wait before the first token',
    hintTtft: 'The silence before the first character appears. Independent of decoding speed.',
    labelReading: 'My reading speed',
    labelLanes: 'Speeds to compare (tok/s)',
    addLane: '+ Add lane',
    removeLane: 'Remove lane',
    play: '▶ Start',
    playing: '■ Stop',
    reset: '↺ Reset',
    share: '🔗 Copy link',
    shareCopied: 'Copied',
    shareFailed: 'Copy failed — use the URL in the address bar',
    measureMine: 'Measure mine',

    lanesHeading: 'Streaming comparison',
    reducedMotionNote: 'Your system asks for reduced motion, so this shows timed snapshots instead of an animation.',
    baselineLane: 'My reading speed',
    laneSpeed: (n) => `${n} tok/s`,
    laneWaiting: 'Waiting (TTFT)…',
    laneDone: 'Done',
    snapshotAt: (t) => `at ${t}s`,
    resumedAfterHidden: (s) => `Clock paused for ${s}s while the tab was hidden.`,

    verdictHeading: 'Verdict',
    verdictIntro: (tps, unit) =>
      `Your reading speed of ${unit} is <strong>${tps} tok/s</strong> for this language and tokenizer.`,
    verdictRow: (speed, ratio) =>
      ratio >= 1
        ? `<strong>${speed} tok/s</strong> — <strong>${ratio}×</strong> your reading speed. You never wait for text.`
        : `<strong>${speed} tok/s</strong> — <strong>${ratio}×</strong> your reading speed. You wait for text.`,
    verdictTiming: (total, ttft, reading) =>
      `${total}s to finish (${ttft}s of that is TTFT). Reading the same text takes ${reading}s.`,
    verdictTtftNote: (pct) => `At these settings, <strong>${pct}%</strong> of the total wait is TTFT.`,
    verdictNoReading: 'No sourced reading baseline for this language, so no verdict is given.',

    evidenceHeading: 'Where these numbers come from',
    evidenceDensity: (cpt, lang, tok, date) =>
      `<strong>Token density</strong> — one token ≈ ${cpt} characters in ${lang} (${tok}). Measured on 3,000 TED2020 sentence pairs, ${date}.`,
    evidenceReading: (rate, unit, source) =>
      `<strong>Reading speed</strong> — default ${rate} ${unit}. Source: ${source}`,
    evidenceSpread: (lo, hi) =>
      `<strong>Individual variation</strong> — this baseline is a population mean. At the ends ` +
      `of the spread it becomes ${lo}–${hi} tok/s, and the verdict at 35 tok/s holds at either ` +
      `end. Measure your own.`,
    evidenceFidelity: {
      precomputed: '<strong>Token boundaries</strong> — exact, computed by the real tokenizer at build time.',
      exact: '<strong>Token boundaries</strong> — exact, computed in your browser.',
      approximate:
        '<strong>Token boundaries</strong> — ⚠️ <em>approximated</em> from the measured coefficient. The count is right; the boundaries are not exact.',
    },
    loadExact: 'Tokenize this text exactly (downloads ~1 MB)',
    loadingExact: 'Loading tokenizer…',
    exactUnavailable: 'This tokenizer cannot run in the browser, so the measured coefficient is used.',
    caveatHeading: 'Limits of this comparison',
    caveats: [
      'This is <em>reading</em> speed, not <em>skimming</em> speed. Code, tables and long lists are scanned far faster.',
      'Individual variation dominates the average (the Korean source has an SD of 63% of the mean). Treat the default as a starting point and measure your own.',
      'The sources are ophthalmology and psycholinguistics studies, not studies of reading LLM output.',
      'Real services do not emit tokens at a constant rate. This simplifies to a steady rate.',
    ],

    rtTitle: 'Measure your reading speed',
    rtIntro: 'Read the passage below at your normal pace, then press the button. We use your number, not an average.',
    rtStart: 'Start',
    rtDone: 'Done reading',
    rtCancel: 'Close',
    rtResult: (rate, unit, tps) => `${rate} ${unit} — about ${tps} tok/s at these settings.`,
    rtTooFast: 'That was too fast to be real reading. Try again.',

    unitCharsPerMin: 'chars/min',
    unitWordsPerMin: 'wpm',
    footer: (date) =>
      `Measured ${date} · reproduce the numbers from <a href="docs/token-density.md">token-density.md</a> and ` +
      `<a href="docs/reading-speed.md">reading-speed.md</a>. This page makes zero external requests and zero tracking calls.`,
    customText: 'Paste your own',
    customPlaceholder: 'Paste text here…',
  },
};

export const SAMPLE_LABELS = {
  ko: { explainer: '설명문', chat: '대화체', technical: '기술문서 + 코드' },
  en: { explainer: 'Explainer', chat: 'Chat', technical: 'Technical + code' },
};

export const LANGUAGE_NAMES = { ko: { ko: '한국어', en: 'Korean' }, en: { ko: '영어', en: 'English' } };
