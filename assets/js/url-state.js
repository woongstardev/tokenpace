/**
 * url-state.js — the whole configuration lives in the query string.
 *
 * There is no storage of any kind: no localStorage, no cookies, no server. A
 * shared link is the only way state travels, which keeps the page honest about
 * having nothing to remember about anyone.
 *
 * Every value is validated on the way in. A hand-edited URL should degrade to
 * the default rather than render something nonsensical.
 */

export const DEFAULTS = {
  lang: 'ko',
  sample: 'explainer',
  tokenizer: 'o200k_base',
  speeds: [5, 10, 35],
  // A setting, not a measurement. Nothing here has measured a representative
  // TTFT and one number could not be representative anyway — see
  // data/ttft-sources.json, which check-site.mjs holds this literal to.
  ttft: 1,
  reading: null, // null = use the sourced default for the language
  theme: 'auto',
};

const MAX_LANES = 5;
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

function num(raw, { min, max, fallback, integer = false }) {
  const v = Number(raw);
  if (!Number.isFinite(v)) return fallback;
  const c = clamp(v, min, max);
  return integer ? Math.round(c) : c;
}

export function readState(search = window.location.search, { languages, tokenizers, samples }) {
  const p = new URLSearchParams(search);
  const state = { ...DEFAULTS };

  const lang = p.get('lang');
  if (languages.includes(lang)) state.lang = lang;

  const sample = p.get('text');
  if (sample === 'custom' || samples.includes(sample)) state.sample = sample;

  const tok = p.get('tok');
  if (tokenizers.includes(tok)) state.tokenizer = tok;

  const tps = p.get('tps');
  if (tps) {
    const parsed = tps
      .split(',')
      .map((s) => num(s, { min: 1, max: 500, fallback: null, integer: true }))
      .filter((n) => n !== null)
      .slice(0, MAX_LANES);
    if (parsed.length) state.speeds = parsed;
  }

  if (p.has('ttft')) state.ttft = num(p.get('ttft'), { min: 0, max: 10, fallback: DEFAULTS.ttft });
  if (p.has('read')) state.reading = num(p.get('read'), { min: 50, max: 3000, fallback: null });

  const theme = p.get('theme');
  if (['auto', 'light', 'dark'].includes(theme)) state.theme = theme;

  return state;
}

/** Serialise, omitting anything still at its default so shared links stay short. */
export function toSearch(state) {
  const p = new URLSearchParams();
  if (state.lang !== DEFAULTS.lang) p.set('lang', state.lang);
  if (state.sample !== DEFAULTS.sample) p.set('text', state.sample);
  if (state.tokenizer !== DEFAULTS.tokenizer) p.set('tok', state.tokenizer);
  if (String(state.speeds) !== String(DEFAULTS.speeds)) p.set('tps', state.speeds.join(','));
  if (state.ttft !== DEFAULTS.ttft) p.set('ttft', String(state.ttft));
  if (state.reading !== null) p.set('read', String(Math.round(state.reading)));
  if (state.theme !== DEFAULTS.theme) p.set('theme', state.theme);
  const q = p.toString();
  return q ? `?${q}` : '';
}

/** Keep the address bar current without pushing history entries for every drag. */
export function syncUrl(state) {
  const url = `${window.location.pathname}${toSearch(state)}`;
  window.history.replaceState(null, '', url);
}
