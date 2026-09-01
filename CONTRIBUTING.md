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

**A sourced reading baseline for a new language.** This is the top of the list.
It needs a peer-reviewed measurement of adult silent reading speed with a
sample size and a stated population — see the entries in
`data/reading-speed-sources.json` for the shape. Second-language-learner studies
and low-vision clinical maxima do not qualify; both were rejected already.

**A tokenizer worth adding.** Add it to `TOKENIZERS` in
`tools/corpus-config.mjs`. The Hugging Face repository must be ungated: a
reproduction that requires an account is not a reproduction.

**Evidence a measurement is wrong.** Genuinely welcome. Run `npm run all` and
show the diff, or point at the methodology. The corpus is spoken-register
translated prose, which is a real limitation.

**UI language beyond ko/en.** Requires a full string set in `assets/js/i18n.js`
*and* rule 2 satisfied.

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
