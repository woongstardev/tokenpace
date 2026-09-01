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
 */
export const TOKENIZERS = [
  { id: 'o200k_base',    label: 'GPT-4o / GPT-5 (o200k_base)',   kind: 'gpt', encoding: 'o200k_base' },
  { id: 'cl100k_base',   label: 'GPT-4 / GPT-3.5 (cl100k_base)', kind: 'gpt', encoding: 'cl100k_base' },
  { id: 'llama-3.1',     label: 'Llama 3.1',  kind: 'hf', repo: 'unsloth/Meta-Llama-3.1-8B-Instruct' },
  { id: 'qwen-3',        label: 'Qwen3',      kind: 'hf', repo: 'Qwen/Qwen3-8B' },
  { id: 'gemma-3',       label: 'Gemma 3',    kind: 'hf', repo: 'unsloth/gemma-3-4b-it' },
  { id: 'mistral-small', label: 'Mistral Small 3', kind: 'hf', repo: 'unsloth/Mistral-Small-24B-Instruct-2501' },
];

/** Languages reported, in display order. */
export const LANGUAGES = [
  { id: 'en', label: 'English' },
  { id: 'ko', label: '한국어' },
  { id: 'ja', label: '日本語' },
  { id: 'zh', label: '中文 (简体)' },
];
