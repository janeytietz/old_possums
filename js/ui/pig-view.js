// The hungry pig on screen: at the edge of the desk on the timer screens, and in
// the corner of the planner (drop a finished task on it to archive it now).
//
//   initPig({ working, hold })   working(): are you focusing?  hold(text): say it on your break

import { state, on } from '../store.js';
import { $, el } from '../util.js';
import { taskById } from '../planner.js';
import { feed, letGo, makeTask, eatTasks, ateTasks, PIG_SVG } from '../pig.js';
import { toast } from './toast.js';

export function initPig({ working, hold }) {
  const pig = $('#pig');
  const pop = $('#pigPop');
  const input = $('#pigInput');
  const plannerPig = $('#plannerPig');
  for (const b of [pig, plannerPig]) b.insertAdjacentHTML('afterbegin', PIG_SVG);

  function chomp() {
    for (const b of [pig, plannerPig]) {
      b.classList.remove('chomp');
      void b.offsetWidth;
      b.classList.add('chomp');
    }
  }

  // ── Feeding it a stray thought ──
  function openPop() {
    pop.hidden = false;
    $('#pigSaid').textContent = '';
    pig.setAttribute('aria-expanded', 'true');
    input.focus();
  }
  function closePop() {
    pop.hidden = true;
    pig.setAttribute('aria-expanded', 'false');
  }
  pig.addEventListener('click', () => (pop.hidden ? openPop() : closePop()));
  $('#pigClose').addEventListener('click', closePop);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !pop.hidden) closePop(); });
  document.addEventListener('pointerdown', (e) => {
    if (!pop.hidden && !pop.contains(e.target) && !pig.contains(e.target)) closePop();
  });
  $('#pigForm').addEventListener('submit', (e) => {
    e.preventDefault();
    if (!feed(input.value)) return;
    input.value = '';
    $('#pigSaid').textContent = working() ? 'Munched. You’ll get it back on your break.' : 'Munched. It’s keeping it for you.';
    input.focus();
  });

  // ── What it kept, on your break ──
  function render() {
    const list = state.pig.thoughts;
    const badge = $('#pigBadge');
    badge.hidden = !list.length;
    badge.textContent = String(list.length);
    const eaten = state.pig.eaten;
    pig.setAttribute('aria-label', `The hungry pig${list.length ? `, keeping ${list.length} ${list.length === 1 ? 'thought' : 'thoughts'}` : ''}. Feed it a stray thought.`);
    pig.title = `Feed the pig a stray thought${eaten ? `. It has eaten ${eaten} finished ${eaten === 1 ? 'task' : 'tasks'}.` : '.'}`;
    plannerPig.title = `Drop a finished task here and the pig eats it (it goes to the archive)${eaten ? `. Eaten so far: ${eaten}.` : '.'}`;
    $('#pigKept').hidden = !list.length;
    $('#pigList').replaceChildren(...list.map((t) => el('li', {},
      el('span', { class: 'thought' }, t.text),
      el('span', { class: 'pig-acts' },
        el('button', { class: 'link-btn', type: 'button', onclick: () => { makeTask(t.id); toast(`Added to your planner: ${t.text}`, { timeout: 2500 }); } }, 'Make it a task'),
        el('button', { class: 'link-btn', type: 'button', onclick: () => letGo(t.id) }, 'Let it go')))));
  }

  // ── Eating finished tasks ──
  plannerPig.addEventListener('dragover', (e) => { e.preventDefault(); plannerPig.classList.add('drop'); });
  plannerPig.addEventListener('dragleave', () => plannerPig.classList.remove('drop'));
  plannerPig.addEventListener('drop', (e) => {
    e.preventDefault();
    plannerPig.classList.remove('drop');
    const id = e.dataTransfer.getData('text/plain');
    const t = id && taskById(id);
    if (!t) return;
    if (t.status !== 'done') return toast('The pig only eats finished tasks. Tick it off first.', { timeout: 3500 });
    if (eatTasks([id])) toast(`Eaten: ${t.title}. It’s in the archive now.`, { timeout: 3000 });
  });
  plannerPig.addEventListener('click', () => toast('Drop a finished task on the pig and it goes to the archive.', { timeout: 3500 }));

  on('archived', (n) => {
    ateTasks(n);
    const line = n === 1 ? 'The pig ate a finished task from last week.' : `The pig ate ${n} finished tasks from last week.`;
    if (working()) hold(line);
    else toast(line, { timeout: 3500 });
  });
  on('pigAte', chomp);
  on('pig', render);
  on('all', render);
  render();

  return { chomp };
}
