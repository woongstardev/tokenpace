/**
 * Shared configuration for the measurement harness.
 *
 * Everything that decides what gets measured lives here, so a reviewer can see
 * the whole experimental setup in one file instead of reading two scripts.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const CACHE_DIR = path.join(REPO_ROOT, 'corpus', 'cache');
export const SAMPLES_DIR = path.join(REPO_ROOT, 'corpus', 'samples');

/** Sentence pairs kept per language pair. Large enough that the ratio is stable
 *  to three significant figures; small enough that a full run stays under a minute. */
export const SAMPLE_SIZE = 3000;

/**
 * Parallel corpora. TED2020 (OPUS) is professionally translated spoken prose —
 * genuinely parallel, which is what the cross-language ratio claim needs.
 *
 * Licence: TED talk transcripts, CC BY-NC-ND 4.0. We measure but do not
 * redistribute; `corpus/cache/` is gitignored.
 * Source: https://opus.nlpl.eu/TED2020/  (Reimers & Gurevych, 2020)
 *
 * sha256 is recorded on first run. If upstream republishes the archive the
 * next run fails loudly rather than silently changing the published numbers.
 */
export const PARALLEL_SETS = [
  {
    id: 'ted2020-en-ko',
    lang: 'ko',
    url: 'https://object.pouta.csc.fi/OPUS-TED2020/v1/moses/en-ko.txt.zip',
    enSide: 'en',
    otherSide: 'ko',
    sha256: 'c7bda45c82aa8a57d662ece2a58ec11826a161628423e20bd58cbdd692e77cbf',
  },
  {
    id: 'ted2020-en-ja',
    lang: 'ja',
    url: 'https://object.pouta.csc.fi/OPUS-TED2020/v1/moses/en-ja.txt.zip',
    enSide: 'en',
    otherSide: 'ja',
    sha256: 'a9d523aadb0ed6040a4755132c353c5380c260a36fc87d46fa16314c964aac7b',
  },
  {
    id: 'ted2020-en-zh',
    lang: 'zh',
    url: 'https://object.pouta.csc.fi/OPUS-TED2020/v1/moses/en-zh_cn.txt.zip',
    enSide: 'en',
    otherSide: 'zh_cn',
    sha256: 'f1a4e205458d67318d1eee31121c5350b3748caa2bca654a6b52a4a69e8d6202',
  },
];

/**
 * Tokenizers.
 *
 * `gpt` entries come from the vendored pure-JS port of tiktoken; `hf` entries
 * load a tokenizer.json straight from the Hub. Only ungated repos are listed —
 * a reproduction must not require a Hugging Face account, so the Llama and
 * Gemma tokenizers are read from community mirrors of the same files.
 *
 * **Every Hub entry is pinned to a commit.** Without `revision`, the loader
 * takes whatever is at the branch head, so a repository owner editing
 * tokenizer.json would change figures published under a fixed measurement
 * date. The weekly reproduction would go red, correctly, but with nothing to
 * say about why — a pinned revision turns "the numbers moved" into "this
 * tokenizer moved, here is the commit we measured". Pins are verified: the
 * loader 404s on a revision that does not exist rather than falling back.
 *
 * Refresh one with:
 *   curl -s https://huggingface.co/api/models/<repo> | jq -r .sha
 * and re-run the pipeline. If the figures change, that is the finding.
 *
 * ── Which six, and for how long ──────────────────────────────────────────
 *
 * The roster is a claim that these are the tokenizers a reader is likely to
 * be choosing between, and that claim expires. It is not a claim that these
 * are the best models. An entry earns its place by being a tokenizer many
 * people are actually served by, and by being reachable without an account.
 *
 * Add one when a family in wide use is not represented by any listed entry —
 * different vocabulary size or different segmentation behaviour on non-Latin
 * script, not merely a newer checkpoint of a family already here. Replace one
 * when a listed family ships a successor with a different tokenizer; keep the
 * old row only while people are still running it. Six is not a target, but
 * every added row is another column readers have to scan.
 *
 * tools/check-freshness.mjs reports how old the measurement is, in the weekly
 * job. It cannot know that a new model shipped — nothing here can. What it can
 * do is make the age impossible to miss when someone looks.
 */
export const TOKENIZERS = [
  { id: 'o200k_base',    label: 'GPT-4o / GPT-5 (o200k_base)',   kind: 'gpt', encoding: 'o200k_base' },
  { id: 'cl100k_base',   label: 'GPT-4 / GPT-3.5 (cl100k_base)', kind: 'gpt', encoding: 'cl100k_base' },
  { id: 'llama-3.1',     label: 'Llama 3.1',  kind: 'hf', repo: 'unsloth/Meta-Llama-3.1-8B-Instruct', revision: 'a2856192dd7c25b842431f39c179a6c2c2f627d1' },
  { id: 'qwen-3',        label: 'Qwen3',      kind: 'hf', repo: 'Qwen/Qwen3-8B', revision: 'b968826d9c46dd6066d109eabc6255188de91218' },
  { id: 'gemma-3',       label: 'Gemma 3',    kind: 'hf', repo: 'unsloth/gemma-3-4b-it', revision: 'bf46152c47f5dd20b896357cb51abc4c03b8ee8c' },
  { id: 'mistral-small', label: 'Mistral Small 3', kind: 'hf', repo: 'unsloth/Mistral-Small-24B-Instruct-2501', revision: '2eddef095b2d91c22c59cc3ede00ec595e530d16' },
];

/** Built-in demo texts, in the order the site offers them. The first is the
 *  default: the register an LLM answer is most likely to be in. */
export const SAMPLE_ORDER = ['explainer', 'chat', 'technical'];

/** Languages reported, in display order. */
export const LANGUAGES = [
  { id: 'en', label: 'English' },
  { id: 'ko', label: '한국어' },
  { id: 'ja', label: '日本語' },
  { id: 'zh', label: '中文 (简体)' },
];
