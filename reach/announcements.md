# Announcement drafts

Drafts for the first public posts about tokenpace. Nothing here has been
posted; posting is a human decision and a one-time event per venue, so the
order below matters: a small venue first, read what people push back on, then
the venue you only get one shot at.

Every figure comes from `docs/reading-speed.md` and `docs/token-density.md`.
If those change, these drafts are stale, not the other way round.

The tone rule from BRIEF §2-4 applies: show the measurement, not a verdict.
A post that argues "speed races are pointless" is the thing the site refuses
to be.

Suggested order: 1 → read reactions for a week → 2 → 3 is never a post, it
is a reply you leave wherever the question comes up.

---

## 1. GeekNews (news.hada.io) — 한국어

**제목 (발견을 제목으로, 도구명은 뒤로):**

> 사람이 읽는 속도는 약 5 tok/s — 한국어도 영어도 (토크나이저 6종 실측)

**링크:** https://tokenpace.woongstar.com/

**본문:**

LLM 벤치마크는 tok/s 로 말하고 사람은 글자로 읽습니다. 둘을 한 축에 올리려면
토크나이저가 필요하고, 그 환산값은 토크나이저에 따라 2배까지 움직입니다.

그래서 재봤습니다. 토크나이저 6종 × 4개 언어 × 언어당 문장쌍 3,000개.

- 자/토큰 (o200k_base): 영어 4.65 · 한국어 1.70 · 일본어 1.33 · 중국어 1.30
- 같은 내용을 쓰면 한국어는 영어보다 토큰이 1.39배 — API 요금은 그만큼 더 나옵니다
- 그런데 **읽기 속도를 tok/s 로 환산하면 영어 4.7, 한국어 5.4 — 사실상 같습니다.**
  자/초로는 3배 갈리는 두 언어가 tok/s 에서는 겹칩니다. 토크나이저가 정보 밀도를
  어느 정도 따라가기 때문입니다.
- 토크나이저 전부로 보면 4.7 ~ 9.0 tok/s 범위

사이트는 그 읽기 속도 레인을 tok/s 레인 옆에 같이 달리게 해 둔 것입니다. 정독하는
산문 기준으로 10 tok/s 쯤부터 모델이 사람을 앞서고, 그 다음부터 체감은 첫 토큰까지의
대기(TTFT)와 답의 길이에서 옵니다. TTFT 도 한 대(RTX 3090)에서 실측해 두었는데
상수가 아닙니다.

한계도 적어 둡니다. 읽기 속도 출처는 영어 메타분석 1건(238 wpm)과 한국어 n=42
연구 1건이고 개인차가 평균의 60% 를 넘습니다 — 인구 평균이지 당신의 속도가
아닙니다. 코드·표처럼 훑어 읽는 출력은 문턱이 올라가는데 그 배수는 재지 않았습니다.
일본어·중국어 읽기 기준선은 믿을 출처를 못 찾아 비워 두었습니다.

재현: `cd tools && npm ci && npm run all`. 코드 MIT, 측정값 CC BY 4.0,
DOI 10.5281/zenodo.22265787. 페이지는 외부 요청 0, 분석 도구 0 입니다.

---

## 2. r/LocalLLaMA — English

**Title:**

> I measured how many tok/s a person actually reads at. It's about 5 — in English and, surprisingly, in Korean too.

**Body:**

Every "is X tok/s enough?" thread here ends with someone saying "faster than you
can read" without a number. I wanted the number, so I measured the conversion.

tok/s is a model-side unit; reading speed is a human-side unit (words or
characters per minute). Converting one into the other needs a tokenizer, and
the result moves by 2× depending on which one. So: 6 tokenizers × 4 languages ×
3,000 sentence pairs per language.

- chars per token (o200k_base): English 4.65 · Korean 1.70 · Japanese 1.33 · Chinese 1.30
- the same content costs 1.39× the tokens in Korean vs English
- **reading speed converted to tok/s: English 4.7, Korean 5.4 — effectively the
  same.** Two languages that differ 3× in chars/sec overlap once you convert to
  tok/s, because the tokenizer partly tracks information density.
- across all six tokenizers the range is 4.7 – 9.0 tok/s

So on prose you actually read, somewhere past ~10 tok/s the model is already
ahead of you, and what you still feel is time-to-first-token and how long the
answer is. I measured TTFT on one box (RTX 3090) too; it is not a constant.

Limits, stated up front: the reading-speed sources are one English
meta-analysis (238 wpm) and one Korean study (n=42), and individual variance
is >60% of the mean — it's a population figure, not yours. Code, tables and
lists get skimmed, which raises the threshold by some factor I have not
measured. No trustworthy Japanese/Chinese reading baseline was found, so those
lanes are deliberately empty rather than guessed.

Site: https://tokenpace.woongstar.com/ (the reading-speed lane runs next to
the tok/s lanes; no analytics, no external requests, state is in the URL).
Repo + reproduction scripts: https://github.com/woongstardev/tokenpace —
MIT code, CC BY 4.0 measurements, DOI 10.5281/zenodo.22265787.

Happy to be told the methodology is wrong; that is what the sources file is for.

---

## 3. Reply template — for "how many tok/s is enough?" threads

Not a post. Leave it where the question is asked, and only when it answers the
question. Three sentences, one link.

> Silent reading of prose converts to roughly 5 tok/s (4.7 English, 5.4 Korean
> on o200k_base; 4.7–9.0 across tokenizers), so past ~10 tok/s the model is
> already ahead of a reader and what you notice is TTFT and answer length. That
> is for prose you read; code and tables you skim, which raises the bar by a
> factor nobody has measured yet. Measurement + sources:
> https://tokenpace.woongstar.com/

---

## 4. Show HN — later

Only after 1 and 2, with whatever objection came up most folded into the
first paragraph. One shot per project; do not spend it first.

Working title: *Show HN: Tokenpace – how fast a tok/s figure is, measured against reading speed*
