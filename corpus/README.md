# corpus

**한국어** · [English ↓](#corpus-english)

토큰 밀도를 재는 데 쓰는 텍스트. 두 종류가 있고 취급이 다르다.

## 1. `samples/` — 커밋된다 (CC0)

같은 뜻으로 한국어·영어를 **직접 작성한** 병렬 샘플. 문체별로 나뉜다.

| 파일 | 문체 | 왜 있나 |
|---|---|---|
| `explainer.{ko,en}.txt` | 설명문 | LLM 이 실제로 가장 많이 뱉는 형태 |
| `chat.{ko,en}.txt` | 대화체 | 짧은 턴, 종결어미 밀도가 높다 |
| `technical.{ko,en}.txt` | 기술문서 + 코드 | 코드 블록이 섞이면 밀도가 영어 쪽으로 끌려간다 |

번역이 아니라 **양쪽을 각각 자연스럽게 쓴 것**이다.

이 문단은 오래 **재보지 않은 주장**이었다 — 「번역 코퍼스로만 재면 실사용 밀도를
과소평가한다」고 적어 두고 그 차이를 잰 적이 없었다. 2026-09-03 에 쟀고, 결과는
[`docs/token-density.md`](../docs/token-density.md) §4 에 있다. 요약하면:

- 방향은 맞다. 직접 쓴 글이 TED2020 보다 자/토큰이 크다 (한국어 +5.9%, o200k_base).
- **크기는 작다.** 같은 축에서 문체는 ±55%, 토크나이저는 ±90% 를 움직인다.
- 그리고 그 차이는 대체로 **번역 때문이 아니다.** TED2020 의 영어 쪽은 원문인데도 같은 방향으로
  +2.7~6.4% 움직인다 — 즉 재고 있던 것은 번역체가 아니라 **구어 자막 대 문어**다.

⇒ `samples/` 가 있어야 하는 이유는 여전하지만, 그 이유는 「번역체 보정」이 아니라
**문체 커버리지**다. 위 문장을 그렇게 고쳤다.

라이선스: **CC0 1.0** (public domain dedication). 마음대로 가져다 써라.

## 2. `cache/` — 커밋되지 않는다

TED2020 (OPUS) 병렬 코퍼스. `tools/fetch-corpus.mjs` 가 내려받는다.

- 출처: [OPUS TED2020](https://opus.nlpl.eu/TED2020/) — Reimers & Gurevych (2020)
- 원문: TED 강연 자막, **CC BY-NC-ND 4.0**

ND(No Derivatives) 조건이 붙어 있으므로 **표본을 추출해 이 리포에 담지 않는다.**
대신 아카이브의 sha256 을 [`CHECKSUMS.json`](CHECKSUMS.json) 에 고정한다. 재현하는 쪽은
같은 아카이브를 받아 같은 stride 로 같은 표본을 얻는다 — 무작위 추출을 쓰지 않는 이유다.

### 왜 TED2020 인가

언어 간 밀도 비율을 주장하려면 **같은 내용의 병렬 텍스트**여야 한다. 각 언어에서 따로 모은
텍스트를 비교하면 재는 것이 언어 차이인지 주제 차이인지 갈라낼 수 없다.

FLORES-200 이 이 용도의 표준이지만 Hugging Face 에서 gated 라 계정 없이 못 받는다.
**재현에 계정이 필요하면 재현이 아니다** — 그래서 게이트 없는 TED2020 을 골랐다.

한계: 구어체 강연이라 문어체·코드·목록이 없고, 비영어 쪽은 번역문이다. 그 편차를 메우는 것이
위의 `samples/` 이고, 편차가 실제로 얼마인지는 [`docs/token-density.md`](../docs/token-density.md) §4 에
재서 적어 뒀다 — 결론을 흔들 크기는 아니다.

## 재현

```
cd tools
npm ci
npm run all      # fetch-corpus → measure → derive
```

결과는 [`docs/token-density.md`](../docs/token-density.md) 와
[`docs/reading-speed.md`](../docs/reading-speed.md) 에 덮어쓰인다. 둘 다 생성물이므로
직접 고치지 말고 스크립트를 고쳐라.

---
---

# corpus (English)

[한국어 ↑](#corpus) · **English**

The text the token-density figures are measured on. Two kinds, handled
differently.

## 1. `samples/` — committed (CC0)

Parallel samples **written directly** in Korean and English to say the same
thing, split by register.

| File | Register | Why it exists |
|---|---|---|
| `explainer.{ko,en}.txt` | Explanation | The shape an LLM answer most often takes |
| `chat.{ko,en}.txt` | Dialogue | Short turns, dense in sentence endings |
| `technical.{ko,en}.txt` | Technical writing with code | Code blocks pull density toward the English figure |

These are not translations of each other; each side was written naturally in
its own language.

This paragraph used to carry an assertion nobody had measured — that measuring
only on a translation corpus underestimates real-world density. It was measured
on 2026-09-03; the result is in
[`docs/token-density.md`](../docs/token-density.md) §4. In short:

- The direction was right. Directly written text has more characters per token
  than TED2020 (Korean +5.9% on o200k_base).
- **The size is small.** On the same axis, register moves it ±55% and the
  tokenizer ±90%.
- And the difference is mostly **not** translation. TED2020's English side is
  the original and still moves in the same direction by +2.7 to +6.4%, so what
  was being measured is spoken subtitles versus written prose.

⇒ `samples/` still needs to exist, but the reason is **register coverage**, not
correcting for translationese. The sentence above was changed to say so.

Licence: **CC0 1.0** (public domain dedication). Take them.

## 2. `cache/` — not committed

The TED2020 parallel corpus from OPUS, downloaded by `tools/fetch-corpus.mjs`.

- Source: [OPUS TED2020](https://opus.nlpl.eu/TED2020/) — Reimers & Gurevych (2020)
- Underlying text: TED talk subtitles, **CC BY-NC-ND 4.0**

The No-Derivatives term means **a sampled subset cannot be republished here**.
What is committed instead is the sha256 of each archive, in
[`CHECKSUMS.json`](CHECKSUMS.json). A reproduction downloads the same archive
and takes the same sample at the same stride — which is why the sampling is a
fixed stride and not random.

### Why TED2020

Claiming a density ratio between languages requires **parallel text of the same
content**. Comparing text collected separately per language cannot separate a
language difference from a topic difference.

FLORES-200 is the usual corpus for this, and it is gated behind a Hugging Face
login. **A reproduction that needs an account is not a reproduction**, so the
ungated TED2020 was chosen instead.

Limits: it is spoken conference prose, so it has no written register, no code
and no lists, and its non-English sides are translations. `samples/` above
covers that gap, and how large the gap actually is was measured — see
[`docs/token-density.md`](../docs/token-density.md) §4. Not large enough to move
the conclusion.

## Reproducing

```
cd tools
npm ci
npm run all      # fetch-corpus → measure → derive
```

The results overwrite [`docs/token-density.md`](../docs/token-density.md) and
[`docs/reading-speed.md`](../docs/reading-speed.md). Both are generated, so edit
the scripts rather than the documents.
