/**
 * main.js — wiring.
 *
 * Structure: one `state` object, one `render()`, and event handlers that mutate
 * state and re-render. The streaming loop is the one exception — it writes
 * directly into the lane elements every frame, because rebuilding the DOM sixty
 * times a second to append a token would be absurd.
 */

import { MEASURED_AT, TOKENIZERS, READING_PACE } from '../data/density.js';
import { SAMPLES } from '../data/samples.js';
import { STRINGS, SAMPLE_LABELS, LANGUAGE_NAMES } from './i18n.js';
import { StreamClock, tokensDueAt, finishTime, runLoop, snapshotTimes } from './engine.js';
import { getPieces, canBeExact, ensureExact, isExactLoaded } from './tokenize.js';
import { readState, syncUrl, DEFAULTS } from './url-state.js';
import { ReadingTest } from './reading-test.js';

const LANGUAGES = Object.keys(STRINGS);
const SAMPLE_IDS = Object.keys(SAMPLES);
const MAX_LANES = 5;

const $ = (sel) => document.querySelector(sel);
const el = (tag, className, text) => {
  const n = document.createElement(tag);
  if (className) n.className = className;
  if (text !== undefined) n.textContent = text;
  return n;
};

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ══════════════════════════════════════════════════════════════════ state */

const state = {
  ...readState(window.location.search, {
    languages: LANGUAGES,
    tokenizers: TOKENIZERS.map((t) => t.id),
    samples: SAMPLE_IDS,
  }),
  customText: '',
  fidelity: 'precomputed',
  loadingExact: false,
  hiddenForSeconds: 0,
};

const t = () => STRINGS[state.lang];
const tokenizer = () => TOKENIZERS.find((x) => x.id === state.tokenizer) ?? TOKENIZERS[0];
const charsPerToken = () => tokenizer().charsPerToken[state.lang];
const pace = () => READING_PACE[state.lang];

/** Reading speed in the language's own unit — the slider value, or the source default. */
function readingRate() {
  return state.reading ?? pace().rate;
}

/**
 * Reading speed as tok/s.
 *
 * The published defaults already have a per-tokenizer conversion computed in
 * tools/derive-pace.mjs; a custom rate is scaled from it, which keeps the two
 * paths consistent instead of re-deriving the unit conversion here.
 */
function readingTokensPerSecond() {
  const p = pace();
  if (!p.available) return null;
  const base = p.tokensPerSecond[state.tokenizer];
  return (base * readingRate()) / p.rate;
}

function currentText() {
  if (state.sample === 'custom') return state.customText;
  return SAMPLES[state.sample]?.[state.lang]?.text ?? '';
}

function currentPieces() {
  const { pieces, fidelity } = getPieces({
    sampleId: state.sample === 'custom' ? null : state.sample,
    lang: state.lang,
    text: currentText(),
    tokenizerId: state.tokenizer,
    charsPerToken: charsPerToken(),
  });
  state.fidelity = fidelity;
  return pieces;
}

/** The lanes to race, baseline first so it reads as the reference line. */
function buildLanes() {
  const pieces = currentPieces();
  const total = pieces.length;
  const lanes = [];

  const readingTps = readingTokensPerSecond();
  if (readingTps) {
    lanes.push({
      id: 'baseline',
      isBaseline: true,
      label: t().baselineLane,
      tokensPerSecond: readingTps,
      ttftSeconds: 0,
      total,
      pieces,
    });
  }

  for (const speed of state.speeds) {
    lanes.push({
      id: `lane-${speed}`,
      isBaseline: false,
      label: t().laneSpeed(speed),
      tokensPerSecond: speed,
      ttftSeconds: state.ttft,
      total,
      pieces,
    });
  }
  return lanes;
}

/* ══════════════════════════════════════════════════════════════ rendering */

function applyStaticStrings() {
  const s = t();
  document.documentElement.lang = s.htmlLang;
  document.title = s.docTitle;

  for (const node of document.querySelectorAll('[data-i18n]')) {
    const value = s[node.dataset.i18n];
    if (typeof value === 'string') node.textContent = value;
  }
  for (const node of document.querySelectorAll('[data-i18n-aria]')) {
    const value = s[node.dataset.i18nAria];
    if (typeof value === 'string') node.setAttribute('aria-label', value);
  }
  for (const btn of document.querySelectorAll('.seg-btn[data-lang]')) {
    btn.setAttribute('aria-pressed', String(btn.dataset.lang === state.lang));
  }
  $('#footer-text').innerHTML = s.footer(MEASURED_AT);
}

function renderSelects() {
  const s = t();

  const sampleSel = $('#sample-select');
  sampleSel.replaceChildren(
    ...SAMPLE_IDS.map((id) => new Option(SAMPLE_LABELS[state.lang][id] ?? id, id, false, state.sample === id)),
    new Option(s.customText, 'custom', false, state.sample === 'custom')
  );

  const tokSel = $('#tokenizer-select');
  tokSel.replaceChildren(
    ...TOKENIZERS.map((tk) => new Option(tk.label, tk.id, false, tk.id === state.tokenizer))
  );

  $('#ttft-input').value = String(state.ttft);
  $('#ttft-output').textContent = `${state.ttft.toFixed(1)}s`;

  const p = pace();
  const readingInput = $('#reading-input');
  readingInput.disabled = !p.available;
  if (p.available) {
    const unit = p.unit === 'word' ? s.unitWordsPerMin : s.unitCharsPerMin;
    readingInput.min = p.unit === 'word' ? '60' : '150';
    readingInput.max = p.unit === 'word' ? '700' : '1600';
    readingInput.step = p.unit === 'word' ? '5' : '10';
    readingInput.value = String(Math.round(readingRate()));
    $('#reading-output').textContent = `${Math.round(readingRate())} ${unit}`;
    $('#reading-source-note').textContent =
      state.reading === null ? `${p.source.split('(')[0].trim()} · ` : '';
  } else {
    $('#reading-output').textContent = '—';
    $('#reading-source-note').textContent = p.reason ?? '';
  }

  $('#density-hint').textContent =
    `1 token ≈ ${charsPerToken().toFixed(2)} ${state.lang === 'ko' ? '자' : 'chars'} (${LANGUAGE_NAMES[state.lang][state.lang]})`;
}

function renderSpeedInputs() {
  const container = $('#speed-inputs');
  container.replaceChildren(
    ...state.speeds.map((speed, i) => {
      const row = el('div', 'speed-row');
      const input = el('input');
      input.type = 'number';
      input.min = '1';
      input.max = '500';
      input.value = String(speed);
      input.setAttribute('aria-label', `${t().laneSpeed(speed)}`);
      input.addEventListener('change', () => {
        const v = Math.round(Number(input.value));
        state.speeds[i] = Number.isFinite(v) ? Math.min(500, Math.max(1, v)) : speed;
        commit();
      });
      row.append(input, el('span', 'unit', 'tok/s'));

      if (state.speeds.length > 1) {
        const remove = el('button', 'icon-btn small', '×');
        remove.type = 'button';
        remove.setAttribute('aria-label', t().removeLane);
        remove.addEventListener('click', () => {
          state.speeds.splice(i, 1);
          commit();
        });
        row.append(remove);
      }
      return row;
    })
  );
  $('#add-lane').disabled = state.speeds.length >= MAX_LANES;
}

/** Custom-text editor lives below the select, only when 'custom' is chosen. */
function renderCustomInput() {
  const existing = $('#custom-text-wrap');
  if (state.sample !== 'custom') {
    existing?.remove();
    return;
  }
  if (existing) {
    // Already there — just retranslate it, without clobbering what was typed.
    existing.querySelector('label').textContent = t().customText;
    existing.querySelector('textarea').placeholder = t().customPlaceholder;
    return;
  }

  const wrap = el('div', 'field custom-text');
  wrap.id = 'custom-text-wrap';
  const label = el('label', null, t().customText);
  label.htmlFor = 'custom-text';
  const area = el('textarea');
  area.id = 'custom-text';
  area.rows = 5;
  area.placeholder = t().customPlaceholder;
  area.value = state.customText;
  area.addEventListener('input', () => {
    state.customText = area.value;
    scheduleRerender();
  });
  wrap.append(label, area);
  $('.control-grid').append(wrap);
}

let rerenderHandle = null;
function scheduleRerender() {
  if (rerenderHandle) clearTimeout(rerenderHandle);
  rerenderHandle = setTimeout(() => {
    rerenderHandle = null;
    renderLanes();
    renderVerdict();
    renderEvidence();
  }, 200);
}

/* ────────────────────────────────────────────────────────────────── lanes */

let laneNodes = [];
let stopLoop = null;
const clock = new StreamClock();

function renderLanes() {
  const lanes = buildLanes();
  const list = $('#lane-list');
  laneNodes = [];

  $('#reduced-motion-note').hidden = !prefersReducedMotion();

  if (prefersReducedMotion()) {
    list.replaceChildren(renderStaticTimeline(lanes));
    return;
  }

  list.replaceChildren(
    ...lanes.map((lane) => {
      const card = el('article', `lane${lane.isBaseline ? ' lane--baseline' : ''}`);

      const head = el('header', 'lane-head');
      head.append(el('h3', 'lane-title', lane.label));
      const meta = el('span', 'lane-meta');
      head.append(meta);
      card.append(head);

      const body = el('p', 'lane-text');
      card.append(body);

      const bar = el('div', 'lane-bar');
      const fill = el('div', 'lane-bar-fill');
      bar.append(fill);
      bar.setAttribute('role', 'progressbar');
      bar.setAttribute('aria-valuemin', '0');
      bar.setAttribute('aria-valuemax', '100');
      bar.setAttribute('aria-valuenow', '0');
      bar.setAttribute('aria-label', lane.label);
      card.append(bar);

      laneNodes.push({ lane, body, meta, fill, bar });
      return card;
    })
  );

  paintFrame(0);
}

/** Reduced-motion alternative: the same information as a table of snapshots. */
function renderStaticTimeline(lanes) {
  const times = snapshotTimes(lanes);
  const table = el('table', 'timeline');

  // The table scrolls sideways, so it has to be reachable by keyboard.
  table.tabIndex = 0;
  table.setAttribute('role', 'group');
  table.setAttribute('aria-label', t().lanesHeading);

  const thead = el('thead');
  const hrow = el('tr');
  // A visually empty corner cell still needs an accessible name.
  const corner = el('th');
  corner.scope = 'col';
  corner.append(el('span', 'sr-only', t().labelLanes));
  hrow.append(corner);
  for (const time of times) {
    const th = el('th', null, t().snapshotAt(time.toFixed(1)));
    th.scope = 'col';
    hrow.append(th);
  }
  thead.append(hrow);
  table.append(thead);

  const tbody = el('tbody');
  for (const lane of lanes) {
    const row = el('tr', lane.isBaseline ? 'row--baseline' : null);
    const rowHead = el('th', null, lane.label);
    rowHead.scope = 'row';
    row.append(rowHead);
    for (const time of times) {
      const due = tokensDueAt(lane, time);
      const cell = el('td');
      const pct = lane.total ? Math.round((due / lane.total) * 100) : 0;
      cell.append(el('span', 'cell-pct', `${pct}%`));
      cell.append(el('span', 'cell-text', lane.pieces.slice(0, due).join('').slice(-40)));
      row.append(cell);
    }
    tbody.append(row);
  }
  table.append(tbody);
  return table;
}

function paintFrame(elapsed) {
  for (const node of laneNodes) {
    const { lane, body, meta, fill, bar } = node;
    const due = tokensDueAt(lane, elapsed);
    const pct = lane.total ? (due / lane.total) * 100 : 0;

    if (node.lastDue !== due) {
      body.textContent = lane.pieces.slice(0, due).join('');
      node.lastDue = due;
    }
    fill.style.inlineSize = `${pct}%`;
    bar.setAttribute('aria-valuenow', String(Math.round(pct)));

    const waiting = elapsed < lane.ttftSeconds;
    const done = due >= lane.total;
    meta.textContent = waiting
      ? t().laneWaiting
      : done
        ? `${t().laneDone} · ${finishTime(lane).toFixed(1)}s`
        : `${due} / ${lane.total}`;
    node.body.classList.toggle('is-waiting', waiting);
  }
}

function play() {
  if (prefersReducedMotion()) return;
  stop();
  renderLanes();
  const lanes = laneNodes.map((n) => n.lane);
  if (!lanes.length || !lanes[0].total) return;

  const end = Math.max(...lanes.map(finishTime));
  clock.start();
  state.hiddenForSeconds = 0;
  $('#play').textContent = t().playing;

  stopLoop = runLoop(
    clock,
    (elapsed) => paintFrame(elapsed),
    (elapsed) => {
      if (elapsed < end) return false;
      paintFrame(end);
      finishRun();
      return true;
    }
  );
}

function finishRun() {
  clock.stop();
  stopLoop = null;
  $('#play').textContent = t().play;
  renderVerdict();
}

function stop() {
  if (stopLoop) stopLoop();
  stopLoop = null;
  clock.stop();
  $('#play').textContent = t().play;
}

// A hidden tab throttles rAF to about 1 Hz. Freezing the clock keeps the race
// intact; the note tells the reader why the numbers did not move.
document.addEventListener('visibilitychange', () => {
  if (!clock.running) return;
  if (document.hidden) {
    clock.pause();
  } else {
    const paused = clock.resume();
    if (paused > 0.5) {
      state.hiddenForSeconds = paused;
      $('#reduced-motion-note').hidden = false;
      $('#reduced-motion-note').textContent = t().resumedAfterHidden(paused.toFixed(1));
    }
  }
});

/* ──────────────────────────────────────────────────────────────── verdict */

function renderVerdict() {
  const box = $('#verdict');
  const readingTps = readingTokensPerSecond();
  const s = t();

  if (!readingTps) {
    box.replaceChildren(el('p', 'verdict-line', s.verdictNoReading));
    return;
  }

  const total = currentPieces().length;
  const p = pace();
  const unit = `${Math.round(readingRate())} ${p.unit === 'word' ? s.unitWordsPerMin : s.unitCharsPerMin}`;

  const nodes = [];
  const intro = el('p', 'verdict-intro');
  intro.innerHTML = s.verdictIntro(readingTps.toFixed(1), unit);
  nodes.push(intro);

  const readingSeconds = total / readingTps;

  for (const speed of state.speeds) {
    const ratio = speed / readingTps;
    const totalSeconds = state.ttft + total / speed;

    const row = el('div', `verdict-row ${ratio >= 1 ? 'is-ok' : 'is-slow'}`);
    const line = el('p', 'verdict-line');
    line.innerHTML = s.verdictRow(speed, ratio.toFixed(1));
    row.append(line);

    const timing = el('p', 'verdict-sub');
    timing.textContent = s.verdictTiming(
      totalSeconds.toFixed(1),
      state.ttft.toFixed(1),
      readingSeconds.toFixed(1)
    );
    row.append(timing);

    // The point the product is built to make: once decoding outruns reading,
    // the remaining wait is almost entirely the wait before it starts.
    if (state.ttft > 0 && ratio >= 1) {
      const share = (state.ttft / totalSeconds) * 100;
      const note = el('p', 'verdict-sub verdict-ttft');
      note.innerHTML = s.verdictTtftNote(Math.round(share));
      row.append(note);
    }
    nodes.push(row);
  }

  box.replaceChildren(...nodes);
}

/* ─────────────────────────────────────────────────────────────── evidence */

function renderEvidence() {
  const s = t();
  const box = $('#evidence');
  const nodes = [];

  const density = el('p', 'evidence-line');
  density.innerHTML = s.evidenceDensity(
    charsPerToken().toFixed(2),
    LANGUAGE_NAMES[state.lang][state.lang],
    tokenizer().label,
    MEASURED_AT
  );
  nodes.push(density);

  const p = pace();
  if (p.available) {
    const reading = el('p', 'evidence-line');
    const unit = p.unit === 'word' ? s.unitWordsPerMin : s.unitCharsPerMin;
    reading.innerHTML = s.evidenceReading(p.rate, unit, `<a href="${p.sourceUrl}">${p.source}</a>`);
    nodes.push(reading);
  }

  const fidelity = el('p', `evidence-line fidelity fidelity--${state.fidelity}`);
  fidelity.innerHTML = s.evidenceFidelity[state.fidelity];
  nodes.push(fidelity);

  // Offer exact tokenisation only where it would change anything: custom text
  // with a tokenizer that can actually run in the browser.
  if (state.fidelity === 'approximate') {
    if (canBeExact(state.tokenizer)) {
      const btn = el('button', 'ghost-btn', state.loadingExact ? s.loadingExact : s.loadExact);
      btn.type = 'button';
      btn.disabled = state.loadingExact;
      btn.addEventListener('click', async () => {
        state.loadingExact = true;
        renderEvidence();
        try {
          await ensureExact(state.tokenizer);
        } finally {
          state.loadingExact = false;
          renderLanes();
          renderVerdict();
          renderEvidence();
        }
      });
      nodes.push(btn);
    } else {
      nodes.push(el('p', 'evidence-line muted', s.exactUnavailable));
    }
  }

  const caveats = el('details', 'caveats');
  caveats.append(el('summary', null, s.caveatHeading));
  const ul = el('ul');
  for (const c of s.caveats) {
    const li = el('li');
    li.innerHTML = c;
    ul.append(li);
  }
  caveats.append(ul);
  nodes.push(caveats);

  box.replaceChildren(...nodes);
}

/* ══════════════════════════════════════════════════════════════════ theme */

function applyTheme() {
  document.documentElement.dataset.theme = state.theme;
  $('#theme-icon').textContent = { auto: '◐', light: '☀', dark: '☾' }[state.theme];
}

/* ═══════════════════════════════════════════════════════ reading-speed test */

let readingTest = null;

function openReadingTest() {
  const p = pace();
  if (!p.available) return;
  readingTest = new ReadingTest({ lang: state.lang, unit: p.unit });

  $('#rt-passage').textContent = readingTest.passage;
  $('#rt-passage').classList.remove('is-revealed');
  $('#rt-result').textContent = '';
  $('#rt-done').disabled = true;
  $('#rt-start').disabled = false;
  $('#reading-dialog').showModal();
}

function startReadingTest() {
  $('#rt-passage').classList.add('is-revealed');
  $('#rt-start').disabled = true;
  $('#rt-done').disabled = false;
  $('#rt-passage').focus();
  readingTest.start();
}

function finishReadingTest() {
  const result = readingTest.finish();
  const s = t();
  if (!result.ok) {
    $('#rt-result').textContent = s.rtTooFast;
    $('#rt-start').disabled = false;
    $('#rt-done').disabled = true;
    return;
  }
  state.reading = result.rate;
  commit();
  const unit = result.unit === 'word' ? s.unitWordsPerMin : s.unitCharsPerMin;
  $('#rt-result').textContent = s.rtResult(result.rate, unit, readingTokensPerSecond().toFixed(1));
  $('#rt-done').disabled = true;
}

/* ══════════════════════════════════════════════════════════════════ commit */

function commit() {
  stop();
  syncUrl(state);
  applyStaticStrings();
  renderSelects();
  renderSpeedInputs();
  renderCustomInput();
  renderLanes();
  renderVerdict();
  renderEvidence();
}

/* ═══════════════════════════════════════════════════════════════════ events */

function wire() {
  for (const btn of document.querySelectorAll('.seg-btn[data-lang]')) {
    btn.addEventListener('click', () => {
      if (state.lang === btn.dataset.lang) return;
      state.lang = btn.dataset.lang;
      // A reading speed measured in one language's unit is meaningless in the
      // other's, so fall back to that language's sourced default.
      state.reading = null;
      commit();
    });
  }

  $('#theme-toggle').addEventListener('click', () => {
    state.theme = { auto: 'light', light: 'dark', dark: 'auto' }[state.theme];
    applyTheme();
    syncUrl(state);
  });

  $('#sample-select').addEventListener('change', (e) => {
    state.sample = e.target.value;
    commit();
  });

  $('#tokenizer-select').addEventListener('change', (e) => {
    state.tokenizer = e.target.value;
    commit();
  });

  $('#ttft-input').addEventListener('input', (e) => {
    state.ttft = Number(e.target.value);
    $('#ttft-output').textContent = `${state.ttft.toFixed(1)}s`;
    renderVerdict();
  });
  $('#ttft-input').addEventListener('change', () => commit());

  $('#reading-input').addEventListener('input', (e) => {
    state.reading = Number(e.target.value);
    const p = pace();
    const unit = p.unit === 'word' ? t().unitWordsPerMin : t().unitCharsPerMin;
    $('#reading-output').textContent = `${Math.round(state.reading)} ${unit}`;
    renderVerdict();
  });
  $('#reading-input').addEventListener('change', () => commit());

  $('#add-lane').addEventListener('click', () => {
    if (state.speeds.length >= MAX_LANES) return;
    state.speeds.push(Math.min(500, Math.max(...state.speeds) * 2));
    commit();
  });

  $('#play').addEventListener('click', () => (clock.running ? stop() : play()));
  $('#reset').addEventListener('click', () => {
    Object.assign(state, { ...DEFAULTS, customText: state.customText });
    commit();
    applyTheme();
  });

  $('#share').addEventListener('click', async () => {
    const url = window.location.href;
    const feedback = $('#share-feedback');
    try {
      await navigator.clipboard.writeText(url);
      feedback.textContent = t().shareCopied;
    } catch {
      feedback.textContent = t().shareFailed;
    }
    setTimeout(() => (feedback.textContent = ''), 2500);
  });

  $('#measure-reading').addEventListener('click', openReadingTest);
  $('#rt-start').addEventListener('click', startReadingTest);
  $('#rt-done').addEventListener('click', finishReadingTest);

  // Re-render if the OS motion preference changes mid-session.
  window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', () => {
    stop();
    renderLanes();
  });
}

/* ═══════════════════════════════════════════════════════════════════ start */

applyTheme();
wire();
commit();

// Surface for the reproducibility story: everything on screen is in here.
window.tokenpace = { state, TOKENIZERS, READING_PACE, MEASURED_AT };
