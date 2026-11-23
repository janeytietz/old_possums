// Your buddy at its desk, under the timer. One beast, the heart of the screen.
//
//   const scene = createScene(el, { onBuddyClick })
//   scene.update({ beast, coat, status })   status: focus / break / paused / idle / away
//   scene.say('text')                        speech bubble next to its head
//   scene.heart()                            little hearts (a paw from a friend, a pet)
//   scene.ambience({ time, weather })

import { el, icon, inscribe } from '../util.js';
import { beastShort } from '../coats.js';
import * as art from './art.js';

const POSE = { focus: 'focus', break: 'brk', paused: 'idle', idle: 'idle', away: 'away' };

export function createScene(root, { onBuddyClick } = {}) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('role', 'img');
  const hit = el('button', { class: 'buddy-hit', type: 'button' });
  const bubble = el('div', { class: 'bubble', hidden: true, role: 'status' });
  root.replaceChildren(svg, hit, bubble);
  const desk = art.mount(svg);
  let bubbleTimer = null;

  hit.addEventListener('click', () => onBuddyClick?.());

  function place() {
    const box = desk.headBox();
    if (!box || !box.width) return;
    const host = root.getBoundingClientRect();
    Object.assign(hit.style, {
      left: `${box.left - host.left}px`,
      top: `${box.top - host.top}px`,
      width: `${box.width}px`,
      height: `${box.height * 1.3}px`,
    });
    // Beside the head (not above it, where the timer controls are).
    bubble.style.left = `${box.right - host.left - box.width * 0.05}px`;
    bubble.style.top = `${box.top - host.top + box.height * 0.3}px`;
  }
  new ResizeObserver(place).observe(root);
  svg.addEventListener('art:drawn', () => requestAnimationFrame(place));

  function update({ beast, coat, status }) {
    const name = beastShort(beast);
    svg.setAttribute('aria-label', `Your ${name} at its desk`);
    hit.setAttribute('aria-label', `Pet your ${name}`);
    desk.setBeast({ beast, coat, pose: POSE[status] || 'idle' });
    requestAnimationFrame(place);
  }

  function say(text, ms = 8000) {
    delete bubble.dataset.inscribed; // write it out afresh each time it speaks
    inscribe(bubble, text);
    bubble.hidden = false;
    bubble.classList.remove('show');
    void bubble.offsetWidth;
    bubble.classList.add('show');
    place();
    clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(() => { bubble.hidden = true; }, ms);
  }

  function hush() {
    clearTimeout(bubbleTimer);
    bubble.hidden = true;
  }

  function heart() {
    const box = desk.headBox();
    if (!box) return;
    const host = root.getBoundingClientRect();
    for (let i = 0; i < 3; i++) {
      const h = el('div', { class: 'heart', 'aria-hidden': 'true' }, icon('heart', { filled: true }));
      Object.assign(h.style, {
        left: `${box.left - host.left + box.width * (0.35 + i * 0.15)}px`,
        top: `${box.top - host.top}px`,
        animationDelay: `${i * 0.18}s`,
      });
      root.append(h);
      setTimeout(() => h.remove(), 2200);
    }
  }

  return { update, say, hush, heart, ambience: (a) => desk.ambience(a) };
}

export const buddyPreview = (beast, coat) => art.preview(beast, coat);
export const buddyFace = (beast, coat, opts) => art.face(beast, coat, opts);
