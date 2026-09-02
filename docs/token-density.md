<!-- GENERATED FILE — edit tools/measure-density.mjs, then re-run `npm run measure`. -->

# 토큰 밀도 실측 (token density)

**한국어** · [English ↓](#token-density-measured)

> 영문 절은 113행부터입니다 — `# Token density, measured` 를 찾으십시오.

- **측정일**: 2026-09-02
- **재현**: `cd tools && npm ci && npm run fetch-corpus && npm run measure`
- **코퍼스**: TED2020 (OPUS), 언어쌍별 3,000 문장쌍을 고정 stride 로 표본 추출.
  아카이브 sha256 은 [`corpus/CHECKSUMS.json`](../corpus/CHECKSUMS.json) 에 고정돼 있다.
- **집계**: 문장별 토큰 수의 합 / 문자 수의 합. 문자는 UTF-16 단위가 아니라 **유니코드 코드포인트**로 센다.
  특수 토큰은 제외한다.

---

## 1. 자/토큰 — 토큰 하나가 화면에 찍는 글자 수

tok/s 를 화면에서의 초당 글자 수로 바꿀 때 쓰는 계수다. **크면 빠르게 보인다.**

| 토크나이저 | English | 한국어 | 日本語 | 中文 (简体) |
|---|---:|---:|---:|---:|
| GPT-4o / GPT-5 (o200k_base) | 4.65 | 1.70 | 1.33 | 1.30 |
| GPT-4 / GPT-3.5 (cl100k_base) | 4.54 | 1.02 | 0.96 | 0.87 |
| Llama 3.1 | 4.54 | 1.67 | 1.45 | 1.28 |
| Qwen3 | 4.51 | 1.53 | 1.50 | 1.53 |
| Gemma 3 | 4.46 | 1.86 | 1.89 | 1.57 |
| Mistral Small 3 | 4.48 | 1.94 | 1.38 | 1.15 |

## 2. 토큰 비율 — 같은 내용을 쓰는 데 드는 토큰 수 (영어 = 1.00)

API 청구서에 찍히는 축이다. **크면 비싸다.** 1번 표의 역수가 아니다 —
언어마다 같은 내용을 담는 데 필요한 글자 수 자체가 다르기 때문이다.

| 토크나이저 | English | 한국어 | 日本語 | 中文 (简体) |
|---|---:|---:|---:|---:|
| GPT-4o / GPT-5 (o200k_base) | 1.00× | 1.39× | 1.45× | 1.17× |
| GPT-4 / GPT-3.5 (cl100k_base) | 1.00× | 2.26× | 1.96× | 1.72× |
| Llama 3.1 | 1.00× | 1.39× | 1.30× | 1.17× |
| Qwen3 | 1.00× | 1.50× | 1.25× | 0.97× |
| Gemma 3 | 1.00× | 1.23× | 0.98× | 0.94× |
| Mistral Small 3 | 1.00× | 1.18× | 1.35× | 1.28× |

## 3. 문체별 편차 (o200k_base, 자/토큰)

TED2020 은 구어체 산문이다. LLM 이 실제로 쏟아내는 설명문·코드·대화는 밀도가 다르므로,
같은 뜻으로 직접 작성한 병렬 샘플([`corpus/samples/`](../corpus/README.md), CC0)로 따로 잰다.

| 문체 | 영어 | 한국어 | 격차 |
|---|---:|---:|---:|
| chat | 4.31 | 1.41 | 3.05× |
| explainer | 5.08 | 1.71 | 2.97× |
| technical | 4.72 | 2.19 | 2.16× |

## 4. 코퍼스를 바꾸면 얼마나 달라지나 — 번역문 대 직접 쓴 글

TED2020 의 비영어 쪽은 **번역문**이고 구어(강연 자막)다. `corpus/samples/` 는 각 언어로
**직접 쓴** 문어다. 실사용 밀도를 번역 코퍼스로 재는 것이 맞느냐는 물음에는 재서 답한다.

| 언어 | TED2020 (번역·구어) | samples (직접 쓴 문어) | 차이 | 토크나이저 6종 범위 |
|---|---:|---:|---:|---:|
| English | 4.64 | 4.77 | +2.7% | +2.7% ~ +6.4% |
| 한국어 | 1.70 | 1.80 | +5.9% | +1.8% ~ +15.2% |

**영어가 대조군이다.** TED2020 의 영어 쪽은 번역이 아니라 원문이다. 그런데도 직접 쓴 영어와
+2.7% ~ +6.4% 벌어진다. 그러니 이 차이의 대부분은 *번역이라서* 생긴 것이 아니라
**구어 자막 대 문어**라는 문체 차이다. 번역에 돌릴 수 있는 몫은 한국어가 영어보다 **더**
움직인 만큼뿐이고, 그 초과분은 토크나이저에 따라 -3.5 ~ +9.8 포인트다 — 음수인
토크나이저에서는 한국어가 영어보다 덜 움직였다는 뜻이므로 번역에 돌릴 몫이 아예 남지 않는다.

**크기의 순서가 결론이다.** 한국어 자/토큰을 흔드는 세 가지를 같은 축에 놓으면
(o200k_base, 직접 쓴 표본 기준):

| 무엇을 바꾸나 | 자/토큰이 움직이는 폭 |
|---|---:|
| 코퍼스 (번역 구어 → 직접 쓴 문어) | +5.9% |
| 문체 (대화체 → 기술문서) | +54.9% |
| 토크나이저 (cl100k_base → Mistral Small 3) | +89.9% |

⇒ 코퍼스 선택은 셋 중 **가장 작은** 변수다. 나머지 둘은 이미 화면에서 사용자가 직접 고른다.

⚠️ **한계**: 직접 쓴 표본은 한국어 1,242자 · 영어 2,276자로
TED2020 표본(언어쌍당 3,000 문장)보다 두 자릿수 작다. 위 수치는 방향과 자릿수를 보기 위한 것이지
세 자리 유효숫자로 쓸 값이 아니다. 더 큰 모국어 작성 코퍼스가 있으면 이 절은 다시 재야 한다.

---

## 출처·라이선스

- 코퍼스: TED2020 — Reimers & Gurevych (2020), [OPUS](https://opus.nlpl.eu/TED2020/).
  원문 TED 자막은 CC BY-NC-ND 4.0 이므로 **이 리포에 본문을 담지 않는다.** 내려받는 스크립트와
  체크섬만 커밋한다.
- 토크나이저: OpenAI 계열은 [gpt-tokenizer](https://github.com/niieani/gpt-tokenizer) (MIT, tiktoken 포팅).
  나머지는 Hugging Face Hub 의 `tokenizer.json`. **게이트 없는 리포만 쓴다** — 재현에 HF 계정이
  필요해지면 재현이 아니다. Llama·Gemma 는 같은 파일의 커뮤니티 미러를 읽는다.
- 이 문서의 수치: CC BY 4.0.

---

## 이 수치를 인용한다면

이 문서의 수치는 **CC BY 4.0** 이다 — 쓰는 데 허락이 필요 없고, 출처 표기만 요구한다.

> Yang, J. (2026). *tokenpace: 언어별 토큰 밀도와 tok/s 로 환산한 읽기 속도*
> (측정 2026-09-02). <https://tokenpace.woongstar.com/>

기계가 읽는 형식은 [`CITATION.cff`](../CITATION.cff) 에 있다 (CFF 1.2.0).

---
---

# Token density, measured

[한국어 ↑](#토큰-밀도-실측-token-density) · **English**

- **Measured**: 2026-09-02
- **Reproduce**: `cd tools && npm ci && npm run fetch-corpus && npm run measure`
- **Corpus**: TED2020 (OPUS), 3,000 sentence pairs per language pair, sampled at
  a fixed stride. Archive sha256 values are pinned in
  [`corpus/CHECKSUMS.json`](../corpus/CHECKSUMS.json).
- **Aggregation**: sum of tokens over sum of characters, per sentence.
  Characters are counted as **Unicode code points**, not UTF-16 units. Special
  tokens are excluded.
- **Tokenizer pins**: every Hub tokenizer is pinned to a commit, recorded per
  row in [`data/token-density.json`](../data/token-density.json), and checked
  weekly against upstream by `tools/check-freshness.mjs`.

---

## 1. Characters per token — how much text one token renders as

The coefficient that turns tok/s into characters per second on screen.
**Bigger looks faster.**

| Tokenizer | English | Korean | Japanese | Chinese (Simplified) |
|---|---:|---:|---:|---:|
| GPT-4o / GPT-5 (o200k_base) | 4.65 | 1.70 | 1.33 | 1.30 |
| GPT-4 / GPT-3.5 (cl100k_base) | 4.54 | 1.02 | 0.96 | 0.87 |
| Llama 3.1 | 4.54 | 1.67 | 1.45 | 1.28 |
| Qwen3 | 4.51 | 1.53 | 1.50 | 1.53 |
| Gemma 3 | 4.46 | 1.86 | 1.89 | 1.57 |
| Mistral Small 3 | 4.48 | 1.94 | 1.38 | 1.15 |

## 2. Token ratio — tokens for the same meaning (English = 1.00)

The axis your API bill is on. **Bigger is more expensive.** It is not the
reciprocal of table 1: the number of characters each language needs to carry
the same meaning differs in the first place.

| Tokenizer | English | Korean | Japanese | Chinese (Simplified) |
|---|---:|---:|---:|---:|
| GPT-4o / GPT-5 (o200k_base) | 1.00× | 1.39× | 1.45× | 1.17× |
| GPT-4 / GPT-3.5 (cl100k_base) | 1.00× | 2.26× | 1.96× | 1.72× |
| Llama 3.1 | 1.00× | 1.39× | 1.30× | 1.17× |
| Qwen3 | 1.00× | 1.50× | 1.25× | 0.97× |
| Gemma 3 | 1.00× | 1.23× | 0.98× | 0.94× |
| Mistral Small 3 | 1.00× | 1.18× | 1.35× | 1.28× |

## 3. Variation by register (o200k_base, characters per token)

TED2020 is spoken prose. The explanations, code and dialogue an LLM actually
emits have different density, so parallel samples written directly for this
purpose ([`corpus/samples/`](../corpus/README.md), CC0) are measured
separately.

| Register | English | Korean | Gap |
|---|---:|---:|---:|
| chat | 4.31 | 1.41 | 3.05× |
| explainer | 5.08 | 1.71 | 2.97× |
| technical | 4.72 | 2.19 | 2.16× |

## 4. How much does the corpus choice move this? Translation versus writing

TED2020's non-English side is **translated**, and it is speech (talk
subtitles). `corpus/samples/` is prose **written directly** in each language.
The question of whether real-world density should be measured on a translation
corpus is answered by measuring it.

| Language | TED2020 (translated, spoken) | samples (written directly) | Difference | Range over six tokenizers |
|---|---:|---:|---:|---:|
| English | 4.64 | 4.77 | +2.7% | +2.7% ~ +6.4% |
| Korean | 1.70 | 1.80 | +5.9% | +1.8% ~ +15.2% |

**English is the control.** TED2020's English side is the original, not a
translation, and it still moves by +2.7% ~ +6.4%. So most of this
difference is not *because it is translated* — it is **spoken subtitles versus
written prose**. What can be attributed to translation is only the amount by
which Korean moves **more** than English, and that excess runs
-3.5 ~ +9.8 포인트 depending on the tokenizer. Where it is negative,
Korean moved less than English and there is nothing left to attribute at all.

**The ordering is the answer.** Putting the three things that move Korean
characters-per-token on one axis (o200k_base, against the directly written
samples):

| What changes | How far chars/token moves |
|---|---:|
| Corpus (translated speech → written prose) | +5.9% |
| Register (dialogue → technical writing) | +54.9% |
| Tokenizer (cl100k_base → Mistral Small 3) | +89.9% |

⇒ The corpus is the **smallest** of the three. The other two are already
chosen by the reader on the page.

⚠️ **Limit**: the directly written samples are 1,242 Korean and
2,276 English characters, two orders of magnitude smaller than
the TED2020 sample of 3,000 sentence pairs per pair. These figures are for
direction and magnitude, not for quoting to three significant figures. A larger
natively written corpus would mean re-measuring this section.

---

## Sources and licences

- Corpus: TED2020 — Reimers & Gurevych (2020), [OPUS](https://opus.nlpl.eu/TED2020/).
  The underlying TED subtitles are CC BY-NC-ND 4.0, so **the text is not carried
  in this repository.** The download script and the checksums are.
- Tokenizers: the OpenAI encodings come from
  [gpt-tokenizer](https://github.com/niieani/gpt-tokenizer) (MIT, a port of
  tiktoken). The rest are `tokenizer.json` files from the Hugging Face Hub.
  **Only ungated repositories are used** — a reproduction that needs an account
  is not one — so Llama and Gemma are read from community mirrors of the same
  files.
- The figures in this document: CC BY 4.0.

---

## Citing these figures

The figures in this document are **CC BY 4.0**: use them without asking, name
where they came from.

> Yang, J. (2026). *tokenpace: token density by language, and reading speed
> converted to tok/s* (measured 2026-09-02). <https://tokenpace.woongstar.com/>

The machine-readable form is [`CITATION.cff`](../CITATION.cff) (CFF 1.2.0).
