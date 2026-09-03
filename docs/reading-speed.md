<!-- GENERATED FILE — edit data/reading-speed-sources.json, then re-run `npm run derive`. -->

# 읽기 속도 → tok/s 환산

**한국어** · [English ↓](#reading-speed-in-tokss)

> 영문 절은 132행부터입니다 — `# Reading speed, in tok/s` 를 찾으십시오.

- **측정일**: 2026-09-02
- **재현**: `cd tools && npm run derive`
- **입력**: [`data/reading-speed-sources.json`](../data/reading-speed-sources.json) (사람이 쓴 출처 있는 상수)
  × [`docs/token-density.md`](token-density.md) (실측 밀도)

tok/s 는 모델 쪽 단위고 읽기 속도는 사람 쪽 단위다. 둘을 한 축에 올리려면 토큰 밀도가 필요하고,
밀도는 토크나이저마다 다르므로 **환산값도 토크나이저마다 다르다.** 하나의 숫자로 뭉뚱그릴 수 없다.

---

## 사람이 읽는 속도는 몇 tok/s 인가

| 토크나이저 | English | 한국어 |
|---|---:|---:|
| GPT-4o / GPT-5 (o200k_base) | 4.73 | 5.38 |
| GPT-4 / GPT-3.5 (cl100k_base) | 4.84 | 8.96 |
| Llama 3.1 | 4.84 | 5.50 |
| Qwen3 | 4.88 | 6.00 |
| Gemma 3 | 4.93 | 4.93 |
| Mistral Small 3 | 4.91 | 4.72 |

**이 표가 이 프로젝트의 결론이다.** 읽기 속도는 어느 언어, 어느 토크나이저로 환산해도
**4.7 ~ 9.0 tok/s** 안에 들어온다. 현행 토크나이저(o200k_base)만 놓고 보면
영어 4.7 tok/s, 한국어 5.4 tok/s 로 **사실상 같다** —
자/초로는 3배 갈리는 두 언어가 tok/s 로 환산하면 겹친다. 토크나이저가 정보 밀도를 어느 정도
따라가기 때문이다.

요즘 추론 서비스가 광고하는 50, 100, 300 tok/s 는 사람이 읽는 속도의
**6배 ~ 64배**다.

⇒ **읽어 내려가는 글에 대해서는** 디코딩 속도를 더 올려도 「읽는 동안 기다리지 않는다」가
이미 오래전에 달성됐다. 남은 체감 변수는 **첫 토큰까지의 대기(TTFT)** 와 **응답의 길이**지
tok/s 가 아니다.

### 평균이 아닌 독자라면 (민감도)

이 결론이 평균값 하나에 얼마나 매달려 있는지가 중요하다. 개인차 범위의 양 끝에서 다시 재면
(o200k_base 기준):

- **English** 238 words/min 의 개인차 범위 → **3.48 ~ 5.97 tok/s**
- **한국어** 549.7 chars/min 의 개인차 범위 → **1.97 ~ 8.8 tok/s**

⇒ **35 tok/s 판정은 어느 끝에서도 안 바뀐다.** 뒤집히는 것은 5 tok/s 레인뿐이고,
그것이 그 레인이 화면에 있는 이유다. 결론이 걸려 있는 것은 평균값이 아니라 자릿수다 —
그래서 개인 측정 기능이 인구 평균보다 위에 있다.

### 다른 코퍼스로 재도 그런가 (민감도 2)

밀도는 번역된 강연 자막(TED2020)에서 나왔다. 각 언어로 직접 쓴 문어
([`corpus/samples/`](../corpus/README.md))로 다시 환산하면:

- **한국어** 5.38 → **5.08 tok/s** (자/토큰 1.70 → 1.80)

⇒ 자릿수가 안 움직인다. 코퍼스가 결론을 좌우하지 않는다는 뜻이고, 왜 그런지는
[`docs/token-density.md`](token-density.md) §4 에 있다 — 그 차이의 대부분이 번역이 아니라
구어·문어 차이이기 때문이다. (영어는 단어 단위로 환산하므로 이 표에서 빠진다.)

### 이 결론이 닿지 않는 곳 — 훑기

이것은 **읽는 속도**지 **훑는 속도**가 아니다. 코드·표·긴 목록처럼 눈으로 건너뛰는 출력에서는
사람 쪽 처리 속도가 올라가고, 그러면 tok/s 가 다시 체감에 들어온다.

문턱이 어떻게 움직이는지는 산수로 정해진다: 훑을 때 정독의 **k배** 속도로 받아들인다면
문턱도 **k배**가 된다. 정독 기준 10 tok/s 는 k=3 이면 30 tok/s 다.

**k 를 여기서는 재지 않았다.** 그러므로 이 문서가 말하는 문턱은 「읽는 글」에 한정된
주장이고, 훑는 출력에 그대로 옮기면 안 된다. k 를 채우려면 무엇이 필요한지는
[`data/reading-speed-sources.json`](../data/reading-speed-sources.json) 의 `skimming` 에 적어 뒀다.

---

## 출처와 한계

### English — 238 words/min
> Brysbaert, M. (2019). How many words do we read per minute? A review and meta-analysis of reading rate. Journal of Memory and Language, 109, 104047.
> <https://doi.org/10.1016/j.jml.2019.104047>
**근거**: 190 studies, 18,573 participants. Silent reading of non-fiction: 238 wpm (fiction: 260 wpm).
**한계**:
- Adult first-language readers. Second-language reading is substantially slower.
- Range 175-300 wpm covers most adults; the mean is not a personal prediction.

### 한국어 — 549.7 chars/min
> 송지호, 김재형, 형성민 (2016). 한국어 읽기 속도 측정 애플리케이션의 유효성 및 정상인의 읽기 속도에 대한 사전 연구. 대한안과학회지, 57(4), 642-649.
> <https://www.jkos.org/upload/pdf/JKOS057-04-17.pdf>
**근거**: n=42 (남 25 / 여 17), 노안 없는 정상 시력. Table 3 (reading only), 10 pt: 549.7 ± 348.9 LPM / 202.3 ± 88.4 WPM.
**한계**:
- 안과 근거리 시기능 검사다. 아이패드를 40 cm 거리에서 보며 평균 18.9 음절짜리 단문을 읽는 조건이므로, 긴 산문을 지속해서 읽는 속도와 같다고 볼 수 없다.
- 표준편차가 평균의 63% 다 (±348.9). 개인차가 평균값을 압도한다 — 이 수치는 인구 평균이지 당신의 속도가 아니다.
- 글자 크기에 따라 467-579 LPM 사이에서 움직인다. 10 pt 는 논문 초록이 대표값으로 든 행이다.
- 20-39세 대상. 고령층 데이터 아님.

### 출처를 확보하지 못한 언어

- **日本語** — 신뢰할 만한 성인 묵독 속도 1차 출처를 아직 확보하지 못했다. 검색에서 나온 수치들은 제2언어 학습자 대상이거나 저시력 임상 검사의 최대 속도라 일반 성인 묵독 기준으로 쓸 수 없다. IReST (Trauzettel-Klosinski & Dietz, 2012) 에 일본어판이 있으므로 그 규준값을 확인하는 것이 다음 단계다.
- **中文 (简体)** — 위와 같다. 검색에서 나온 259.5 자/분은 저시력 연구의 maximum reading speed 라 일반 묵독 속도가 아니다. IReST 중국어판 규준값 확인 필요.

이 언어들은 토큰 밀도는 실측값을 쓰지만 **읽기 속도 기준선은 기본값 없이** 나간다.
근거 없는 기본값을 넣는 것이 기준선을 비워 두는 것보다 나쁘다 — 기준선이 이 제품의 전부이기 때문이다.

---

## 왜 평균을 믿으면 안 되는가

한국어 출처의 표준편차는 평균의 63%다 (549.7 ± 348.9 자/분). 영어 쪽도 대부분의 성인이
175~300 wpm 에 흩어진다. **인구 평균은 당신의 판정 기준이 아니다.**

⇒ 사이트는 이 값을 **슬라이더의 초기값으로만** 쓰고, 사용자가 자기 읽기 속도를 직접 재서
덮어쓸 수 있게 한다. 개인차가 평균을 압도하는 지표에서는 그게 유일하게 정직한 설계다.

---

## 이 수치를 인용한다면

이 문서의 수치는 **CC BY 4.0** 이다 — 쓰는 데 허락이 필요 없고, 출처 표기만 요구한다.

> Yang, J. (2026). *tokenpace: 언어별 토큰 밀도와 tok/s 로 환산한 읽기 속도*
> (측정 2026-09-02). Zenodo. <https://doi.org/10.5281/zenodo.22265787>

기계가 읽는 형식은 [`CITATION.cff`](../CITATION.cff) 에 있다 (CFF 1.2.0).

---
---

# Reading speed, in tok/s

[한국어 ↑](#읽기-속도--toks-환산) · **English**

- **Measured**: 2026-09-02
- **Reproduce**: `cd tools && npm run derive`
- **Inputs**: [`data/reading-speed-sources.json`](../data/reading-speed-sources.json) (hand-curated
  sourced constants) × [`docs/token-density.md`](token-density.md) (measured density)

tok/s is a unit on the model's side; reading speed is a unit on the human side.
Putting them on one axis takes token density, and density differs by tokenizer,
so **the conversion differs by tokenizer too.** There is no single number here.

---

## How many tok/s does a person read at?

| Tokenizer | English | Korean |
|---|---:|---:|
| GPT-4o / GPT-5 (o200k_base) | 4.73 | 5.38 |
| GPT-4 / GPT-3.5 (cl100k_base) | 4.84 | 8.96 |
| Llama 3.1 | 4.84 | 5.50 |
| Qwen3 | 4.88 | 6.00 |
| Gemma 3 | 4.93 | 4.93 |
| Mistral Small 3 | 4.91 | 4.72 |

**This table is the project's conclusion.** Whichever language and whichever
tokenizer you convert through, reading speed lands between
**4.7 and 9.0 tok/s**. On the current tokenizer
(o200k_base) it is 4.7 tok/s in English and 5.4 tok/s
in Korean — **effectively the same**. Two languages that differ threefold in
characters per second overlap once converted to tok/s, because the tokenizer
tracks information density to a degree.

The 50, 100 and 300 tok/s that inference services advertise are
**6× to 64×** human reading speed.

⇒ **For prose you read down**, "you never wait while reading" was achieved long
ago, and raising decoding speed further does not change it. What is left of the
felt experience is **time to first token** and **how long the answer is**, not
tok/s.

### If you are not the average reader (sensitivity)

What matters is how much of this conclusion hangs on one mean. Re-derived at
both ends of the published spread (o200k_base):

- **English** across the spread around 238 words/min → **3.48 to 5.97 tok/s**
- **Korean** across the spread around 549.7 chars/min → **1.97 to 8.8 tok/s**

⇒ **The verdict at 35 tok/s does not change at either end.** The only lane that
flips is the 5 tok/s one, which is why that lane is on the page. What the
conclusion rests on is the order of magnitude, not the mean — and that is why
measuring your own speed sits above the population average in the interface.

### Does another corpus change it? (sensitivity 2)

The density came from translated conference subtitles (TED2020). Re-deriving it
from prose written directly in each language
([`corpus/samples/`](../corpus/README.md)):

- **Korean** 5.38 → **5.08 tok/s** (chars per token 1.70 → 1.80)

⇒ The order of magnitude does not move, so the corpus does not decide the
conclusion. Why it does not is measured in
[`docs/token-density.md`](token-density.md) §4: most of that difference is
speech versus writing rather than translation. (English converts through words
rather than characters, so it is not in this table.)

### Where this conclusion stops — skimming

This is **reading** speed, not **skimming** speed. For output the eye skips
through — code, tables, long lists — human throughput rises, and tok/s comes
back into how fast it feels.

How the threshold moves is just arithmetic: if skimming takes text in at **k
times** reading speed, the threshold is **k times** higher. 10 tok/s for reading
becomes 30 tok/s at k=3.

**k is not measured here.** So the threshold in this document is a claim about
text that is read, and must not be carried over to output that is skimmed. What
it would take to fill in k is written down under `skimming` in
[`data/reading-speed-sources.json`](../data/reading-speed-sources.json).

---

## Sources and their limits

### English — 238 words/min
> Brysbaert, M. (2019). How many words do we read per minute? A review and meta-analysis of reading rate. Journal of Memory and Language, 109, 104047.
> <https://doi.org/10.1016/j.jml.2019.104047>
**Basis**: 190 studies, 18,573 participants. Silent reading of non-fiction: 238 wpm (fiction: 260 wpm).
**Limits**:
- Adult first-language readers. Second-language reading is substantially slower.
- Range 175-300 wpm covers most adults; the mean is not a personal prediction.

### Korean — 549.7 chars/min
> 송지호, 김재형, 형성민 (2016). 한국어 읽기 속도 측정 애플리케이션의 유효성 및 정상인의 읽기 속도에 대한 사전 연구. 대한안과학회지, 57(4), 642-649.
> <https://www.jkos.org/upload/pdf/JKOS057-04-17.pdf>
**Basis**: n=42 (25 men / 17 women), normal near vision without presbyopia. Table 3 (reading only) at 10 pt: 549.7 ± 348.9 characters/min, 202.3 ± 88.4 words/min.
**Limits**:
- This is an ophthalmic near-vision assessment. Participants read short sentences averaging 18.9 syllables from an iPad at 40 cm, which is not the same activity as sustained reading of long prose.
- The standard deviation is 63% of the mean (±348.9). Individual variation overwhelms the average — this is a population figure, not a prediction about you.
- The rate moves between 467 and 579 characters/min with type size. 10 pt is the row the paper's own abstract quotes.
- Participants were 20-39 years old. There is no data here for older readers.

### Languages with no source yet

- **Japanese** — No trustworthy primary source for adult silent reading has been secured. The figures that turn up are either for second-language learners or are maximum reading speeds from low-vision clinical testing, neither of which is a general adult silent-reading rate. IReST (Trauzettel-Klosinski & Dietz, 2012) has a Japanese edition, so checking its norm values is the next step.
- **Chinese (Simplified)** — As above. The 259.5 characters/min figure that turns up is a maximum reading speed from low-vision research, not a silent-reading rate. The Chinese IReST norms need checking.

These languages use measured token density but ship **no reading baseline**.
An unsourced default would be worse than an empty one, because the baseline is
what this product is.

---

## Why not to trust the average

The Korean source's standard deviation is 63% of its mean (549.7 ± 348.9
characters/min). English readers likewise scatter across 175-300 wpm.
**A population average is not your threshold.**

⇒ The site uses these values **only as the slider's starting position**, and
lets you measure your own reading speed and overwrite them. On a measure whose
individual variation overwhelms its average, that is the only honest design.

---

## Citing these figures

The figures in this document are **CC BY 4.0**: use them without asking, name
where they came from.

> Yang, J. (2026). *tokenpace: token density by language, and reading speed
> converted to tok/s* (measured 2026-09-02). Zenodo. <https://doi.org/10.5281/zenodo.22265787>

The machine-readable form is [`CITATION.cff`](../CITATION.cff) (CFF 1.2.0).
