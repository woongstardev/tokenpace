/**
 * engine.js — the streaming clock.
 *
 * Every lane is a pure function of elapsed wall-clock time:
 *
 *     due(t) = clamp(floor((t - ttft) * tokensPerSecond), 0, total)
 *
 * Nothing accumulates per frame, so a dropped, delayed, or coalesced frame
 * cannot make one lane drift away from another. Frames only decide *when* we
 * look at the clock, never how far along a lane is.
 *
 * Two failure modes this guards against, both visible in comparable tools:
 *
 *  - Per-frame increments. Emitting `tps / 60` tokens each frame assumes 60 fps.
 *    On a 120 Hz display everything runs at double speed; under load it crawls.
 *  - Background tabs. Browsers throttle rAF to roughly 1 Hz in a hidden tab.
 *    A wall-clock engine survives that, but the user comes back to a lane that
 *    silently finished while they were away — which is not what a race should
 *    look like. So we stop the clock on hide and resume it on show, and record
 *    that we did.
 */

export class StreamClock {
  #startedAt = 0;
  #pausedAt = null;
  #pausedTotal = 0;
  #running = false;

  start() {
    this.#startedAt = performance.now();
    this.#pausedAt = null;
    this.#pausedTotal = 0;
    this.#running = true;
  }

  stop() {
    this.#running = false;
  }

  get running() {
    return this.#running;
  }

  /** Seconds of running time since start(), excluding any paused stretches. */
  elapsed() {
    if (!this.#running) return 0;
    const frozenAt = this.#pausedAt ?? performance.now();
    return (frozenAt - this.#startedAt - this.#pausedTotal) / 1000;
  }

  pause() {
    if (!this.#running || this.#pausedAt !== null) return;
    this.#pausedAt = performance.now();
  }

  resume() {
    if (this.#pausedAt === null) return 0;
    const pausedFor = performance.now() - this.#pausedAt;
    this.#pausedTotal += pausedFor;
    this.#pausedAt = null;
    return pausedFor / 1000;
  }

  get pausedTotalSeconds() {
    return this.#pausedTotal / 1000;
  }
}

/**
 * How many tokens a lane has emitted by time `t` (seconds since start).
 * The floor is what makes the output chunky in the way real streaming is.
 */
export function tokensDueAt(lane, t) {
  const decoding = t - lane.ttftSeconds;
  if (decoding <= 0) return 0;
  return Math.min(lane.total, Math.floor(decoding * lane.tokensPerSecond));
}

/** Wall-clock seconds until a lane emits its last token. */
export function finishTime(lane) {
  return lane.ttftSeconds + lane.total / lane.tokensPerSecond;
}

/**
 * Drive a callback once per animation frame while any lane is unfinished.
 *
 * `onFrame` receives the elapsed time; it is expected to derive everything else
 * from that, not to keep state of its own.
 */
export function runLoop(clock, onFrame, isDone) {
  let handle = null;

  const tick = () => {
    const t = clock.elapsed();
    onFrame(t);
    if (isDone(t) || !clock.running) {
      handle = null;
      return;
    }
    handle = requestAnimationFrame(tick);
  };

  handle = requestAnimationFrame(tick);
  return () => {
    if (handle !== null) cancelAnimationFrame(handle);
    handle = null;
  };
}

/**
 * Snapshot times for the reduced-motion view.
 *
 * Rather than animating, show what each lane had produced at a handful of
 * moments. The moments are chosen from the slowest lane so the last one is
 * always "everything finished", and there are never more than `max` of them.
 */
export function snapshotTimes(lanes, max = 6) {
  const end = Math.max(...lanes.map(finishTime));
  if (!Number.isFinite(end) || end <= 0) return [0];
  const step = end / (max - 1);
  return Array.from({ length: max }, (_, i) => Number((i * step).toFixed(2)));
}
