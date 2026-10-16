# Reach snapshots

`snapshots.csv` is a weekly record of how far this repository and its DOI have
reached: one row per UTC date, written by
[`tools/snapshot-reach.mjs`](../tools/snapshot-reach.mjs) from the
[weekly workflow](../.github/workflows/reach.yml).

It exists because GitHub keeps traffic for 14 days and then discards it. The
question "did announcing this do anything" gets asked weeks later, when the
platform no longer has the answer. This file does.

## This is not page analytics

Every number here is one GitHub or Zenodo already counts about the repository
and the deposit, read back from their APIs. The site itself still fetches
nothing, stores nothing and reports nothing — see
[CONTRIBUTING.md, rules 3 and 4](../CONTRIBUTING.md#the-rules-that-are-not-negotiable).
Nothing in this directory is deployed (`.assetsignore`).

## Columns

| Column | Meaning | Limits |
|---|---|---|
| `date` | UTC date of the sample | A re-run on the same date replaces that row. |
| `stars` | GitHub stargazers | Current total, not a window. |
| `forks` | GitHub forks | Current total. |
| `watchers` | People watching the repository (`subscribers_count`) | GitHub's `watchers_count` is an alias for stars and is not used. |
| `views_14d` / `views_uniques_14d` | Repository page views, and unique visitors, over the last 14 days | A rolling window ending on the sample date, which is partial. Weekly samples overlap by about 7 days, so **rows must not be summed**. |
| `clones_14d` / `clones_uniques_14d` | `git clone`s, and unique cloners, over the last 14 days | Same window. Mostly mirrors, package indexers and scanners rather than people; a rise here is weak evidence of anything. |
| `zenodo_views` / `zenodo_unique_views` | Views of the Zenodo record, all versions of the concept DOI [10.5281/zenodo.22265787](https://doi.org/10.5281/zenodo.22265787) | Cumulative. Zenodo updates its statistics with a lag of about a day, so a sample can trail the GitHub columns. **Empty** means Zenodo could not be read that day, not zero. |
| `zenodo_downloads` / `zenodo_unique_downloads` | File downloads from the Zenodo record, all versions | Cumulative, same lag. |

Zenodo also reports `version_*` figures for the latest release alone. They are
not recorded: they reset with every release, and the concept is what gets cited.

## Running it

```sh
cd tools && npm run reach
```

Needs a GitHub token with push access to this repository — the traffic
endpoints refuse anything less. It reads `GITHUB_TOKEN` or `GH_TOKEN`, and
otherwise asks `gh auth token`. Any GitHub HTTP error or missing field stops
the run with a non-zero exit and leaves the file as it was: a row of zeros from
a failed request would be an invented number, and a plausible-looking one.

Zenodo failing does not stop it. Its four cells are left empty and a warning is
printed (an annotation in Actions), and the GitHub columns are written anyway:
they vanish after 14 days, while Zenodo's are cumulative and the next row
recovers them. Treat an empty cell as missing, never as zero.
