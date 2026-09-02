<!-- GENERATED FILE — edit data/reading-speed-sources.json, then re-run `npm run derive`. -->

# 읽기 속도 → tok/s 환산

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

⇒ 디코딩 속도를 더 올려도 「읽는 동안 기다리지 않는다」는 이미 오래전에 달성됐다.
남은 체감 변수는 **첫 토큰까지의 대기(TTFT)** 와 **응답의 길이**지 tok/s 가 아니다.

⚠️ 단, 이것은 **읽는 속도**지 **훑는 속도**가 아니다. 코드·표·긴 목록처럼 눈으로 건너뛰며
읽는 출력에서는 사람의 유효 처리 속도가 훨씬 높아지고, 그때는 tok/s 가 다시 체감에 들어온다.

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
