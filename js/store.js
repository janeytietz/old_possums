// App state: one object, saved to localStorage, with tiny pub/sub.
//   import { state, update, on } from './store.js'
//   update('tasks', s => s.tasks.push(...))   → saves + notifies 'tasks' listeners

import { dayKey, daysBetween, debounce, uid } from './util.js';
import { COAT_IDS } from './coats.js';

const KEY = 'pomocat:v2';

// Projects (stored as `categories` for older saved data). The prop is what
// your cat works with while you focus on that project.
export const PROJECT_COLORS = ['#cfe0cf', '#f4d3c0', '#d3e2ea', '#ead6e3', '#f3e3b5', '#d9d3ee', '#cfe6e2', '#f2cdd0'];

export const DEFAULT_CATEGORIES = [
  { id: 'admin', name: 'Life admin', color: '#f4d3c0', prop: 'laptop', note: 'Small tasks, big relief.' },
  { id: 'work', name: 'Work', color: '#cfe0cf', prop: 'laptop', note: 'One thing at a time.' },
  { id: 'study', name: 'Study', color: '#d3e2ea', prop: 'book', note: 'Skim first, then dig in.' },
  { id: 'creative', name: 'Creative', color: '#ead6e3', prop: 'notebook', note: 'Messy first drafts count.' },
];

export const DEFAULT_MESSAGES = [
  'One small step, then another.',
  'Progress over perfection.',
  "You don't have to finish today. Just start.",
  'Break it into smaller pieces.',
  'Future you says thanks.',
  "Sip some water. I'll wait.",
  'Shoulders down, jaw unclenched.',
  'Done is better than perfect.',
  'Every focused minute counts.',
  'Phone face-down? Good human.',
  'Curiosity, not pressure.',
  "I'm right here working too.",
];

export const BREAK_IDEAS = [
  'Stand up and stretch your back.',
  'Refill your water glass.',
  'Look at something far away for 20 seconds.',
  'Roll your shoulders five times.',
  'Step outside for a minute of fresh air.',
  'Tidy one thing on your desk.',
  'Take three slow breaths.',
  'Get a snack that isn’t just caffeine.',
];

function defaults() {
  return {
    v: 2,
    profile: { name: '', beast: 'possum', coat: 'ginger' },
    // Earned from bestiary cards. Everyone starts with the possum and parchment.
    unlocks: { beasts: ['possum'], backdrops: ['parchment'], coats: ['ginger'] },
    // Bestiary cards (js/cards.js): which you own, how many wait face down, the
    // sessions counted toward the next card (one per four), and helpers kept.
    cards: { owned: ['possum'], waiting: 0, toward: 0, shields: 0, ink: 0, inkActive: false },
    // The hungry pig (js/pig.js): stray thoughts it's keeping for your break, and
    // how many finished tasks it has eaten.
    pig: { thoughts: [], eaten: 0 },
    timer: { focus: 25, short: 5, long: 15, longEvery: 4, autoBreak: false, autoFocus: false },
    categories: structuredClone(DEFAULT_CATEGORIES),
    category: 'admin',
    countdown: { on: false, label: '', date: '' },
    messages: [...DEFAULT_MESSAGES],
    catTalks: true,
    sound: { on: true, volume: 0.6 },
    notify: false,
    theme: 'auto',
    scene: { time: 'auto', weather: 'clear', backdrop: 'parchment' },
    room: { shareTask: true, follow: true, last: '' },
    tasks: [],
    session: { taskIds: [] },
    planner: { archiveAfter: 7, tab: 'board', project: 'all', weekend: false, weekNotes: {} },
    held: [],
    notes: '',
    stats: { xp: 0, level: 1, streak: 0, lastDay: null, days: {}, byCat: {}, totalMin: 0, sessions: 0 },
    run: null,
  };
}

// Merge saved data over defaults so new settings appear for existing users.
function merge(base, saved) {
  if (Array.isArray(base) || typeof base !== 'object' || base === null) return saved ?? base;
  const out = { ...base };
  for (const [k, v] of Object.entries(saved || {})) {
    out[k] = k in base && base[k] && typeof base[k] === 'object' && !Array.isArray(base[k]) && v && typeof v === 'object' && !Array.isArray(v)
      ? merge(base[k], v)
      : v;
  }
  return out;
}

// One-time import from the original dissertation version (same browser/origin only).
// Tasks, notes, XP/streak, timer lengths and time-per-mode come across; the old
// dissertation modes are left behind in favour of the new general categories.
function migrateV1(s) {
  try {
    const old = JSON.parse(localStorage.getItem('pomocatSettings') || 'null');
    const oldStats = JSON.parse(localStorage.getItem('pomocatStats') || 'null');
    const oldTasks = JSON.parse(localStorage.getItem('pomocatTasks') || 'null');
    const oldNotes = localStorage.getItem('pomocatNotes');
    if (!old && !oldStats && !oldTasks && !oldNotes) return false;
    if (old) {
      s.timer.focus = +old.WORK_DURATION || 25;
      s.timer.short = +old.BREAK_DURATION || 5;
      s.timer.long = +old.LONG_BREAK_DURATION || 15;
    }
    if (oldStats) {
      s.stats.level = +oldStats.level || 1;
      s.stats.xp = +oldStats.xp || 0;
      s.stats.streak = +oldStats.streak || 0;
      const last = oldStats.lastActiveDate ? new Date(oldStats.lastActiveDate) : null;
      if (last && !Number.isNaN(+last)) s.stats.lastDay = dayKey(last);
      while (s.stats.xp >= xpForNext(s.stats.level)) {
        s.stats.xp -= xpForNext(s.stats.level);
        s.stats.level += 1;
      }
      for (const [id, secs] of Object.entries(oldStats.modeTimeTracker || {})) {
        const min = (+secs || 0) / 60;
        if (min > 0) {
          s.stats.byCat[id] = min;
          s.stats.totalMin += min;
        }
      }
    }
    if (Array.isArray(oldTasks)) s.tasks = oldTasks.map((t) => ({ id: uid(), text: String(t.text || ''), done: !!t.done }));
    if (oldNotes) s.notes = oldNotes;
    return true;
  } catch {
    return false;
  }
}

function load() {
  let saved = null;
  try {
    saved = JSON.parse(localStorage.getItem(KEY) || 'null');
  } catch {
    saved = null;
  }
  const s = merge(defaults(), saved);
  if (!saved) s._migrated = migrateV1(s);
  // Saved before the possum arrived: they already had a cat (in any coat), so keep it theirs.
  if (saved && !saved.profile?.beast) {
    if (!s.unlocks.beasts.includes('cat')) s.unlocks.beasts.push('cat');
    s.unlocks.coats = [...COAT_IDS];
  }
  // Had the cat before coats came from cards: every coat stays theirs.
  if (saved && !saved.unlocks?.coats && s.unlocks.beasts.includes('cat')) s.unlocks.coats = [...COAT_IDS];
  ownFromUnlocks(s);
  checkUnlocks(s);
  upgradeTasks(s);
  return s;
}

// Cards you'd already have from your unlocks (saves from before the cards).
function ownFromUnlocks(s) {
  const owned = new Set(s.cards.owned);
  owned.add('possum');
  if (s.unlocks.beasts.includes('cat')) owned.add('cat');
  if (s.unlocks.backdrops.includes('vault')) owned.add('vault');
  for (const c of s.unlocks.coats) if (c !== 'ginger') owned.add(`coat-${c}`);
  s.cards.owned = [...owned];
}

// Only use a beast or backdrop that has been unlocked.
function checkUnlocks(s) {
  if (!s.unlocks.beasts.includes(s.profile.beast)) s.profile.beast = 'possum';
  if (!s.unlocks.coats.includes(s.profile.coat)) s.profile.coat = 'ginger';
  if (!s.unlocks.backdrops.includes(s.scene.backdrop)) s.scene.backdrop = 'parchment';
}

// Older saved tasks were a flat checklist ({ text, done }); give them the
// planner's shape, and give projects a colour.
function upgradeTasks(s) {
  s.categories.forEach((c, i) => { c.color ??= PROJECT_COLORS[i % PROJECT_COLORS.length]; });
  if (!s.categories.some((c) => c.id === s.category)) s.category = s.categories[0]?.id || '';
  const now = Date.now();
  s.tasks = (s.tasks || []).map((t, i) => (t.title !== undefined ? t : {
    id: t.id || uid(),
    title: String(t.text || 'Untitled'),
    notes: '',
    projectId: '',
    parentId: '',
    status: t.done ? 'done' : 'todo',
    due: '',
    remindAt: '',
    repeat: '',
    tags: [],
    followUpOn: '',
    createdAt: now,
    doneAt: t.done ? now : 0,
    archived: false,
    reminded: false,
    order: i,
  }));
  if (s.currentTask && !s.session.taskIds.length) s.session.taskIds = [s.currentTask];
  delete s.currentTask;
}

export const state = load();

const listeners = new Map();
export function on(topic, fn) {
  if (!listeners.has(topic)) listeners.set(topic, new Set());
  listeners.get(topic).add(fn);
  return () => listeners.get(topic).delete(fn);
}
export function emit(topic, detail) {
  listeners.get(topic)?.forEach((fn) => fn(detail));
}

let readOnly = false;
/** Another window owns the data now: stop writing so we don't clobber it. */
export const setReadOnly = () => { readOnly = true; };

const write = () => {
  if (readOnly) return;
  try {
    const { _migrated, ...rest } = state;
    localStorage.setItem(KEY, JSON.stringify(rest));
  } catch {
    /* storage full or blocked — the app still works for this visit */
  }
};
const writeSoon = debounce(write, 250);
export const save = (now = false) => (now ? write() : writeSoon());
window.addEventListener('pagehide', () => write());

export function update(topic, mutate) {
  mutate(state);
  save();
  emit(topic);
}

// ── Categories ──────────────────────────────────────────────────────────────
export function currentCategory() {
  return state.categories.find((c) => c.id === state.category) || state.categories[0] || DEFAULT_CATEGORIES[0];
}

// ── Stats / XP ──────────────────────────────────────────────────────────────
export function xpForNext(level) {
  return 50 + 25 * (level - 1);
}

function today() {
  const k = dayKey();
  state.stats.days[k] ??= { min: 0, sessions: 0, byCat: {} };
  return state.stats.days[k];
}

/** Credit focused minutes (fractions allowed). Returns levels gained. */
export function creditFocus(minutes, catId = state.category) {
  if (!(minutes > 0)) return 0;
  const d = today();
  d.min += minutes;
  d.byCat[catId] = (d.byCat[catId] || 0) + minutes;
  state.stats.byCat[catId] = (state.stats.byCat[catId] || 0) + minutes;
  state.stats.totalMin += minutes;
  touchStreak();
  let gained = 0;
  state.stats.xp += state.cards.inkActive ? minutes * 2 : minutes;
  while (state.stats.xp >= xpForNext(state.stats.level)) {
    state.stats.xp -= xpForNext(state.stats.level);
    state.stats.level += 1;
    gained += 1;
  }
  save();
  emit('stats');
  if (gained) emit('levelup', state.stats.level);
  return gained;
}

export function completeSession() {
  today().sessions += 1;
  state.stats.sessions += 1;
  touchStreak();
  save();
  emit('stats');
}

const STREAK_MILESTONES = [3, 7, 14, 30, 60, 100, 200, 365];

function touchStreak() {
  const k = dayKey();
  const last = state.stats.lastDay;
  if (last === k) return;
  const gap = last ? daysBetween(last, k) : 0;
  // A Streak Shield card carries you over one missed day.
  const shielded = gap === 2 && state.cards.shields > 0;
  if (shielded) state.cards.shields -= 1;
  state.stats.streak = gap === 1 || shielded ? state.stats.streak + 1 : 1;
  state.stats.lastDay = k;
  if (shielded) emit('shieldUsed');
  if (STREAK_MILESTONES.includes(state.stats.streak)) emit('streakMilestone', state.stats.streak);
}

/** Streak still counts if you worked yesterday but not yet today. */
export function liveStreak() {
  const last = state.stats.lastDay;
  if (!last) return 0;
  const gap = daysBetween(last, dayKey());
  return gap <= 1 || (gap === 2 && state.cards.shields > 0) ? state.stats.streak : 0;
}

export function todayStats() {
  return state.stats.days[dayKey()] || { min: 0, sessions: 0, byCat: {} };
}

// ── Import / export ─────────────────────────────────────────────────────────
export function exportData() {
  const { _migrated, run, ...rest } = state;
  return JSON.stringify({ app: 'pomocat', exported: new Date().toISOString(), ...rest }, null, 2);
}

export function importData(json) {
  const data = JSON.parse(json);
  // Backups keep the app's old id, 'pomocat', so older files still import.
  if (!data || data.app !== 'pomocat') throw new Error('That file is not a backup from this app.');
  const next = merge(defaults(), data);
  checkUnlocks(next);
  delete next.app;
  delete next.exported;
  next.run = state.run; // keep whatever the timer is doing right now
  for (const k of Object.keys(state)) delete state[k];
  Object.assign(state, next);
  save(true);
  emit('all');
}

/** Unlock a beast or backdrop (from a bestiary card). */
export function unlock(kind, id) {
  update('unlocks', (s) => { if (!s.unlocks[kind].includes(id)) s.unlocks[kind].push(id); });
}

export function resetAll() {
  for (const k of Object.keys(state)) delete state[k];
  Object.assign(state, defaults());
  save(true);
}

// Persist a fresh import right away so it only happens once.
if (state._migrated) write();
