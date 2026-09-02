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

**6. Every measured input is pinned, and something notices when it moves.**
Corpus archives are pinned by sha256 in `corpus/CHECKSUMS.json`. Hub tokenizers
are pinned to a commit in `tools/corpus-config.mjs` — without that, the loader
takes the branch head and a figure published under a fixed date can change
under it. `tools/check-freshness.mjs` runs weekly and compares the tokenizer
files at the pin against the ones at the head, so an upstream edit is reported
with the file that moved rather than showing up as an unexplained diff.

## What language things are written in

This project is bilingual on purpose, and the split is not arbitrary: **English
where someone has to read it to use or contribute to the project, Korean where
Korean is the subject or the private record.**

| | Language |
|---|---|
| README, this file, code of conduct, licences | English |
| Issues, pull requests, code comments | English |
| **Commit messages** | English, from 2026-09-03 |
| The two measurement documents and `corpus/README.md` | **Both**, in one file |
| The interface | Both, by toggle (`assets/js/i18n.js`) |
| `docs/BRIEF.md` — the project's own scope record | Korean |

Two of those are worth explaining.

**The measurement documents are bilingual in one file, not two.** They are the
citation surface: the page's footer links to them from the English interface as
well as the Korean one, and until 2026-09-03 an English-speaking reader who
followed "reproduce the numbers" arrived at a document they could not read.
Splitting them into `token-density.md` and `token-density.en.md` would have
fixed that and split the citations across two URLs — for a project whose stated
goal is to be cited, one stable URL per measurement is worth more than a
shorter page. Both halves are generated from the same data by the same script,
so they cannot disagree about a number.

**Commit messages switched to English on 2026-09-03.** Earlier history is
Korean and stays that way; rewriting published history to translate it would
cost more than it is worth and break every existing link to a commit. The
reason for switching is that the commits here are not one-liners — they carry
the reasoning behind decisions, which makes them documentation, and the rest of
the documentation a contributor reads is already English.

## Adding, replacing or removing a tokenizer

The roster of six is a claim that these are what a reader is choosing between,
and that claim expires. It is not a claim that they are the best models.

- **Add** one when a family in wide use is not represented — a different
  vocabulary size, or different segmentation on non-Latin script. A newer
  checkpoint of a family already listed is not a reason; the tokenizer is
  usually the same file.
- **Replace** one when a listed family ships a successor with a genuinely
  different tokenizer. Keep the old row only while people are still running it.
- The repository must be **ungated**. A reproduction that needs a Hugging Face
  account is not a reproduction, which is why Llama and Gemma are read from
  community mirrors of the same files.
- Pin the commit: `curl -s https://huggingface.co/api/models/<repo> | jq -r .sha`,
  then `cd tools && npm run all`. If the published figures move, that is the
  finding — say so in the pull request rather than burying it in a regenerated
  table.

Nothing in CI can tell you that a new model family shipped. What CI does is
refuse to let the age of the measurement go unnoticed: past 180 days the weekly
run says so, and past a year it fails, which is a request for a person to look.

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
- **Silent reading of continuous prose, with the eyes moving normally.** Not
  oral reading, not word lists, not RSVP (words flashed one at a time in a fixed
  spot, which suppresses eye movements), and not a clinical *maximum* — those
  are ceilings, not habitual rates. The gap is not small: an RSVP study of
  Korean reports 296 wpm where the study we use reports 202.
- **Reports n and a spread** (SD, or a range). A mean with no spread cannot be
  published here: the site shows how far the conclusion moves across the spread,
  and with no spread there is nothing honest to show.
- **A DOI or a stable URL**, so a reader can check us.

Three candidates have already been rejected on these grounds — a
learner-population study, a low-vision maximum, and an RSVP maximum. Every
rejection is recorded in `data/reading-speed-sources.json` with its numbers and
its reason (see `consideredAndRejected` under `ko`, and `reason` under the
unavailable languages). Read those first: they say more about the bar than this
list does, and one of them is probably the paper you were about to send.

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
