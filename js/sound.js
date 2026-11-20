// Soft, synthesized chimes (Web Audio) — no audio files needed, all original.

import { state } from './store.js';

let ctx = null;
let master = null;

function audio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  master.gain.value = state.sound.volume;
  return ctx;
}

// Browsers only allow audio after a user gesture; warm up on the first one.
['pointerdown', 'keydown'].forEach((ev) =>
  window.addEventListener(ev, () => audio(), { once: true, passive: true }),
);

const NOTE = (n) => 440 * 2 ** ((n - 69) / 12); // MIDI note → Hz

// A mellow marimba-ish pluck: fundamental + quiet overtone, fast attack, soft decay.
function pluck(midi, at, { dur = 0.9, gain = 0.22, type = 'sine' } = {}) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + at;
  const out = a.createGain();
  out.gain.setValueAtTime(0.0001, t);
  out.gain.exponentialRampToValueAtTime(gain, t + 0.012);
  out.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  out.connect(master);
  [
    [1, 1],
    [4, 0.12],
    [2.01, 0.18],
  ].forEach(([mult, g]) => {
    const o = a.createOscillator();
    const og = a.createGain();
    o.type = type;
    o.frequency.value = NOTE(midi) * mult;
    og.gain.value = g;
    o.connect(og).connect(out);
    o.start(t);
    o.stop(t + dur + 0.05);
  });
}

function glide(from, to, at, dur = 0.18, gain = 0.18) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + at;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(from, t);
  o.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.12);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.2);
}

const SOUNDS = {
  focus: () => { pluck(64, 0); pluck(69, 0.14); },
  break: () => { pluck(84, 0); pluck(79, 0.16); pluck(76, 0.32, { dur: 1.4 }); },
  long: () => { pluck(72, 0); pluck(76, 0.15); pluck(79, 0.3); pluck(84, 0.45, { dur: 1.6 }); },
  levelup: () => [72, 76, 79, 84, 88].forEach((n, i) => pluck(n, i * 0.09, { dur: 1.1, gain: 0.18 })),
  paw: () => { glide(720, 520, 0); glide(900, 640, 0.12, 0.12, 0.1); },
  join: () => { pluck(76, 0, { gain: 0.14 }); pluck(81, 0.12, { gain: 0.14 }); },
  leave: () => { pluck(81, 0, { gain: 0.1 }); pluck(76, 0.12, { gain: 0.1 }); },
  chat: () => pluck(88, 0, { dur: 0.35, gain: 0.08 }),
};

export function play(name) {
  if (!state.sound.on || !SOUNDS[name]) return;
  try {
    SOUNDS[name]();
  } catch {
    /* audio unavailable */
  }
}
