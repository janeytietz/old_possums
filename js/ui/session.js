// "This session": the few tasks you mean to do in the current focus session.
// Every [data-session] list and [data-quick-add] form on the page stays in sync.

import { state, on } from '../store.js';
import { $, $$, el, cleanText, icon } from '../util.js';
import { sessionTasks, addTask, addToSession, removeFromSession, setStatus } from '../planner.js';
import { toast } from './toast.js';

export function initSession({ onFinished, onOpenTask } = {}) {
  const toggle = $('#sessionToggle');
  const pop = $('#sessionPop');

  function render() {
    const list = sessionTasks();
    const done = list.filter((t) => t.status === 'done').length;
    for (const ul of $$('[data-session]')) {
      ul.replaceChildren(
        ...(list.length
          ? list.map((t) => el('li', { class: `s-item${t.status === 'done' ? ' done' : ''}` },
              el('input', {
                type: 'checkbox', class: 'check', checked: t.status === 'done', 'aria-label': `Done: ${t.title}`,
                onchange: (e) => {
                  const titles = setStatus(t.id, e.target.checked ? 'done' : 'doing');
                  if (titles.length) onFinished?.(titles);
                },
              }),
              el('span', { onclick: () => onOpenTask?.(t.id), style: { cursor: 'pointer' } }, t.title),
              el('button', { class: 'x', type: 'button', title: 'Take off this session', 'aria-label': `Take ${t.title} off this session`, onclick: () => removeFromSession(t.id) }, icon('x'))))
          : [el('li', { class: 's-empty' }, 'Nothing picked yet. Add a task, or pick from your planner.')]),
      );
    }
    if (toggle) toggle.textContent = list.length ? `This session: ${done} of ${list.length} done` : 'Add a task to this session';
  }

  // An optional pop-over version (the mini layouts); the main screen shows the card itself.
  toggle?.addEventListener('click', () => {
    pop.hidden = !pop.hidden;
    toggle.setAttribute('aria-expanded', String(!pop.hidden));
    if (!pop.hidden) pop.querySelector('input')?.focus();
  });

  for (const form of $$('[data-quick-add]')) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = form.querySelector('input');
      const title = cleanText(input.value, 120);
      if (!title) return;
      const t = addTask({ title, status: document.body.dataset.state === 'work' ? 'doing' : 'todo' });
      addToSession(t.id);
      input.value = '';
      input.focus();
    });
  }

  on('tasks', render);
  on('all', render);
  render();

  return {
    render,
    closePopover() { if (!pop) return; pop.hidden = true; toggle.setAttribute('aria-expanded', 'false'); },
    announceIfEmpty() { if (!sessionTasks().length) toast('Tip: add a task or two to this session first.', { timeout: 3500 }); },
  };
}
