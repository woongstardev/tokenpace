# AGENTS.md

Instructions for automated contributors working in this repository. Human
contributors should read [CONTRIBUTING.md](CONTRIBUTING.md); everything there
applies here too.

## What this repository is

A static site that measures how a tokens-per-second figure translates into
something a person can read, per language and per tokenizer. The measurements
are the product; the page is how they are shown.

## Before changing anything

Read [`docs/BRIEF.md`](docs/BRIEF.md). It is the canonical statement of scope
and of which decisions are already settled. If a change contradicts it, the
BRIEF is amended in the same commit or the change is wrong.

## Verify with

```sh
node --test "tests/*.test.mjs"
node tools/check-site.mjs
```

`check-site.mjs` enforces the invariants that a general-purpose linter cannot:
zero external requests, an intact vendored tokenizer, generated files marked as
generated, resolving links, and no shipped measurement without a citation.

## Constraints that will fail review

- **Do not invent a number.** Every figure is regenerable from `tools/` or cited
  in `data/reading-speed-sources.json` with its limits. If the source is
  missing, ship the gap and say so — Japanese and Chinese reading baselines are
  deliberately absent for exactly this reason.
- **Do not add a runtime dependency, CDN reference, or web font.** The page
  fetches nothing off-origin.
- **Do not add storage, analytics, or a backend.** State belongs in the URL.
- **Do not hand-edit generated files.** `assets/data/*` and the generated
  documents come from `cd tools && npm run all`.
- **Do not soften an approximation label.** The page states which fidelity
  produced what is on screen.

## Editing generated output

Change the script or the input data, re-run `npm run all` in `tools/`, and
commit the regenerated files alongside the cause.

## Commits

Stage explicit paths. `git commit -a` and `git commit -am` are not used here —
a commit should contain what its message says it contains, and nothing that was
merely open in the working tree at the time.

Say what changed and why it changed. If a commit fixes something that failed
silently, the message is the only place a future reader learns that it can.
