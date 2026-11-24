// "This session": the few tasks you mean to do in the current focus session.
// Every [data-session] list and [data-quick-add] form on the page stays in sync.
// Drag the tasks (or Alt + arrow keys) to change the order: the first unfinished
// one, marked with a pointing hand, is what you're on, and what the mini player shows.

import { state, on } from '../store.js';
import { $, $$, el, cleanText, icon } from '../util.js';
import { sessionTasks, currentSessionTask, addTask, addToSession, removeFromSession, setStatus, reorderSession, moveInSession } from '../planner.js';
import { toast } from './toast.js';

let dragging = null; // the id being dragged

function enableReorder(li, id, ul) {
  li.addEventListener('dragstart', (e) => {
    if (e.target.closest('input, button')) return e.preventDefault();
    dragging = id;
    li.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
  });
  li.addEventListener('dragend', () => {
    dragging = null;
    for (const x of ul.querySelectorAll('.dragging, .drop-before, .drop-after')) x.classList.remove('dragging', 'drop-before', 'drop-after');
  });
  li.addEventListener('dragover', (e) => {
    if (!dragging || dragging === id) return;
    e.preventDefault();
    const box = li.getBoundingClientRect();
    const after = e.clientY > box.top + box.height / 2;
    li.classList.toggle('drop-after', after);
    li.classList.toggle('drop-before', !after);
  });
  li.addEventListener('dragleave', () => li.classList.remove('drop-before', 'drop-after'));
  li.addEventListener('drop', (e) => {
    e.preventDefault();
    const moved = dragging;
    const after = li.classList.contains('drop-after');
    li.classList.remove('drop-before', 'drop-after');
    if (!moved || moved === id) return;
    const ids = state.session.taskIds.filter((x) => x !== moved);
    ids.splice(ids.indexOf(id) + (after ? 1 : 0), 0, moved);
    reorderSession(ids);
  });
  // Alt + up/down from the tick box moves it too.
  li.addEventListener('keydown', (e) => {
    if (!e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
    e.preventDefault();
    moveInSession(id, e.key === 'ArrowUp' ? -1 : 1);
    ul.querySelector(`[data-id="${id}"] .check`)?.focus();
  });
}

export function initSession({ onFinished, onOpenTask } = {}) {
  const toggle = $('#sessionToggle');
  const pop = $('#sessionPop');

  function render() {
    const list = sessionTasks();
    const done = list.filter((t) => t.status === 'done').length;
    const now = currentSessionTask();
    const many = list.length > 1;
    for (const ul of $$('[data-session]')) {
      ul.replaceChildren(
        ...(list.length
          ? list.map((t) => {
              const li = el('li', {
                class: `s-item${t.status === 'done' ? ' done' : ''}${t === now ? ' now' : ''}`,
                dataset: { id: t.id },
                draggable: many ? 'true' : null,
                title: many ? 'Drag to change the order (or Alt and the arrow keys)' : null,
              },
              el('input', {
                type: 'checkbox', class: 'check', checked: t.status === 'done', 'aria-label': `Done: ${t.title}`,
                onchange: (e) => {
                  const titles = setStatus(t.id, e.target.checked ? 'done' : 'doing');
                  if (titles.length) onFinished?.(titles);
                },
              }),
              el('span', { class: 's-title', onclick: () => onOpenTask?.(t.id) },
                t === now && many ? el('span', { class: 'sr-only' }, 'Now: ') : null, t.title),
              el('button', { class: 'x', type: 'button', title: 'Take off this session', 'aria-label': `Take ${t.title} off this session`, onclick: () => removeFromSession(t.id) }, icon('x')));
              if (many) enableReorder(li, t.id, ul);
              return li;
            })
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
