// The scene window in the Mac app's floating panel (widget.html). The main
// window owns the timer; the Mac app hands this page its state with
// window.possumWidget.update(state), and the buttons send commands back.

import * as art from './scene/art.js';
import { beastShort } from './coats.js';

const $ = (id) => document.getElementById(id);
const POSE = { focus: 'focus', break: 'brk', paused: 'idle', idle: 'idle', away: 'away' };
const handler = window.webkit?.messageHandlers?.possum;
const send = (name) => handler?.postMessage({ type: 'command', name });

const desk = art.mount($('wBuddy'));
desk.setBeast({ beast: 'possum', pose: 'idle' });
let current = null;

function clock(ms) {
  const total = Math.ceil(Math.max(0, ms) / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function tick() {
  if (!current) return;
  const left = current.running && current.endsAt ? current.endsAt - Date.now() : current.remaining;
  $('wTime').textContent = clock(left);
}

window.possumWidget = {
  update(s) {
    current = s;
    document.body.dataset.phase = s.phase;
    document.body.dataset.backdrop = s.backdrop || 'parchment';
    $('wPhase').textContent = s.phaseLabel;
    $('wToggle').textContent = s.toggleLabel;
    // The task you're on, with a tick box: tick it and the next in this session takes its place.
    const onTask = s.phase === 'focus' && !!s.taskId;
    $('wTask').textContent = s.phase === 'focus' ? s.task || (s.running ? 'Focus time' : 'Ready when you are') : 'Quill down. A break.';
    $('wTask').title = onTask ? s.task : ''; // the whole name on hover when it's cut short
    $('wDone').hidden = !onTask;
    $('wDone').checked = false;
    $('wDone').setAttribute('aria-label', onTask ? `Done: ${s.task}` : 'Done');
    $('wNext').textContent = onTask && s.next ? `Then: ${s.next}` : '';
    $('wBuddies').textContent = s.buddies ? `${s.buddies} ${s.buddies === 1 ? 'buddy' : 'buddies'} working with you` : '';
    $('wBuddy').setAttribute('aria-label', `Your ${beastShort(s.beast)} at its desk`);
    desk.setBeast({ beast: s.beast, coat: s.coat, pose: POSE[s.status] || 'idle' });
    tick();
    requestAnimationFrame(reportButtons); // labels change width
  },
};

// The Mac app drags the window from anywhere except these (mac/.../WidgetPanel.swift).
let lastButtons = '';
function reportButtons() {
  const rects = [...document.querySelectorAll('button, a, input, select, textarea')]
    .filter((b) => b.offsetParent !== null)
    .map((b) => { const r = b.getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) }; });
  const key = JSON.stringify(rects);
  if (key === lastButtons) return;
  lastButtons = key;
  handler?.postMessage({ type: 'widgetHotspots', rects });
}
window.addEventListener('resize', reportButtons);
document.fonts?.ready.then(reportButtons);

$('wDone').addEventListener('change', () => {
  if (current?.taskId) handler?.postMessage({ type: 'command', name: 'completeTask', id: current.taskId });
});
$('wToggle').addEventListener('click', () => send('toggle'));
$('wSkip').addEventListener('click', () => send('skip'));
$('wOpen').addEventListener('click', () => send('showMain'));
setInterval(tick, 250);
// Ready: ask the Mac app for the current state (it may have been sent before this page loaded).
handler?.postMessage({ type: 'widgetReady' });
reportButtons();
