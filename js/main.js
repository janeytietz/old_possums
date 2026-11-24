// Old Possum’s Book of Productivity: wires the timer, your buddy (the possum,
// or a beast you've earned), the planner and buddy rooms together.
//
// Three screens, picked from the timer:
//   idle  – not started (or paused): choose what you're working on
//   work  – focusing: your buddy writing, the time, this session's tasks, and friends shown quietly
//   break – the fun opens up: level, a break idea, friends and chat
// Anything that would interrupt you while working (reminders, paws, chat,
// people joining) waits and shows up on your break.

import { state, update, on, currentCategory, todayStats, liveStreak, xpForNext, BREAK_IDEAS, setReadOnly } from './store.js';
import { Timer, PHASES } from './timer.js';
import { play } from './sound.js';
import { $, $$, el, fmtClock, daysBetween, dayKey, pick, icon, inscribe } from './util.js';
import { initSettings } from './ui/settings.js';
import { initPlanner } from './ui/planner-view.js';
import { initSession } from './ui/session.js';
import { initCards } from './ui/cards-view.js';
import { initPig } from './ui/pig-view.js';
import * as cards from './cards.js';
import { toast } from './ui/toast.js';
import { createScene, buddyPreview, buddyFace } from './scene/scene.js';
import { beastShort } from './coats.js';
import { BuddyRoom, newRoomCode, parseRoomCode, inviteLink } from './room.js';
import { initPip } from './pip.js';
import { isMac, send as sendMac, onCommand, shareState } from './native.js';
import { sessionTasks, currentSessionTask, nextSessionTask, setStatus, startSession, dueReminders, markReminded, archiveOld } from './planner.js';

const USER_REASONS = new Set(['start', 'pause', 'reset', 'skip', 'phase']);

// ── Theme ───────────────────────────────────────────────────────────────────
function applyTheme() {
  if (state.theme === 'auto') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = state.theme;
}
applyTheme();
on('theme', applyTheme);

// ── One window at a time ────────────────────────────────────────────────────
const STEAL_KEY = 'pomocat:take-over';
let inactive = false;
function stepAside() {
  if (inactive) return;
  inactive = true;
  setReadOnly();
  if (room) leaveRoom(true);
  document.querySelectorAll('dialog[open]').forEach((d) => d.close());
  document.body.append(
    el('div', { class: 'elsewhere', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'elsewhereTitle' },
      el('div', { class: 'card' },
        el('h2', { id: 'elsewhereTitle' }, 'The app is open in another window'),
        el('p', {}, 'To keep your timer and tasks from getting mixed up, only one window runs at a time.'),
        el('button', { class: 'btn btn-main', type: 'button', onclick: () => { sessionStorage.setItem(STEAL_KEY, '1'); location.reload(); } }, 'Use it here instead'))),
  );
}
if (navigator.locks) {
  const takeOver = sessionStorage.getItem(STEAL_KEY) === '1';
  sessionStorage.removeItem(STEAL_KEY);
  navigator.locks
    .request('pomocat-app', takeOver ? { steal: true } : { ifAvailable: true }, (lock) => {
      if (!lock) return stepAside();
      return new Promise(() => {});
    })
    .catch(() => stepAside());
}

// ── Core objects ────────────────────────────────────────────────────────────
const timer = new Timer();
const finishedAway = timer.restore();
let room = null;
let hiddenSince = document.hidden ? Date.now() : 0;
let lastStatus = null;
let lastScreen = null;
let breakIdea = pick(BREAK_IDEAS);

const scene = createScene($('#scene'), { onBuddyClick: () => pet() });
const buddy = () => beastShort(state.profile.beast);
const pip = initPip({
  timer,
  buddies: () => room?.peers.size || 0,
  task: () => currentSessionTask(),
  next: () => nextSessionTask(),
  complete: (id) => completeFromMini(id),
  look: () => ({ beast: state.profile.beast, coat: state.profile.coat, status: myStatus(), backdrop: state.scene.backdrop }),
});
// Finishing tasks tells the room (on their break).
function finishedTasks(titles) {
  tellBuddies(titles);
}
const planner = initPlanner({ onFinished: finishedTasks });
const session = initSession({ onFinished: finishedTasks, onOpenTask: (id) => planner.edit(id) });
const cardsView = initCards();

// ── Status ──────────────────────────────────────────────────────────────────
function screen() {
  if (timer.phase !== 'focus') return 'break';
  return timer.running ? 'work' : 'idle';
}

function myStatus() {
  if (timer.running) return timer.phase === 'focus' ? 'focus' : 'break';
  if (document.hidden && hiddenSince && Date.now() - hiddenSince > 5 * 60e3) return 'away';
  if (timer.phase !== 'focus') return 'break';
  if (timer.remaining < timer.total - 1000) return 'paused';
  return 'idle';
}

const currentTaskText = () => currentSessionTask()?.title || '';

/** Ticked off in the mini player: done, and it moves on to the next in this session. */
function completeFromMini(id) {
  const t = currentSessionTask();
  if (!t || (id && t.id !== id)) return; // it changed in the meantime: don't tick the wrong one
  const titles = setStatus(t.id, 'done');
  if (titles.length) finishedTasks(titles);
}

function myPresence() {
  const cat = currentCategory();
  const share = state.room.shareTask;
  return {
    name: state.profile.name || 'A buddy',
    beast: state.profile.beast,
    coat: state.profile.coat,
    status: myStatus(),
    phase: timer.phase,
    running: timer.running,
    remaining: Math.round(timer.remaining),
    category: share ? cat.name : '',
    prop: cat.prop,
    task: share ? currentTaskText() : '',
    sessions: todayStats().sessions,
    follow: state.room.follow,
  };
}

let presenceQueued = false;
function sharePresence() {
  if (!room || presenceQueued) return;
  presenceQueued = true;
  setTimeout(() => { presenceQueued = false; room?.sendPresence(); }, 150);
}

// ── Holding things until your break ─────────────────────────────────────────
const working = () => screen() === 'work';

function hold(text, { sound } = {}) {
  if (working()) {
    update('held', (s) => { s.held.push({ text, at: Date.now() }); s.held = s.held.slice(-30); });
    return;
  }
  if (sound) play(sound);
  toast(text, { timeout: 4500 });
}

function renderHeld() {
  const box = $('#heldBox');
  box.replaceChildren(state.held.length
    ? el('ul', {}, ...state.held.map((h) => el('li', {}, h.text)))
    : el('p', { class: 'none' }, 'Nothing waited for you. A quiet session.'));
}

// ── Fitting the page ────────────────────────────────────────────────────────
// The header can wrap and the timer block changes height with the screen, so
// measure them: the timer sits under the header, the buddy under the timer.
function fitLayout() {
  const topH = $('.topbar').offsetHeight;
  const root = document.documentElement.style;
  root.setProperty('--top-h', `${topH}px`);
  root.setProperty('--timer-bottom', `${Math.ceil(36 + topH + $('#timerCard').offsetHeight)}px`);
}
const fitter = new ResizeObserver(fitLayout);
fitter.observe($('.topbar'));
fitter.observe($('#timerCard'));
addEventListener('resize', fitLayout);

// ── Screen + scene ──────────────────────────────────────────────────────────
function renderScreen() {
  const s = screen();
  document.body.dataset.state = s;
  document.body.dataset.phase = timer.phase;
  document.body.dataset.backdrop = state.scene.backdrop;
  scene.update({ beast: state.profile.beast, coat: state.profile.coat, status: myStatus() });
  const task = currentTaskText();
  const caption = {
    work: task ? `${task}. Your ${buddy()} is writing too.` : `Focus time. Your ${buddy()} is writing too.`,
    break: timer.running ? `Break. Your ${buddy()} has put its quill down.` : 'Break time. Start it when you’re ready.',
    idle: timer.remaining < timer.total - 1000 ? `Paused. Your ${buddy()} is waiting for you.` : 'Ready when you are.',
  }[s];
  inscribe($('#caption'), caption);

  if (s !== lastScreen) {
    const prev = lastScreen;
    lastScreen = s;
    session.closePopover();
    if (s === 'work') {
      scene.hush();
      update('held', (st) => { st.held = []; });
    }
    if (prev === 'work' && state.held.length) {
      play('chat');
      toast(state.held.length === 1 ? 'One thing waited for your break.' : `${state.held.length} things waited for your break.`, { timeout: 4000 });
    }
    if (s === 'break') {
      breakIdea = pick(BREAK_IDEAS);
      if (state.catTalks) setTimeout(() => { if (screen() === 'break') scene.say(pick(['Tea time.', 'Nice work. Stretch with me?', 'Quill down. Break!', 'You earned this one.']), 7000); }, 900);
    }
    if (s === 'idle' && prev && state.catTalks && Math.random() < 0.6) {
      setTimeout(() => { if (screen() === 'idle') scene.say(pick(['What are we working on next?', 'Ready when you are.', 'One small step, then another.']), 7000); }, 700);
    }
    renderFriends();
  }
  $('#breakIdea').textContent = breakIdea;
  renderHeld();
  pip.update();
  tellMac();
}

function renderTimer() {
  const ms = timer.remaining;
  const clock = fmtClock(ms);
  $('#time').textContent = clock;
  $('#phaseLabel').textContent = PHASES[timer.phase];
  $('#plannerClock').replaceChildren(PHASES[timer.phase], el('b', {}, clock));
  const fresh = !timer.running && ms >= timer.total - 500;
  $('#startBtn').textContent = timer.running ? 'Pause' : fresh ? (timer.phase === 'focus' ? 'Start focus' : 'Start break') : 'Resume';
  const every = timer.durations().longEvery || 4;
  const filled = timer.phase === 'long' ? every : timer.cycle % every;
  const cycle = $('#cycle');
  if (cycle.childElementCount !== every) cycle.replaceChildren(...Array.from({ length: every }, () => el('span')));
  [...cycle.children].forEach((d, i) => d.classList.toggle('on', i < filled));
  cycle.setAttribute('aria-label', `${filled} of ${every} focus sessions before a long break`);
  document.title = timer.running ? `${clock} ${PHASES[timer.phase]} | Old Possum` : 'Old Possum’s Book of Productivity';
  tellMac();
}

// Inside the Mac app: the menu-bar countdown and the floating scene window.
function tellMac() {
  if (!isMac) return;
  const fresh = !timer.running && timer.remaining >= timer.total - 500;
  shareState({
    phase: timer.phase,
    phaseLabel: PHASES[timer.phase],
    running: timer.running,
    fresh,
    remaining: Math.round(timer.remaining),
    endsAt: timer.running ? Date.now() + timer.remaining : 0,
    toggleLabel: timer.running ? 'Pause' : fresh ? (timer.phase === 'focus' ? 'Start focus' : 'Start break') : 'Resume',
    task: currentTaskText(),
    taskId: currentSessionTask()?.id || '',
    next: nextSessionTask()?.title || '',
    beast: state.profile.beast,
    coat: state.profile.coat,
    status: myStatus(),
    backdrop: state.scene.backdrop,
    buddies: room?.peers.size || 0,
  });
}
onCommand('toggle', () => timer.toggle());
onCommand('skip', () => timer.skip());
onCommand('completeTask', (id) => completeFromMini(id));

// Level, streak, and how far to the next level.
function roman(n) {
  const marks = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  let out = '';
  for (const [v, m] of marks) while (n >= v) { out += m; n -= v; }
  return out || 'I';
}
function renderProgress() {
  const lvl = state.stats.level;
  const need = xpForNext(lvl);
  const left = Math.max(0, Math.ceil(need - state.stats.xp));
  const streak = liveStreak();
  $('#levelNote').textContent = `${left} more ${left === 1 ? 'minute' : 'minutes'} of focus to level ${lvl + 1}.`;
  // Five lozenges in the header, inked in as the level fills.
  const share = Math.max(0, Math.min(1, state.stats.xp / need));
  const inked = Math.floor(share * 5 + 0.0001);
  $('#levelChip').textContent = `Level ${roman(lvl)}`;
  $('#streakChip').textContent = streak === 0 ? 'A fresh start' : streak === 1 ? 'One day running' : `${streak} days running`;
  $('#levelBar').innerHTML = Array.from({ length: 5 }, (_, i) => {
    const x = 7 + i * 15;
    return `<path d="M${x} 1.6 L${x + 5.6} 7.2 L${x + 0.3} 12.6 L${x - 5.4} 6.8 Z" class="${i < inked ? 'on' : ''}"/>`;
  }).join('');
  $('#levelBar').setAttribute('aria-label', `Level ${lvl}, ${Math.round(share * 100)} percent of the way to level ${lvl + 1}`);
}
on('stats', renderProgress);

function renderCountdown() {
  const box = $('#countdown');
  const { on: enabled, label, date } = state.countdown;
  if (!enabled || !date) return void (box.hidden = true);
  const days = daysBetween(dayKey(), date);
  const what = label || 'Deadline';
  box.hidden = false;
  box.textContent = days > 0 ? `${what} in ${days} day${days === 1 ? '' : 's'}` : days === 0 ? `${what} is today` : `${what} was ${-days} day${days === -1 ? '' : 's'} ago`;
}
on('countdown', renderCountdown);

// ── Timer controls ──────────────────────────────────────────────────────────
$('#startBtn').addEventListener('click', () => timer.toggle());
$('#resetBtn').addEventListener('click', () => timer.reset());
$('#skipBtn').addEventListener('click', () => timer.skip());

timer.addEventListener('change', (e) => {
  const reason = e.detail.reason;
  if (reason === 'start' && timer.phase === 'focus') {
    startSession();
    if (cards.beginFocus()) toast('Double Ink: this session counts twice toward your level.', { timeout: 4500 });
  }
  if (timer.phase !== 'focus') cards.endFocus();
  renderTimer();
  renderScreen();
  pip.update();
  if (room && state.room.follow && USER_REASONS.has(reason)) room.shareTimer(timer.snapshot(), timer.durations());
  sharePresence();
});

timer.addEventListener('complete', (e) => {
  const { phase, next } = e.detail;
  if (phase === 'focus') {
    play(next === 'long' ? 'long' : 'break');
    notify(next === 'long' ? 'Long break time' : 'Break time', breakIdea);
    // Every fourth finished session earns a card; that break opens with it.
    cards.endFocus();
    if (cards.sessionDone()) setTimeout(() => cardsView.offer(), 900);
  } else {
    play('focus');
    toast('Break’s over. Ready when you are.');
    notify('Back to focus', `Your ${buddy()} is picking up its quill.`);
  }
});

function notify(title, body) {
  // In the Mac app: a macOS notification whenever the app isn't in front.
  if (isMac) {
    if (state.notify && (document.hidden || !document.hasFocus())) sendMac({ type: 'notify', title, body });
    return;
  }
  if (!state.notify || !document.hidden || !('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    new Notification(title, { body, icon: 'assets/icons/icon-192.png', tag: 'pomocat' });
  } catch {
    /* some platforms only allow notifications from a service worker */
  }
}

on('levelup', (level) => {
  if (working()) return hold(`You reached level ${level}.`);
  play('levelup');
  toast(`Level ${level}! Your ${buddy()} is proud of you.`, { timeout: 6000 });
});

on('streakMilestone', (days) => hold(`${days} days running.`));
on('shieldUsed', () => hold('Your Streak Shield kept your streak going through a missed day.'));

// ── Working on (project) ────────────────────────────────────────────────────
function renderCategories() {
  const sel = $('#category');
  sel.replaceChildren(...state.categories.map((c) => el('option', { value: c.id, selected: c.id === state.category }, c.name)));
}
$('#category').addEventListener('change', (e) => {
  timer.account();
  timer.flush();
  update('category', (s) => { s.category = e.target.value; });
});
on('category', () => { renderCategories(); renderScreen(); sharePresence(); });
on('categories', () => { renderCategories(); renderScreen(); sharePresence(); });
on('tasks', () => { renderScreen(); sharePresence(); });
on('held', renderHeld);

// ── Planner ─────────────────────────────────────────────────────────────────
$('#plannerBtn').addEventListener('click', () => planner.open());
$$('[data-open-planner]').forEach((b) => b.addEventListener('click', () => planner.open(b.dataset.openPlanner)));

// Reminders: shown now, or held until your break if you're focusing.
function checkReminders() {
  const due = dueReminders();
  if (!due.length) return;
  markReminded(due.map((t) => t.id));
  for (const t of due) {
    if (working()) hold(`Reminder: ${t.title}`);
    else {
      play('chat');
      toast(`Reminder: ${t.title}`, { action: 'Open', onAction: () => planner.edit(t.id), timeout: 8000 });
      notify('Reminder', t.title);
    }
  }
}

// Tell buddies (on their break) when you finish something.
function tellBuddies(titles) {
  if (!room || !state.room.shareTask) return;
  for (const title of titles) room.sendNews(`finished “${title}”`);
}

// ── Your buddy ──────────────────────────────────────────────────────────────
let lastPet = 0;
const PET_LINES = {
  possum: ['Hm? Oh, hello.', 'A pat! Back to the book?', 'Grinning, as ever.', 'Still awake. Promise.'],
  cat: ['prrr…', 'Purr. Back to work?', 'Mrrp!', 'Head boop accepted.'],
};
function pet() {
  if (Date.now() - lastPet < 1500) return;
  lastPet = Date.now();
  scene.heart();
  if (!working()) scene.say(pick(PET_LINES[state.profile.beast] || PET_LINES.possum), 3500);
}
on('profile', () => { renderScreen(); sharePresence(); renderFriends(); });

// ── Ambience ────────────────────────────────────────────────────────────────
function timeOfDay() {
  if (state.scene.time !== 'auto') return state.scene.time;
  const h = new Date().getHours() + new Date().getMinutes() / 60;
  if (h >= 5.5 && h < 8) return 'dawn';
  if (h >= 8 && h < 17.5) return 'day';
  if (h >= 17.5 && h < 20) return 'dusk';
  return 'night';
}
const applyAmbience = () => scene.ambience({ time: timeOfDay(), weather: state.scene.weather });
on('scene', () => { applyAmbience(); renderScreen(); });

// ── Buddy rooms ─────────────────────────────────────────────────────────────
const roomDialog = $('#roomDialog');
let unread = 0;
const pawTimes = new Map();
const STATUS_LINE = { focus: 'focusing', break: 'on a break', paused: 'paused', idle: 'hanging out', away: 'away' };

function openRoomDialog(prefill = '') {
  $('#roomName').value = state.profile.name;
  $('#joinInput').value = prefill;
  renderRoomDialog();
  if (!roomDialog.open) roomDialog.showModal();
  if (!room && !state.profile.name) $('#roomName').focus();
}
$('#roomBtn').addEventListener('click', () => openRoomDialog());
$('#roomName').addEventListener('input', (e) => update('profile', (s) => { s.profile.name = e.target.value.trim().slice(0, 24); }));

function needName() {
  if (state.profile.name) return false;
  $('#roomName').focus();
  toast('Add your name first so buddies know who you are.');
  return true;
}

$('#createRoom').addEventListener('click', () => { if (!needName()) joinRoom(newRoomCode(), true); });
$('#joinForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const code = parseRoomCode($('#joinInput').value);
  if (!code) return toast('That doesn’t look like a room code or invite link.');
  if (!needName()) joinRoom(code);
});
$('#leaveRoom').addEventListener('click', () => { leaveRoom(); roomDialog.close(); });
$('#copyInvite').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText($('#inviteLink').value);
    toast('Invite link copied. Send it to a friend.');
  } catch {
    $('#inviteLink').select();
    toast('Press ⌘C or Ctrl+C to copy.');
  }
});
$('#shareTask').addEventListener('change', (e) => { update('room', (s) => { s.room.shareTask = e.target.checked; }); sharePresence(); });
$('#followToggle').addEventListener('change', (e) => {
  update('room', (s) => { s.room.follow = e.target.checked; });
  if (e.target.checked && room?.timerState) timer.apply(room.liveTimer(), room.timerState.durations);
  else if (!e.target.checked) {
    timer.release();
    timer.refreshDurations();
    toast('Using your own timer. Buddies still see how you’re doing.');
  }
  renderSync();
  sharePresence();
});

async function joinRoom(code, created = false) {
  if (room) leaveRoom(true);
  const r = new BuddyRoom(code, myPresence);
  room = r;
  r.getLiveTimer = () => (state.room.follow ? timer.snapshot() : null);
  const listen = (type, fn) => r.addEventListener(type, (e) => { if (room === r) fn(e); });

  listen('status', renderRoomStatus);
  listen('peers', () => { renderFriends(); renderRoomStatus(); });
  listen('join', (e) => hold(`${e.detail.name} joined the room.`, { sound: 'join' }));
  listen('leave', (e) => hold(`${e.detail.name} left.`));
  listen('timer', (e) => {
    if (!state.room.follow) return renderSync();
    const t = e.detail;
    const wasRunning = timer.running;
    timer.apply(t, t.durations);
    renderSync();
    const who = r.peers.get(t.from)?.name;
    if (who && t.running !== wasRunning && !working()) toast(t.running ? `${who} started the room timer` : `${who} paused the room timer`, { timeout: 3000 });
  });
  listen('chat', (e) => {
    appendChat(e.detail);
    unread += 1;
    renderBadge();
    if (!working()) play('chat');
  });
  listen('news', (e) => hold(`${e.detail.name} ${e.detail.text}.`));
  listen('paw', (e) => {
    const { to, name } = e.detail;
    if (to !== r.selfId) return;
    if (working()) return hold(`${name} sent you a paw.`);
    scene.heart();
    play('paw');
    toast(`${name} sent you a paw`, { timeout: 3000 });
  });

  update('room', (s) => { s.room.last = code; });
  history.replaceState(null, '', `#room=${encodeURIComponent(code)}`);
  renderRoomDialog();
  renderRoomStatus();
  $('#syncRow').hidden = false;
  $('#chatLog').replaceChildren(el('p', { class: 'hint' }, 'Chat is quiet. A quick “hi, working on X” goes a long way.'));
  renderFriends();
  renderSync();

  try {
    await r.join();
  } catch (err) {
    if (room === r) leaveRoom(true);
    toast(err.message || 'Couldn’t join the room.');
    return;
  }
  if (room !== r) return;
  if (created) {
    toast('Room ready. Copy the invite link and send it to a friend.');
    if (state.room.follow && (timer.running || timer.remaining < timer.total)) r.shareTimer(timer.snapshot(), timer.durations());
  } else if (roomDialog.open) roomDialog.close();
}

function leaveRoom(quiet = false) {
  if (!room) return;
  room.leave();
  room = null;
  timer.release();
  timer.refreshDurations();
  history.replaceState(null, '', location.pathname + location.search);
  $('#syncRow').hidden = true;
  unread = 0;
  renderBadge();
  renderRoomDialog();
  renderRoomStatus();
  renderFriends();
  if (!quiet) toast('You left the room.');
}

function renderRoomDialog() {
  $('#roomOut').hidden = !!room;
  $('#roomIn').hidden = !room;
  if (room) {
    $('#inviteLink').value = inviteLink(room.code);
    $('#roomCode').textContent = room.code;
    $('#shareTask').checked = state.room.shareTask;
  }
}

function renderRoomStatus() {
  const btn = $('#roomBtn');
  btn.classList.toggle('live', !!room);
  const n = room?.peers.size || 0;
  btn.querySelector('.label').textContent = room ? (n ? `${n + 1} in the room` : 'Room: just you') : 'Buddy room';
  if (!room) return;
  const text = {
    connecting: 'Connecting…',
    waiting: 'Connected. Waiting for buddies: share the link below.',
    connected: `${n + 1} of you studying together`,
    offline: 'Can’t reach the matchmaking relays. Check your connection; it keeps retrying.',
  }[room.status === 'connected' && !n ? 'waiting' : room.status];
  $('#roomStatus').textContent = text;
  $('#roomStatusDot').className = `dot ${room.status === 'connected' ? 'ok' : room.status === 'offline' ? 'bad' : 'wait'}`;
}

function renderSync() {
  $('#followToggle').checked = state.room.follow;
  const t = room?.timerState;
  const d = t?.durations;
  $('#syncNote').textContent = !room ? '' : state.room.follow
    ? t ? `Everyone focuses and breaks together (${d.focus} and ${d.short} min).` : 'Start the timer and buddies who join will follow it.'
    : 'You’re on your own timer.';
}

// Friends, on the left: quiet faces while you work; paws and chat on breaks.
function renderFriends() {
  const peers = room ? [...room.peers.entries()] : [];
  $('#roomSide').hidden = !room;
  const box = $('#roomPeople');
  if (!room) return void box.replaceChildren();
  if (!peers.length) return void box.replaceChildren(el('p', { class: 'hint' }, 'No one else yet. Share the invite link from Buddy room.'));
  box.replaceChildren(...peers.map(([id, p]) => {
    const focusing = p.status === 'focus';
    const mins = Math.ceil((p.remaining || 0) / 60e3);
    const bits = [focusing && mins ? `focusing, ${mins} min left` : STATUS_LINE[p.status]];
    if (p.category && focusing) bits.push(p.category);
    if (p.task) bits.push(p.task);
    return el('div', { class: `person${p.status === 'away' ? ' away' : ''}` },
      el('div', { class: 'medal', 'aria-hidden': 'true' }, buddyFace(p.beast, p.coat, { size: 74 })),
      el('div', { class: 'who' },
        el('div', { class: 'nm' }, p.name),
        el('div', { class: 'st' }, bits.join(', ')),
        el('button', {
          class: 'tab-btn paw-btn', type: 'button',
          title: focusing ? `${p.name} will see it on their break` : `Send ${p.name} a paw`,
          onclick: () => sendPaw({ id, name: p.name, focusing }),
        }, focusing ? 'Paw waits for their break' : 'Send a paw')));
  }));
}

function sendPaw(p) {
  if (!room) return;
  if (Date.now() - (pawTimes.get(p.id) || 0) < 3000) return;
  pawTimes.set(p.id, Date.now());
  room.sendPaw(p.id);
  play('paw');
  toast(p.focusing ? `Paw sent. ${p.name} will see it on their break.` : `You sent ${p.name} a paw`, { timeout: 2500 });
}

function appendChat(m) {
  const log = $('#chatLog');
  log.querySelector('.hint')?.remove();
  const when = new Date(m.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  log.append(el('div', { class: 'msg' }, el('b', {}, m.self ? 'You' : m.name), m.text, el('span', { class: 'when' }, when)));
  while (log.childElementCount > 150) log.firstElementChild.remove();
  log.scrollTop = 1e6;
}

function renderBadge() {
  const b = $('#chatBadge');
  b.hidden = !unread;
  b.textContent = unread > 9 ? '9+' : String(unread);
}
$('#friendsPanel').addEventListener('pointerenter', () => { unread = 0; renderBadge(); });
$('#chatForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const input = $('#chatInput');
  const msg = room?.sendChat(input.value);
  if (msg) appendChat(msg);
  input.value = '';
});

// ── Settings ────────────────────────────────────────────────────────────────
initSettings({ timer, buddyPreview });

// ── The hungry pig ──────────────────────────────────────────────────────────
initPig({ working, hold });

// ── Keyboard ────────────────────────────────────────────────────────────────
document.addEventListener('keydown', (e) => {
  if (e.code !== 'Space' || e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
  if (document.querySelector('dialog[open]') || planner.isOpen || cardsView.isOpen() || !$('#planner').hidden) return;
  if (e.target.closest('input, textarea, select, button, [contenteditable]')) return;
  e.preventDefault();
  timer.toggle();
});

// ── Ticking ─────────────────────────────────────────────────────────────────
document.addEventListener('visibilitychange', () => {
  hiddenSince = document.hidden ? Date.now() : 0;
  timer.tick();
  renderTimer();
  sharePresence();
});

function loop() {
  if (inactive) return;
  timer.tick();
  renderTimer();
  pip.update();
}
try {
  const ticker = new Worker(URL.createObjectURL(new Blob(['setInterval(() => postMessage(0), 250);'], { type: 'text/javascript' })));
  ticker.onmessage = loop;
} catch {
  setInterval(loop, 250);
}

setInterval(() => {
  if (inactive) return;
  const s = myStatus();
  if (s !== lastStatus) { lastStatus = s; renderScreen(); sharePresence(); }
  applyAmbience();
  renderCountdown();
  checkReminders();
}, 20000);
setInterval(() => { if (!inactive) archiveOld(); }, 3600e3);

// ── Start up ────────────────────────────────────────────────────────────────
on('all', () => {
  applyTheme();
  renderCategories();
  renderCountdown();
  applyAmbience();
  timer.refreshDurations();
  renderTimer();
  renderScreen();
  renderProgress();
});

archiveOld();
renderCategories();
renderCountdown();
applyAmbience();
renderTimer();
renderScreen();
renderProgress();
lastStatus = myStatus();
setTimeout(checkReminders, 1500);

if (state._migrated) toast('Brought over your tasks, notes and stats from the old version.', { timeout: 7000 });
if (finishedAway) toast(`Your ${PHASES[finishedAway].toLowerCase()} finished while you were away.`, { timeout: 7000 });
if (!state.profile.name && !state._migrated) {
  setTimeout(() => toast('Welcome! Meet your possum, and add your name in Settings.', { action: 'Open', onAction: () => $('#settingsBtn').click(), timeout: 9000 }), 800);
}

const invited = parseRoomCode(location.hash);
if (invited) {
  if (state.profile.name) joinRoom(invited);
  else openRoomDialog(invited);
}

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
