// Pomodoro engine. Time is tracked with timestamps (not by counting ticks), so it
// stays accurate when the tab is in the background or the laptop sleeps, and it
// survives a page refresh.

import { state, save, creditFocus, completeSession } from './store.js';
import { clamp } from './util.js';

export const PHASES = {
  focus: 'Focus',
  short: 'Short break',
  long: 'Long break',
};

/** True only for real phase names (not inherited keys like "toString"). */
export const isPhase = (p) => typeof p === 'string' && Object.hasOwn(PHASES, p);

export class Timer extends EventTarget {
  constructor() {
    super();
    const r = state.run || {};
    this.override = null; // durations shared by a buddy room, when following it
    this.phase = isPhase(r.phase) ? r.phase : 'focus';
    this.cycle = r.cycle || 0;
    this.total = r.total || this.durationOf(this.phase);
    this.running = !!r.running;
    this.endsAt = r.endsAt || 0;
    this.remainingMs = r.remaining ?? this.total;
    this.lastAccount = r.lastAccount ?? null;
    this.pending = 0; // focused ms not yet credited to stats
    this.phaseFocus = r.phaseFocus || 0; // focused ms in the current focus phase
  }

  durations() {
    return this.override || state.timer;
  }

  durationOf(phase) {
    return Math.round((+this.durations()[phase] || 25) * 60000);
  }

  get remaining() {
    return this.running ? Math.max(0, this.endsAt - Date.now()) : this.remainingMs;
  }

  get progress() {
    return this.total ? 1 - this.remaining / this.total : 0;
  }

  snapshot() {
    return {
      phase: this.phase,
      running: this.running,
      remaining: Math.round(this.remaining),
      total: this.total,
      cycle: this.cycle,
    };
  }

  /** Call once at startup. Returns the phase that finished while the app was closed, if any. */
  restore() {
    if (this.running && Date.now() >= this.endsAt) {
      const finished = this.phase;
      this.account(this.endsAt);
      this.flush();
      if (finished === 'focus' && this.countsAsSession()) completeSession();
      this.advance(true, { allowAuto: false });
      return finished;
    }
    if (!this.running) this.lastAccount = null;
    return null;
  }

  persist() {
    state.run = {
      phase: this.phase,
      cycle: this.cycle,
      total: this.total,
      running: this.running,
      endsAt: this.endsAt,
      remaining: this.remainingMs,
      lastAccount: this.lastAccount,
      phaseFocus: this.phaseFocus,
    };
    save();
  }

  changed(reason) {
    this.persist();
    this.dispatchEvent(new CustomEvent('change', { detail: { reason } }));
  }

  start(reason = 'start') {
    if (this.running) return;
    if (this.remainingMs <= 0) this.remainingMs = this.total;
    this.endsAt = Date.now() + this.remainingMs;
    this.running = true;
    this.lastAccount = Date.now();
    this.changed(reason);
  }

  pause(reason = 'pause') {
    if (!this.running) return;
    this.account();
    this.flush();
    this.remainingMs = Math.max(0, this.endsAt - Date.now());
    this.running = false;
    this.lastAccount = null;
    this.changed(reason);
  }

  toggle() {
    if (this.running) this.pause();
    else this.start();
  }

  reset() {
    this.account();
    this.flush();
    this.running = false;
    this.total = this.durationOf(this.phase);
    this.remainingMs = this.total;
    this.lastAccount = null;
    this.phaseFocus = 0;
    this.changed('reset');
  }

  skip() {
    this.account();
    this.flush();
    this.advance(false);
  }

  setPhase(phase) {
    if (!isPhase(phase)) return;
    this.account();
    this.flush();
    this.phase = phase;
    this.total = this.durationOf(phase);
    this.remainingMs = this.total;
    this.running = false;
    this.lastAccount = null;
    this.phaseFocus = 0;
    this.changed('phase');
  }

  /** Settings changed: refresh an untouched (not started) phase to the new length. */
  refreshDurations() {
    const fresh = !this.running && this.remainingMs === this.total;
    if (fresh) {
      this.total = this.durationOf(this.phase);
      this.remainingMs = this.total;
      this.changed('durations');
    }
  }

  /** Follow a buddy room's timer. */
  apply(remote, durations) {
    this.account();
    this.flush();
    this.override = durations || null;
    const phase = isPhase(remote.phase) ? remote.phase : 'focus';
    if (phase !== this.phase) this.phaseFocus = 0;
    this.phase = phase;
    this.cycle = remote.cycle ?? this.cycle;
    this.total = remote.total || this.durationOf(this.phase);
    this.running = !!remote.running;
    this.remainingMs = clamp(+remote.remaining || 0, 0, this.total);
    this.endsAt = this.running ? Date.now() + this.remainingMs : 0;
    this.lastAccount = this.running ? Date.now() : null;
    this.changed('sync');
  }

  release() {
    this.override = null;
  }

  // Accrue time spent running in a focus phase.
  account(now = Date.now()) {
    if (!this.running || this.phase !== 'focus' || this.lastAccount == null) return;
    const t = Math.min(now, this.endsAt);
    if (t > this.lastAccount) {
      this.pending += t - this.lastAccount;
      this.phaseFocus += t - this.lastAccount;
      this.lastAccount = t;
    }
  }

  flush() {
    if (this.pending > 0) {
      creditFocus(this.pending / 60000);
      this.pending = 0;
      // Save the accounting position too, so a reload can't count this time again.
      this.persist();
    }
  }

  tick() {
    const now = Date.now();
    this.account(now);
    if (this.pending >= 60000) {
      this.flush();
      this.persist();
    }
    if (this.running && now >= this.endsAt) this.complete();
  }

  /** Joined halfway through someone else's session? It only counts if you did at least half. */
  countsAsSession() {
    return this.phaseFocus >= this.total * 0.5;
  }

  complete() {
    const finished = this.phase;
    this.account(this.endsAt);
    this.flush();
    if (finished === 'focus' && this.countsAsSession()) completeSession();
    this.advance(true);
    this.dispatchEvent(new CustomEvent('complete', { detail: { phase: finished, next: this.phase } }));
  }

  advance(natural, { allowAuto = true } = {}) {
    const d = this.durations();
    let next;
    if (this.phase === 'focus') {
      if (natural) this.cycle += 1;
      next = natural && this.cycle > 0 && this.cycle % (d.longEvery || 4) === 0 ? 'long' : 'short';
    } else {
      if (this.phase === 'long') this.cycle = 0;
      next = 'focus';
    }
    this.phase = next;
    this.total = this.durationOf(next);
    this.remainingMs = this.total;
    this.running = false;
    this.lastAccount = null;
    this.phaseFocus = 0;
    const auto = next === 'focus' ? d.autoFocus : d.autoBreak;
    if (natural && allowAuto && auto) {
      this.endsAt = Date.now() + this.remainingMs;
      this.running = true;
      this.lastAccount = Date.now();
    }
    this.changed(natural ? 'advance' : 'skip');
  }
}
