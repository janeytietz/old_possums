// The hungry pig: a pig-faced tub at the edge of the desk (a nod to Porky the
// Litter Eater, drawn our own way). It does two jobs:
//   - while you focus, you feed it stray thoughts; it hands them back on your
//     break, where each becomes a task or is let go;
//   - it eats finished tasks as they go to the archive (planner.js archiveOld),
//     or straight away if you drop a finished task on it in the planner.

import { state, update, emit } from './store.js';
import { uid, cleanText } from './util.js';
import { addTask } from './planner.js';

export function feed(text) {
  const clean = cleanText(text, 200);
  if (!clean) return null;
  const thought = { id: uid(), text: clean, at: Date.now() };
  update('pig', (s) => { s.pig.thoughts.push(thought); s.pig.thoughts = s.pig.thoughts.slice(-50); });
  emit('pigAte', { kind: 'thought' });
  return thought;
}

/** Let a thought go for good (the pig keeps it). */
export function letGo(id) {
  update('pig', (s) => { s.pig.thoughts = s.pig.thoughts.filter((t) => t.id !== id); });
}

/** Turn a thought it was keeping into a task. */
export function makeTask(id, fields = {}) {
  const t = state.pig.thoughts.find((x) => x.id === id);
  if (!t) return null;
  letGo(id);
  return addTask({ title: t.text, ...fields });
}

/** Archive finished tasks into the pig now. Returns how many it ate. */
export function eatTasks(ids) {
  let n = 0;
  update('tasks', (s) => {
    for (const t of s.tasks) if (ids.includes(t.id) && t.status === 'done' && !t.archived) { t.archived = true; n += 1; }
  });
  if (n) ateTasks(n);
  return n;
}

/** Count tasks it ate (also called when old finished tasks are archived). */
export function ateTasks(n) {
  if (!n) return;
  update('pig', (s) => { s.pig.eaten += n; });
  emit('pigAte', { kind: 'tasks', n });
}

// ── The drawing: inked wooden tub, iron hoops, a pig's face on the front ────
// The mouth is its own group (.pig-mouth) so it can open for a chomp.
export const PIG_SVG = `<svg class="pig-art" viewBox="0 0 120 132" aria-hidden="true">
  <path d="M27 34 C 20 18 24 7 33 3 C 40 13 45 23 44 33 Z" fill="#e7a593" stroke="#1c1913" stroke-width="2.6" stroke-linejoin="round"/>
  <path d="M93 34 C 100 18 96 7 87 3 C 80 13 75 23 76 33 Z" fill="#e7a593" stroke="#1c1913" stroke-width="2.6" stroke-linejoin="round"/>
  <path d="M31 28 C 28 20 29 14 33 10 M89 28 C 92 20 91 14 87 10" fill="none" stroke="#b9685a" stroke-width="2" stroke-linecap="round"/>
  <path d="M16 36 C 40 30 80 30 104 36 L 98 120 C 74 127 46 127 22 120 Z" fill="#a4713f" stroke="#1c1913" stroke-width="3" stroke-linejoin="round"/>
  <path d="M37 41 L 39 123 M83 41 L 81 123" stroke="#6e4825" stroke-width="1.6" opacity="0.8"/>
  <path d="M14 36 C 40 25 80 25 106 36 C 80 45 40 45 14 36 Z" fill="#3b2a1c" stroke="#1c1913" stroke-width="3" stroke-linejoin="round"/>
  <path d="M19 52 C 44 58 76 58 101 52" fill="none" stroke="#1c1913" stroke-width="6.5"/>
  <path d="M19 52 C 44 58 76 58 101 52" fill="none" stroke="#77756c" stroke-width="3.2"/>
  <path d="M22 108 C 46 114 74 114 98 108" fill="none" stroke="#1c1913" stroke-width="6.5"/>
  <path d="M22 108 C 46 114 74 114 98 108" fill="none" stroke="#77756c" stroke-width="3.2"/>
  <path d="M30 79 C 30 63 44 57 60 57 C 76 57 90 63 90 79 C 90 95 76 103 60 103 C 44 103 30 95 30 79 Z" fill="#eab0a0" stroke="#1c1913" stroke-width="2.6"/>
  <path d="M42 66 C 44 63.5 48 63.5 50 65.5 M70 65.5 C 72 63.5 76 63.5 78 66" fill="none" stroke="#1c1913" stroke-width="2" stroke-linecap="round"/>
  <ellipse cx="46" cy="70" rx="3.2" ry="3.8" fill="#1c1913"/><circle cx="47" cy="68.8" r="1" fill="#fff8ec"/>
  <ellipse cx="74" cy="70" rx="3.2" ry="3.8" fill="#1c1913"/><circle cx="75" cy="68.8" r="1" fill="#fff8ec"/>
  <circle cx="37" cy="83" r="4.5" fill="#df8e7c" opacity="0.7"/><circle cx="83" cy="83" r="4.5" fill="#df8e7c" opacity="0.7"/>
  <g class="pig-mouth"><path d="M45 90 C 51 99.5 69 99.5 75 90 C 68 93.5 52 93.5 45 90 Z" fill="#4a2119" stroke="#1c1913" stroke-width="2.4" stroke-linejoin="round"/><path d="M52 92.4 L 54 95.6 L 56 92.8 M64 92.8 L 66 95.6 L 68 92.4" fill="#fbf1d8" stroke="#1c1913" stroke-width="1" stroke-linejoin="round"/></g>
  <ellipse cx="60" cy="80" rx="12.5" ry="8.5" fill="#dc8a7b" stroke="#1c1913" stroke-width="2.6"/>
  <ellipse cx="55.5" cy="80" rx="2" ry="3.2" fill="#1c1913"/><ellipse cx="64.5" cy="80" rx="2" ry="3.2" fill="#1c1913"/>
</svg>`;
