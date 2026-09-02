# Contributing

Thanks for looking. This project has an unusual centre of gravity: the code is
small and the *numbers* are the product. That shapes what is easy to accept.

## Setup

```sh
git clone <this repo> && cd tokenpace
cd tools && npm ci && cd ..

python3 -m http.server 8000     # the site, at http://localhost:8000
node --test "tests/*.test.mjs"  # unit tests
node tools/check-site.mjs       # project invariants
node tools/check-a11y.mjs       # axe audit (needs a local Chrome; set CHROME= if not found)
```

No build step for the site. `tools/` has dependencies; the page has none.

## The rules that are not negotiable

These are not style preferences. Each one is load-bearing for the project's
claim to be a reference rather than a toy.

**1. No number ships without a source or a script.**
Either it comes out of `tools/` and can be regenerated, or it has a citation in
`data/reading-speed-sources.json` with its limits written down. A figure that is
neither is a figure someone made up.

**2. A missing source means a missing feature, not a plausible default.**
Japanese and Chinese have measured token density but no reading baseline,
because no trustworthy source was found. They ship without the baseline. Filling
that gap with a number that looks about right would be the single worst thing
this project could do.

**3. The page makes zero external requests.**
No CDN, no web font, no analytics, no error reporting. `tools/check-site.mjs`
enforces this. If you need a dependency at runtime, vendor it — see
`tools/vendor-tokenizer.mjs` — and it must be a licence we can redistribute.

**4. No backend, no storage.**
State goes in the URL. Not localStorage, not cookies, not a session. This is
what makes "we collect nothing" a structural fact rather than a promise.

**5. Approximations are labelled on screen.**
The page says which of precomputed / exact / approximate produced what you are
looking at. Silently degrading fidelity is how a measurement tool becomes a
vibes tool.

## What is most useful

**A sourced reading baseline.** This is the top of the list, and it has its own
section below — the reading baseline is the one number this whole project rests
on, and right now it rests on less than it should.

**A tokenizer worth adding.** Add it to `TOKENIZERS` in
`tools/corpus-config.mjs`. The Hugging Face repository must be ungated: a
reproduction that requires an account is not a reproduction.

**Evidence a measurement is wrong.** Genuinely welcome. Run `npm run all` and
show the diff, or point at the methodology. The corpus is spoken-register
translated prose, which is a real limitation.

**UI language beyond ko/en.** Requires a full string set in `assets/js/i18n.js`
*and* rule 2 satisfied.

## Wanted: reading-speed sources

This is the most valuable thing anyone can bring, and it needs a library card
more than it needs a compiler.

Every verdict on the site is drawn against a reading-speed baseline. Two of the
four measured languages have no baseline at all, and the one for Korean rests on
a single small study. We would rather say that plainly than paper over it — but
we would rather fix it.

### The gaps, in priority order

1. **Japanese and Chinese.** Token density is measured for both, and both ship
   with no baseline and an empty verdict. `IReST` (Trauzettel-Klosinski & Dietz,
   2012, [10.1167/iovs.11-8284](https://doi.org/10.1167/iovs.11-8284)) is the
   most promising lead: it standardises difficulty-matched passages across 17
   languages, which is exactly the property this comparison needs. The norm
   values are in the paper. Nobody here has read it yet.
2. **A second Korean source.** The current one is n=42 from an ophthalmology
   study — near-vision testing on short sentences, not sustained prose. It is
   the best primary source we found, and one study is not a literature. Korean
   reading-research venues (KCI) are the obvious place to look.
3. **A better English source** is not needed. Brysbaert (2019) is a
   meta-analysis of 190 studies, n=18,573.

### What a source has to clear

All of these, because a baseline that fails any one of them would quietly make
the site wrong rather than visibly incomplete:

- **Primary and peer-reviewed.** Not a blog, not a citation of a citation.
- **Adult, first-language readers.** Second-language-learner rates measure
  something else and are substantially slower.
- **Silent reading of continuous prose.** Not oral reading, not word lists, not
  a low-vision clinical *maximum* — those are ceilings, not habitual rates.
- **Reports n and a spread** (SD, or a range). A mean with no spread cannot be
  published here: the site shows how far the conclusion moves across the spread,
  and with no spread there is nothing honest to show.
- **A DOI or a stable URL**, so a reader can check us.

Both a learner-population study and a low-vision maximum were already rejected
on these grounds. The rejections are recorded in
`data/reading-speed-sources.json` under each unavailable language — read those
before proposing something similar.

### How to add one

Add the language entry to `data/reading-speed-sources.json` following the shape
of `en` (a `range`) or `ko` (an `sd`, plus a derived `range` with `rangeBasis`
saying so). Fill in `caveats` honestly — the site prints them. Then:

```sh
cd tools && npm run derive && npm run build-site
```

Everything downstream is generated: never hand-edit `data/reading-pace.json`,
`docs/reading-speed.md`, or `assets/data/*.js`. A language ships to the UI only
once it has both a sourced baseline and a full string set (see rule 2).

### What is at stake, concretely

For Korean, ±1 SD around the mean spans **1.97 – 8.80 tok/s**. The verdict at
35 tok/s holds at either end; the 5 tok/s lane flips, which is why that lane is
on screen. So the conclusion is not fragile — but it is carried by one study,
and that is worth fixing rather than defending.

## What will be pushed back on

- A framework. The page is a few hundred lines; adding React would be the tail
  wagging the dog, and the zero-dependency property is a feature.
- A build step for the site. `tools/` generating data files is fine. Bundling,
  transpiling, or minifying the page is not.
- Analytics of any kind, including self-hosted.
- Making the headline more assertive. The site presents measurements and
  baselines and lets the reader conclude. It does not argue.

## Changing generated files

`assets/data/*`, `docs/token-density.md`, and `docs/reading-speed.md` are
generated. Edit the script or the source data, then:

```sh
cd tools && npm run all
```

Commit the regenerated output together with the change that caused it, so the
diff shows the effect.

## Tests

`tests/site.test.mjs` covers the arithmetic and string handling. Two of those
tests exist because they caught real bugs — a token-splitting error that
corrupted Korean text while passing its own integrity check, and an
approximation that ran 25% fast. If you touch `engine.js`, `token-pieces.js`, or
`url-state.js`, add the case that would have caught your mistake.

## Commits and review

Small commits, one concern each. Explain *why* in the message; the diff already
says what. Pull requests get read for correctness of the numbers first and style
second.

By contributing you agree your work is licensed as described in
[LICENSES.md](LICENSES.md).
