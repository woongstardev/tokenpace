# corpus

토큰 밀도를 재는 데 쓰는 텍스트. 두 종류가 있고 취급이 다르다.

## 1. `samples/` — 커밋된다 (CC0)

같은 뜻으로 한국어·영어를 **직접 작성한** 병렬 샘플. 문체별로 나뉜다.

| 파일 | 문체 | 왜 있나 |
|---|---|---|
| `explainer.{ko,en}.txt` | 설명문 | LLM 이 실제로 가장 많이 뱉는 형태 |
| `chat.{ko,en}.txt` | 대화체 | 짧은 턴, 종결어미 밀도가 높다 |
| `technical.{ko,en}.txt` | 기술문서 + 코드 | 코드 블록이 섞이면 밀도가 영어 쪽으로 끌려간다 |

번역이 아니라 **양쪽을 각각 자연스럽게 쓴 것**이다. 기계번역체는 원어민이 쓰는 문장과
토큰 밀도가 다르게 나오므로, 번역 코퍼스만으로 재면 실사용 밀도를 과소평가한다.

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

한계: 구어체 강연이라 문어체·코드·목록이 없다. 그 편차를 메우는 것이 위의 `samples/` 다.

## 재현

```
cd tools
npm ci
npm run all      # fetch-corpus → measure → derive
```

결과는 [`docs/token-density.md`](../docs/token-density.md) 와
[`docs/reading-speed.md`](../docs/reading-speed.md) 에 덮어쓰인다. 둘 다 생성물이므로
직접 고치지 말고 스크립트를 고쳐라.
