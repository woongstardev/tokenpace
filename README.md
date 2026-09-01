# tokenpace

**How fast is a tok/s number, really — in your language, against your reading speed?**

Benchmarks report tokens per second. People read characters. Those two units do
not convert cleanly, and the conversion factor changes by a factor of two
depending on which tokenizer you ask. tokenpace measures the conversion, then
lets you watch the result stream past a baseline that is your own.

> Status: **pre-release.** Not deployed yet. Runs locally — see [Running it](#running-it).

---

## What is different here

Streaming-speed visualisers are a crowded genre. Three things in this one are
not in the others:

**1. Language is a first-class variable, and the numbers are measured.**
One token is 4.65 characters of English and 1.70 characters of Korean on
`o200k_base` — and 1.02 on `cl100k_base`. Every other tool in this category is
implicitly English-only. Ours ships six tokenizers × four languages, measured on
3,000 parallel sentence pairs each, with the script that produced them.

**2. TTFT is included.** The wait before the first token is most of what "slow"
feels like once decoding is fast, and the tools that mention it mostly exclude
it on purpose.

**3. There is a baseline.** "Is 35 tok/s fast" has no answer. "Does 35 tok/s
outrun me" does. Human reading speed converts to roughly **5 tok/s** — close
enough across English and Korean that the two overlap, which surprised us. The
page renders that as a lane you race against, and lets you replace the
population average with your own measured speed, because the published standard
deviation is 63% of the mean.

## The measurements

Full tables in [`docs/token-density.md`](docs/token-density.md) and
[`docs/reading-speed.md`](docs/reading-speed.md). The short version:

**Characters one token renders as**

| Tokenizer | English | 한국어 | 日本語 | 中文 |
|---|---:|---:|---:|---:|
| GPT-4o / GPT-5 (`o200k_base`) | 4.65 | 1.70 | 1.33 | 1.30 |
| GPT-4 (`cl100k_base`) | 4.54 | 1.02 | 0.96 | 0.87 |
| Llama 3.1 | 4.54 | 1.67 | 1.45 | 1.28 |
| Qwen3 | 4.51 | 1.53 | 1.50 | 1.53 |
| Gemma 3 | 4.46 | 1.86 | 1.89 | 1.57 |
| Mistral Small 3 | 4.48 | 1.94 | 1.38 | 1.15 |

**Reading speed, expressed as tok/s**

| | English | 한국어 |
|---|---:|---:|
| `o200k_base` | 4.7 | 5.4 |
| across all six tokenizers | 4.7 – 4.9 | 4.7 – 9.0 |

Sources: [Brysbaert 2019](https://doi.org/10.1016/j.jml.2019.104047) (238 wpm,
190 studies, n=18,573) and [송지호 외 2016](https://www.jkos.org/upload/pdf/JKOS057-04-17.pdf)
(549.7 chars/min, n=42). Japanese and Chinese ship **without** a reading
baseline: no source we trust was found, and a plausible-looking invented default
would be worse than an empty field. The reasoning is recorded in
[`data/reading-speed-sources.json`](data/reading-speed-sources.json).

## Reproducing the numbers

Nothing here is a figure someone typed in. Everything regenerates:

```sh
cd tools
npm ci
npm run all      # fetch corpora → measure density → derive reading pace → build site data
```

Three properties make that a real reproduction rather than a gesture:

- **No randomness.** The corpus sample is a fixed stride, so two runs pick the
  same sentences.
- **Pinned inputs.** Archive checksums live in
  [`corpus/CHECKSUMS.json`](corpus/CHECKSUMS.json); if upstream republishes, the
  run fails instead of quietly changing the published figures.
- **No account required.** FLORES-200 is the usual corpus for this and it is
  gated behind a Hugging Face login, so we use TED2020 instead. A reproduction
  that needs credentials is not one.

## Running it

The site is plain HTML, CSS and ES modules. There is no build step and no
runtime dependency — but ES modules need a real origin, so serve the directory
rather than opening the file:

```sh
python3 -m http.server 8000
# http://localhost:8000
```

Tests:

```sh
node --test "tests/*.test.mjs"   # unit tests
node tools/check-site.mjs        # project invariants: no external requests, intact vendor, live links
node tools/check-a11y.mjs        # axe, across light / dark / reduced-motion / 390px
```

CI runs all three on every push, and re-derives every published figure from the
raw corpora weekly — if a fresh run ever disagrees with what is committed, the
numbers in `docs/` have stopped being reproducible and the build fails.

## How it is built

```
index.html              the whole page
assets/
  css/app.css           one stylesheet, light and dark
  js/
    main.js             wiring: state → render, event handlers
    engine.js           the streaming clock (see below)
    token-pieces.js     splitting text into tokens, exactly and approximately
    tokenize.js         choosing between precomputed / exact / approximate
    i18n.js             ko + en strings
    url-state.js        the entire configuration, in the query string
    reading-test.js     measuring your own reading speed
  data/                 GENERATED — density figures and pre-tokenised samples
  vendor/               GENERATED — the tokenizer, vendored (MIT)
corpus/                 sample texts (CC0) + checksums for the downloaded corpus
data/                   GENERATED measurements + hand-curated sources
docs/                   GENERATED reports
tools/                  the measurement harness
tests/                  node:test
```

**The clock.** Every lane is a pure function of elapsed wall-clock time:
`due(t) = floor((t − ttft) × tok/s)`. Nothing accumulates per frame, so a
dropped frame cannot desynchronise two lanes, and a 120 Hz display does not run
the animation at double speed. Hidden tabs throttle `requestAnimationFrame` to
about 1 Hz, so the clock stops on `visibilitychange` and says how long it was
paused instead of dumping the backlog on return.

**Token boundaries.** Byte-level BPE splits a Hangul syllable across two tokens
routinely, and decoding a prefix that ends mid-character puts a replacement
character *in the middle* of the string, not at the end. The obvious
delta-by-length approach corrupts the output while the final decode still
matches — so the obvious integrity check passes and the bug ships. It did ship,
briefly; [`assets/js/token-pieces.js`](assets/js/token-pieces.js) explains the
fix and [`tests/site.test.mjs`](tests/site.test.mjs) pins it.

**Accessibility.** The page is an animation by nature, which makes
`prefers-reduced-motion` a correctness requirement rather than a nicety. Under
it, the lanes become a table of timed snapshots carrying the same information.
`aria-live` is on the verdict, never on the streaming text — announcing every
token would make a screen reader unusable.

**Privacy.** No backend, no analytics, no cookies, no storage. State lives in
the URL, which is also how sharing works. The Content Security Policy in
[`_headers`](_headers) blocks every external origin, and there is nothing in the
page that would want one.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). The most useful contributions are a
sourced reading-speed baseline for a new language, a tokenizer worth adding, or
a demonstration that one of the measurements is wrong.

## Licence

Code MIT, measurements CC BY 4.0, sample texts CC0. Details and third-party
notices in [LICENSES.md](LICENSES.md).
