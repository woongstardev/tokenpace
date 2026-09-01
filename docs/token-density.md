<!-- GENERATED FILE — edit tools/measure-density.mjs, then re-run `npm run measure`. -->

# 토큰 밀도 실측 (token density)

- **측정일**: 2026-09-01
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
같은 뜻으로 직접 작성한 병렬 샘플([`corpus/samples/`](../corpus/samples/), CC0)로 따로 잰다.

| 문체 | 영어 | 한국어 | 격차 |
|---|---:|---:|---:|
| chat | 4.31 | 1.41 | 3.05× |
| explainer | 5.08 | 1.71 | 2.97× |
| technical | 4.72 | 2.19 | 2.16× |

---

## 출처·라이선스

- 코퍼스: TED2020 — Reimers & Gurevych (2020), [OPUS](https://opus.nlpl.eu/TED2020/).
  원문 TED 자막은 CC BY-NC-ND 4.0 이므로 **이 리포에 본문을 담지 않는다.** 내려받는 스크립트와
  체크섬만 커밋한다.
- 토크나이저: OpenAI 계열은 [gpt-tokenizer](https://github.com/niieani/gpt-tokenizer) (MIT, tiktoken 포팅).
  나머지는 Hugging Face Hub 의 `tokenizer.json`. **게이트 없는 리포만 쓴다** — 재현에 HF 계정이
  필요해지면 재현이 아니다. Llama·Gemma 는 같은 파일의 커뮤니티 미러를 읽는다.
- 이 문서의 수치: CC BY 4.0.
