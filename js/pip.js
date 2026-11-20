// The scene window: a small window that floats above your other windows
// (Document Picture-in-Picture, Chrome and Edge on desktop; the button stays
// hidden elsewhere). Your buddy at its desk on the left, the time on the right,
// this session's task and the buttons under it, a vine in the corner.
//
//   const pip = initPip({ timer, buddies, task, look })
//     buddies(): how many friends are in the room
//     task():    the task you're on ('' if none)
//     look():    { beast, coat, status, backdrop }
//   pip.update()   call whenever the timer or your buddy changes

import { $, el, fmtClock } from './util.js';
import { PHASES } from './timer.js';
import { beastShort } from './coats.js';
import * as art from './scene/art.js';
import { toast } from './ui/toast.js';
import { isMac, send } from './native.js';

const POSE = { focus: 'focus', break: 'brk', paused: 'idle', idle: 'idle', away: 'away' };

export function initPip({ timer, buddies, task, look }) {
  const btn = $('#pipBtn');
  // In the Mac app the scene window is a native floating panel (widget.html).
  if (isMac) {
    btn.hidden = false;
    btn.addEventListener('click', () => send({ type: 'widget' }));
    return { update() {} };
  }
  if (!('documentPictureInPicture' in window)) return { update() {} };
  btn.hidden = false;

  let win = null;
  let ui = null;

  btn.addEventListener('click', async () => {
    if (win) return win.close();
    try {
      win = await window.documentPictureInPicture.requestWindow({ width: 480, height: 320 });
    } catch {
      win = null;
      toast('This browser couldn’t open the scene window.');
      return;
    }
    const doc = win.document;
    // Our styles, theme and the pen-wobble filters come along.
    for (const sheet of document.styleSheets) {
      try {
        const style = doc.createElement('style');
        style.textContent = [...sheet.cssRules].map((r) => r.cssText).join('\n');
        doc.head.append(style);
      } catch {
        if (sheet.href) doc.head.append(Object.assign(doc.createElement('link'), { rel: 'stylesheet', href: sheet.href }));
      }
    }
    for (const a of document.documentElement.attributes) doc.documentElement.setAttribute(a.name, a.value);
    doc.body.append(doc.importNode($('.ink-defs'), true));
    doc.body.className = 'widget';

    const scene = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
    scene.setAttribute('role', 'img');
    scene.classList.add('widget-buddy');
    const desk = art.mount(scene);
    ui = {
      desk,
      scene,
      phase: el('p', { class: 'w-phase' }),
      time: el('p', { class: 'w-time', role: 'timer' }),
      task: el('p', { class: 'w-task' }),
      buddies: el('p', { class: 'w-buddies' }),
      toggle: el('button', { class: 'ink-btn main', type: 'button', onclick: () => timer.toggle() }),
      skip: el('button', { class: 'ink-btn', type: 'button', onclick: () => timer.skip(), 'aria-label': 'Skip to the next phase' }, 'Skip'),
    };
    doc.body.append(
      el('header', { class: 'w-band' },
        el('span', { class: 'w-title' }, el('span', { class: 'initial' }, 'O'), 'ld Possum’s Book of Productivity'),
        el('button', { class: 'link-btn', type: 'button', onclick: () => { win?.close(); window.focus(); } }, 'Back to the app')),
      el('img', { class: 'w-vine', src: new URL('assets/art/margins/bottom-sprig.png', location.href).href, alt: '' }),
      scene,
      el('section', { class: 'w-clock', 'aria-label': 'Timer' },
        ui.phase, ui.time, ui.task,
        el('div', { class: 'w-buttons' }, ui.toggle, ui.skip),
        ui.buddies),
      el('span', { class: 'w-frame', 'aria-hidden': 'true' }),
    );
    win.addEventListener('pagehide', () => {
      win = null;
      ui = null;
      btn.setAttribute('aria-pressed', 'false');
    });
    btn.setAttribute('aria-pressed', 'true');
    update();
  });

  function update() {
    if (!win || !ui) return;
    const { beast, coat, status, backdrop } = look();
    const doc = win.document;
    doc.body.dataset.phase = timer.phase;
    doc.body.dataset.backdrop = backdrop;
    const clock = fmtClock(timer.remaining);
    const fresh = !timer.running && timer.remaining >= timer.total - 500;
    ui.phase.textContent = PHASES[timer.phase];
    ui.time.textContent = clock;
    ui.toggle.textContent = timer.running ? 'Pause' : fresh ? (timer.phase === 'focus' ? 'Start focus' : 'Start break') : 'Resume';
    const t = task();
    ui.task.textContent = timer.phase === 'focus' ? t || (timer.running ? 'Focus time' : 'Ready when you are') : 'Quill down. A break.';
    const n = buddies();
    ui.buddies.textContent = n ? `${n} ${n === 1 ? 'buddy' : 'buddies'} working with you` : '';
    ui.scene.setAttribute('aria-label', `Your ${beastShort(beast)} at its desk`);
    ui.desk.setBeast({ beast, coat, pose: POSE[status] || 'idle' });
    doc.title = timer.running ? `${clock} ${PHASES[timer.phase]}` : 'Old Possum';
  }

  return { update };
}
