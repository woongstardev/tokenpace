# Licensing

Three licences, because the parts have different jobs. Code should be trivial to
reuse; measurements should be citable; sample text should have no strings at all.

| What | Licence | Why |
|---|---|---|
| Code — `assets/js/`, `assets/css/`, `index.html`, `tools/` | [MIT](LICENSE) | Take it, fork it, no obligations beyond attribution. |
| Measurements and documentation — `data/`, `docs/` | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | These exist to be cited. Attribution is the only thing asked for. |
| Sample texts — `corpus/samples/` | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | Written for this project as test fixtures. Nobody should have to think about them. |

## Third-party code

| Component | Licence | Where |
|---|---|---|
| [gpt-tokenizer](https://github.com/niieani/gpt-tokenizer) by Bazyli Brzoska | MIT | Vendored into `assets/vendor/gpt-tokenizer/`, pinned by `VENDOR.json`, licence text kept alongside. Re-vendor with `npm run vendor -- --apply` in `tools/`. |

## Data measured but not redistributed

The TED2020 corpus (via [OPUS](https://opus.nlpl.eu/TED2020/)) derives from TED
talk transcripts licensed **CC BY-NC-ND 4.0**. No-derivatives means a sampled
subset cannot be republished here, so the repository carries the download
script and the archive checksums instead of the text. See
[`corpus/README.md`](corpus/README.md).

## What this project deliberately does not do

`jimmyboudoux/token-speed-visualizer` was the closest prior art and a useful
structural reference. It carries **no licence declaration**, which means all
rights reserved, so no code was taken from it. Anything that looks similar is
convergent — there are only so many ways to lay out a lane of streaming text.
