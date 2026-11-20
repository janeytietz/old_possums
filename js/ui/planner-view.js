// The planner: the whole page is one sheet of the book, with your buddy peering
// over its top edge. Pages (ribbon bookmarks): Today, Week (the spread), Columns
// (a column per day, drag tasks between them), Board, Month, Projects, Archive,
// Tally and Notes, plus the task editor.

import { state, update, on } from '../store.js';
import { $, $$, el, dayKey, cleanText } from '../util.js';
import {
  STATUSES, FOLLOW, REPEATS, projects, projectById, projectName, projectColor, taskById, live, childrenOf,
  sortTasks, filtered, addDays, dueState, dueLabel, addTask, editTask, setStatus, removeTask, restoreTasks,
  addToSession, addProject,
} from '../planner.js';
import { renderStats } from './stats.js';
import { sortNotes } from '../notes-sort.js';
import { feed } from '../pig.js';
import { sortWithClaude, hasKey, SortError } from '../claude-sort.js';
import { sortOnThisMac, macSort } from '../mac-sort.js';
import { isMac } from '../native.js';
import { toast } from './toast.js';

let weekOffset = 0;
let monthOffset = 0;
let openProject = null;
let archiveQuery = '';
let suggestions = null; // from sorting, until you sort again
let sortedBy = '';       // 'mac', 'claude' or 'here'
let busy = '';           // 'mac' or 'claude' while sorting

export function initPlanner({ onFinished } = {}) {
  const root = $('#planner');
  const body = $('#plannerBody');
  const dlg = $('#taskDialog');
  let editingId = null;

  const tab = () => state.planner.tab || 'board';
  const setTab = (t) => update('planner', (s) => { s.planner.tab = t; });

  // ── Shell ──
  function open(t) {
    if (t) setTab(t);
    root.hidden = false;
    render();
  }
  function close() {
    root.hidden = true;
  }
  $('#closePlanner').addEventListener('click', close);
  $$('[data-ptab]').forEach((b) => b.addEventListener('click', () => { openProject = null; setTab(b.dataset.ptab); }));
  $('#newTask').addEventListener('click', () => {
    const pid = state.planner.project !== 'all' ? state.planner.project : openProject || state.category;
    const t = addTask({ title: 'New task', projectId: pid || '' });
    edit(t.id, { select: true });
  });
  $('#plannerProject').addEventListener('change', (e) => update('planner', (s) => { s.planner.project = e.target.value; }));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !root.hidden && !dlg.open) close();
  });

  function renderProjectFilter() {
    const sel = $('#plannerProject');
    sel.replaceChildren(
      el('option', { value: 'all' }, 'All projects'),
      ...projects().map((p) => el('option', { value: p.id }, p.name)),
    );
    sel.value = state.planner.project || 'all';
    if (sel.value !== (state.planner.project || 'all')) sel.value = 'all';
  }

  // Your buddy's head goes behind the sheet; its paws (and the possum's snout)
  // come over the edge in front. Same drawing, lined up exactly.
  const PEEK = {
    possum: { head: 'assets/art/possum-writing.svg', snout: 'assets/art/possum-snout.svg', paw: 'assets/art/possum-paw.svg' },
    cat: { head: 'assets/art/cat-writing.svg', snout: '', paw: 'assets/art/paw.svg' },
  };
  function renderPeek() {
    const beast = PEEK[state.profile.beast] ? state.profile.beast : 'possum';
    if (root.dataset.beast === beast) return;
    root.dataset.beast = beast;
    const art = PEEK[beast];
    $('#peekHead').src = art.head;
    $('#peekSnout').src = art.snout || '';
    $('#peekSnout').hidden = !art.snout;
    for (const img of root.querySelectorAll('.peek-paws img')) img.src = art.paw;
  }

  function render() {
    if (root.hidden) return;
    renderPeek();
    renderProjectFilter();
    $$('[data-ptab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.ptab === tab())));
    $('#plannerProject').hidden = ['projects', 'progress', 'notes'].includes(tab());
    const views = { today, week, columns, board, projects: projectsView, calendar, archive, progress, notes };
    // Pages without their own heading row get one, under the ribbons.
    const TITLES = { board: 'The board', projects: 'Projects', archive: 'The archive', progress: 'The tally', notes: 'Pour out your notes' };
    const page = (views[tab()] || board)();
    const titled = TITLES[tab()] && !(tab() === 'projects' && openProject);
    body.replaceChildren(...(titled ? [el('div', { class: 'nav-row' }, el('h3', { class: 'page-title' }, TITLES[tab()])), page] : [page]));
  }

  // ── Bits ──
  function finish(id, done) {
    const titles = setStatus(id, done ? 'done' : 'todo');
    if (titles.length) onFinished?.(titles);
  }

  function chips(t) {
    const out = [];
    if (t.projectId) out.push(el('span', { class: 'tag', style: { background: projectColor(t.projectId), borderColor: 'transparent', color: '#4a3628' } }, projectName(t.projectId)));
    if (t.due) out.push(el('span', { class: `tag ${dueState(t)}` }, dueLabel(t.due)));
    if (t.remindAt) out.push(el('span', { class: 'tag' }, `Reminder ${t.remindAt.slice(11, 16)}`));
    if (t.repeat) out.push(el('span', { class: 'tag' }, REPEATS[t.repeat]));
    if (t.tags.includes(FOLLOW)) out.push(el('span', { class: 'tag follow' }, t.followUpOn ? `Follow up ${dueLabel(t.followUpOn)}` : 'Follow up'));
    t.tags.filter((x) => x !== FOLLOW).forEach((x) => out.push(el('span', { class: 'tag' }, `#${x}`)));
    const kids = childrenOf(t.id);
    if (kids.length) out.push(el('span', { class: 'tag' }, `${kids.filter((k) => k.status === 'done').length} of ${kids.length} steps`));
    if (t.parentId && taskById(t.parentId)) out.push(el('span', { class: 'tag' }, `Part of ${taskById(t.parentId).title}`));
    return out.length ? el('div', { class: 'meta' }, out) : null;
  }

  function checkbox(t) {
    return el('input', {
      type: 'checkbox', class: 'check', checked: t.status === 'done', 'aria-label': `Done: ${t.title}`,
      onclick: (e) => e.stopPropagation(),
      onchange: (e) => finish(t.id, e.target.checked),
    });
  }

  // A project's initial, inked in its colour, like the initials in the canvas.
  function initial(t) {
    if (!t.projectId) return null;
    const name = projectName(t.projectId);
    return el('span', { class: 'p-initial', style: { background: projectColor(t.projectId) }, title: name, 'aria-label': name }, (name[0] || '?').toUpperCase());
  }

  function card(t) {
    const late = t.status !== 'done' && t.due && t.due < dayKey();
    const c = el('div', { class: `card${t.status === 'done' ? ' is-done' : ''}${late ? ' is-late' : ''}`, draggable: 'true', dataset: { id: t.id }, tabindex: '0', role: 'button', 'aria-label': t.title },
      el('div', { class: 't' }, checkbox(t), initial(t), el('span', {}, t.title)), chips(t));
    c.addEventListener('click', () => edit(t.id));
    c.addEventListener('keydown', (e) => { if (e.key === 'Enter') edit(t.id); });
    c.addEventListener('dragstart', (e) => { c.classList.add('dragging'); root.classList.add('dragging'); e.dataTransfer.setData('text/plain', t.id); e.dataTransfer.effectAllowed = 'move'; });
    c.addEventListener('dragend', () => { c.classList.remove('dragging'); root.classList.remove('dragging'); });
    return c;
  }

  function row(t, { session = true } = {}) {
    const r = el('div', { class: `row-task${t.status === 'done' ? ' is-done' : ''}`, tabindex: '0', role: 'button' },
      checkbox(t), el('span', { class: 'title' }, t.title), chips(t),
      session && t.status !== 'done' && !state.session.taskIds.includes(t.id)
        ? el('button', { class: 's-add', type: 'button', title: 'Add to this session', onclick: (e) => { e.stopPropagation(); addToSession(t.id); toast(`Added to this session: ${t.title}`, { timeout: 2200 }); } }, 'Add to session')
        : null);
    r.addEventListener('click', () => edit(t.id));
    r.addEventListener('keydown', (e) => { if (e.key === 'Enter') edit(t.id); });
    return r;
  }

  function dropZone(node, onDrop) {
    node.addEventListener('dragover', (e) => { e.preventDefault(); node.classList.add('drop'); });
    node.addEventListener('dragleave', (e) => { if (!node.contains(e.relatedTarget)) node.classList.remove('drop'); });
    node.addEventListener('drop', (e) => {
      e.preventDefault();
      node.classList.remove('drop');
      const id = e.dataTransfer.getData('text/plain');
      if (id) onDrop(id);
    });
    return node;
  }

  function addLine(placeholder, fields) {
    const input = el('input', { type: 'text', maxlength: '120', placeholder, 'aria-label': placeholder });
    const form = el('form', { class: 'add-line', autocomplete: 'off' }, input);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const title = cleanText(input.value, 120);
      if (!title) return;
      addTask({ title, ...fields() });
      input.value = '';
      requestAnimationFrame(() => body.querySelector(`input[placeholder="${placeholder}"]`)?.focus());
    });
    return form;
  }

  const projectFields = () => (state.planner.project && state.planner.project !== 'all' ? { projectId: state.planner.project } : {});

  // ── Views ──
  function today() {
    const all = filtered().filter((t) => t.status !== 'done' || t.doneAt > Date.now() - 86400000);
    const k = dayKey();
    const soon = addDays(k, 7);
    const overdue = all.filter((t) => t.status !== 'done' && t.due && t.due < k);
    const dueToday = all.filter((t) => t.due === k);
    const doing = all.filter((t) => t.status === 'doing' && t.due !== k && !(t.due && t.due < k));
    const coming = all.filter((t) => t.status !== 'done' && t.due > k && t.due <= soon).sort((a, b) => a.due.localeCompare(b.due));
    const section = (title, list) => (list.length ? [el('h3', {}, title), ...list.map((t) => row(t))] : []);
    const wrap = el('div', { class: 'list' },
      el('div', { class: 'nav-row' }, el('h3', {}, new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' }))),
      addLine('Add a task for today', () => ({ due: k, ...projectFields() })),
      ...section('Overdue', overdue), ...section('Today', dueToday), ...section('Doing', doing), ...section('Coming up this week', coming));
    if (!overdue.length && !dueToday.length && !doing.length && !coming.length) wrap.append(el('p', { class: 'empty' }, 'Nothing due today. Add a task above, or plan your week.'));
    return wrap;
  }

  function startOfWeek(offset) {
    const d = new Date();
    const dow = (d.getDay() + 6) % 7; // Monday = 0
    d.setDate(d.getDate() - dow + offset * 7);
    return dayKey(d);
  }
  const weekDays = () => Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(weekOffset), i));
  const fmtDay = (d, opts) => new Date(`${d}T12:00:00`).toLocaleDateString(undefined, opts);
  // "Monday 16" / "Mon 16", the same in every locale's order.
  const dayLong = (d) => `${fmtDay(d, { weekday: 'long' })} ${Number(d.slice(8, 10))}`;
  const dayShort = (d) => `${fmtDay(d, { weekday: 'short' })} ${Number(d.slice(8, 10))}`;
  const setWeekend = (open) => update('planner', (s) => { s.planner.weekend = open; });

  // "16 to 22 November", with the red initial, between the arrows.
  function weekNav(days) {
    // "16 to 22 November", or "30 November to 6 December" across a month's end.
    const num = (d) => Number(d.slice(8, 10));
    const month = (d) => fmtDay(d, { month: 'long' });
    const label = month(days[0]) === month(days[6])
      ? `${num(days[0])} to ${num(days[6])} ${month(days[6])}`
      : `${num(days[0])} ${month(days[0])} to ${num(days[6])} ${month(days[6])}`;
    return el('div', { class: 'nav-row' },
      el('button', { class: 'round', type: 'button', 'aria-label': 'Previous week', onclick: () => { weekOffset -= 1; render(); } }, '‹'),
      el('h3', { class: 'page-title' }, label),
      el('button', { class: 'round', type: 'button', 'aria-label': 'Next week', onclick: () => { weekOffset += 1; render(); } }, '›'),
      weekOffset ? el('button', { class: 'link-btn', type: 'button', onclick: () => { weekOffset = 0; render(); } }, 'Back to this week') : null);
  }

  // Week: the spread. Days down the left page, notes for the week on the right.
  function week() {
    const days = weekDays();
    const all = filtered();
    const k = dayKey();
    const entry = (t) => {
      const late = t.status !== 'done' && t.due < k;
      const e = el('span', { class: `entry${t.status === 'done' ? ' is-done' : ''}${late ? ' is-late' : ''}`, tabindex: '0', role: 'button' }, checkbox(t), initial(t), el('span', { class: 'title' }, t.title));
      e.addEventListener('click', () => edit(t.id));
      e.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') edit(t.id); });
      return e;
    };
    const dayRow = (d) => {
      const list = sortTasks(all.filter((t) => t.due === d));
      const late = d < k && list.some((t) => t.status !== 'done');
      return dropZone(el('div', { class: `spread-row${d === k ? ' today' : ''}${late ? ' late' : ''}`, role: 'group', 'aria-label': dayLong(d) },
        el('p', { class: 'date' }, el('span', { class: 'num' }, fmtDay(d, { day: 'numeric' })), ' ', el('span', { class: 'wd' }, fmtDay(d, { weekday: 'short' }).toUpperCase())),
        el('div', { class: 'entries' }, ...list.map(entry), addLine(`Add to ${fmtDay(d, { weekday: 'long' })}`, () => ({ due: d, ...projectFields() })))), (id) => editTask(id, { due: d }));
    };
    const weekend = state.planner.weekend
      ? [dayRow(days[5]), dayRow(days[6]), el('button', { class: 'link-btn fold', type: 'button', onclick: () => setWeekend(false) }, 'Fold the weekend away')]
      : [el('button', { class: 'weekend-fold', type: 'button', onclick: () => setWeekend(true), 'aria-label': `Show ${dayLong(days[5])} and ${dayLong(days[6])}` },
          el('span', { class: 'num' }, `${fmtDay(days[5], { day: 'numeric' })}, ${fmtDay(days[6], { day: 'numeric' })}`), el('span', {}, 'The weekend, folded away'),
          el('span', { class: 'count' }, countLine(all.filter((t) => t.due === days[5] || t.due === days[6]).length)))];
    const notesKey = days[0];
    const notesBox = el('textarea', { class: 'grid-paper', rows: '14', placeholder: 'Notes for the week: things to remember, ideas, what to chase…', 'aria-label': 'Notes for the week' });
    notesBox.value = state.planner.weekNotes?.[notesKey] || '';
    notesBox.addEventListener('input', () => update('weekNotes', (s) => { s.planner.weekNotes = { ...(s.planner.weekNotes || {}), [notesKey]: notesBox.value }; }));
    const undated = sortTasks(all.filter((t) => !t.due && t.status !== 'done')).slice(0, 6);
    return el('div', { class: 'spread' },
      el('section', { class: 'spread-left', 'aria-label': 'The week' }, weekNav(days), ...days.slice(0, 5).map(dayRow), ...weekend),
      el('section', { class: 'spread-right', 'aria-label': 'Notes for the week' },
        el('h3', {}, 'Notes for the week'), notesBox,
        undated.length ? el('div', { class: 'undated' }, el('p', { class: 'small-caps' }, 'No date yet'), ...undated.map((t) => el('p', { class: 'u-item' }, initial(t), t.title)), el('p', { class: 'hint' }, 'Open Columns to drag them onto a day.')) : null));
  }

  const countLine = (n) => (n === 1 ? '1 task' : `${n} tasks`);

  // Columns: a column per day; drag a task to another day. No date comes first,
  // today has the gold frame, and the weekend folds away until you need it.
  function columns() {
    const days = weekDays();
    const all = filtered();
    const k = dayKey();
    const col = (d) => {
      const list = sortTasks(all.filter((t) => t.due === d));
      const open = list.filter((t) => t.status !== 'done');
      const past = d < k;
      const foot = !list.length ? 'Free' : past && open.length ? `${open.length} still to do` : !open.length ? 'All done' : countLine(open.length);
      return dropZone(el('section', { class: `day-col${d === k ? ' today' : ''}${past ? ' past' : ''}`, 'aria-label': `${dayLong(d)}, ${countLine(list.length)}` },
        el('header', { class: past && open.length ? 'late' : '' }, el('span', { class: 'num' }, fmtDay(d, { day: 'numeric' })), el('span', { class: 'wd' }, fmtDay(d, { weekday: 'short' }).toUpperCase())),
        ...list.map(card),
        addLine(`Add to ${dayShort(d)}`, () => ({ due: d, ...projectFields() })),
        el('p', { class: `col-foot${past && open.length ? ' late' : ''}` }, foot)), (id) => editTask(id, { due: d }));
    };
    const undated = sortTasks(all.filter((t) => !t.due && t.status !== 'done'));
    const noDate = dropZone(el('section', { class: 'day-col nodate', 'aria-label': `No date yet, ${countLine(undated.length)}` },
      el('header', {}, el('span', { class: 'wd red' }, 'NO DATE YET'), el('span', { class: 'num small' }, String(undated.length))),
      ...undated.map(card),
      addLine('Add a task', () => projectFields()),
      el('p', { class: 'col-foot' }, undated.length ? 'Drag one onto a day to give it a date' : 'Nothing waiting')), (id) => editTask(id, { due: '' }));
    const weekendTasks = all.filter((t) => t.due === days[5] || t.due === days[6]);
    const weekend = state.planner.weekend
      ? [col(days[5]), col(days[6]), el('button', { class: 'weekend-strip open', type: 'button', onclick: () => setWeekend(false) }, el('span', { class: 'vertical' }, 'Fold the weekend'))]
      : [dropZone(el('button', { class: 'weekend-strip', type: 'button', onclick: () => setWeekend(true), 'aria-label': `Show the weekend, ${countLine(weekendTasks.length)}` },
          el('span', { class: 'num' }, fmtDay(days[5], { day: 'numeric' })), el('span', { class: 'num' }, fmtDay(days[6], { day: 'numeric' })),
          el('span', { class: 'vertical' }, 'The weekend, folded away'), el('span', { class: 'count' }, countLine(weekendTasks.length))),
        (id) => { editTask(id, { due: days[5] }); setWeekend(true); })];
    return el('div', { class: 'columns-page' },
      weekNav(days),
      el('p', { class: 'hint' }, 'Drag a task to another day. Drop it on No date yet to take its date away.'),
      el('div', { class: 'day-cols' }, noDate, ...days.slice(0, 5).map(col), ...weekend));
  }

  function boardFor(list, fields) {
    return el('div', { class: 'cols', style: { gridTemplateColumns: 'repeat(3, minmax(200px, 1fr))' } },
      ...Object.entries(STATUSES).map(([status, title]) => {
        const items = sortTasks(list.filter((t) => t.status === status));
        return dropZone(el('div', { class: 'col' },
          el('h3', {}, title, el('span', {}, items.length || '')),
          ...items.map(card),
          status === 'todo' ? addLine('Add a task', fields) : null), (id) => finishOrMove(id, status));
      }));
  }

  function finishOrMove(id, status) {
    if (status === 'done') finish(id, true);
    else {
      const titles = setStatus(id, status);
      if (titles.length) onFinished?.(titles);
    }
  }

  function board() {
    return boardFor(filtered(), projectFields);
  }

  function projectsView() {
    if (openProject && projectById(openProject)) return projectPage(projectById(openProject));
    openProject = null;
    const all = live();
    return el('div', { class: 'proj-grid' },
      ...projects().map((p) => {
        const mine = all.filter((t) => t.projectId === p.id);
        const open = mine.filter((t) => t.status !== 'done');
        const next = open.filter((t) => t.due).sort((a, b) => a.due.localeCompare(b.due))[0];
        return el('button', { class: 'proj-card', type: 'button', onclick: () => { openProject = p.id; render(); } },
          el('div', { class: 'n' }, el('span', { class: 'swatch', style: { background: p.color } }), p.name),
          el('div', { class: 's' }, `${open.length} open, ${mine.length - open.length} done`),
          el('div', { class: 's' }, next ? `Next: ${next.title}, ${dueLabel(next.due)}` : 'No deadlines'));
      }),
      el('button', { class: 'proj-card', type: 'button', onclick: () => { const p = addProject('New project'); openProject = p.id; render(); } },
        el('div', { class: 'n' }, '+ New project'), el('div', { class: 's' }, 'Rename it and pick a colour')));
  }

  function projectPage(p) {
    const mine = live().filter((t) => t.projectId === p.id);
    const deadlines = mine.filter((t) => t.due && t.status !== 'done').sort((a, b) => a.due.localeCompare(b.due)).slice(0, 8);
    const name = el('input', { type: 'text', value: p.name, maxlength: '30', 'aria-label': 'Project name', style: { fontSize: '20px', fontWeight: '600', maxWidth: '360px' } });
    name.addEventListener('change', () => update('categories', (s) => { const x = s.categories.find((c) => c.id === p.id); if (x) x.name = cleanText(name.value, 30) || 'Untitled'; }));
    const color = el('input', { type: 'color', value: p.color, 'aria-label': 'Project colour' });
    color.addEventListener('change', () => update('categories', (s) => { const x = s.categories.find((c) => c.id === p.id); if (x) x.color = color.value; }));
    const notes = el('textarea', { rows: '8', placeholder: 'Notes, links, ideas for this project…', 'aria-label': 'Project notes' });
    notes.value = p.notes || '';
    notes.addEventListener('input', () => update('projectNotes', (s) => { const x = s.categories.find((c) => c.id === p.id); if (x) x.notes = notes.value; }));
    return el('div', {},
      el('div', { class: 'nav-row' },
        el('button', { class: 'link-btn', type: 'button', onclick: () => { openProject = null; render(); } }, 'All projects'),
        color, name),
      el('div', { class: 'proj-page' },
        boardFor(mine, () => ({ projectId: p.id })),
        el('div', { class: 'proj-side' },
          el('div', { class: 'panel' }, el('h2', {}, 'Deadlines'),
            deadlines.length ? el('div', { class: 'list' }, ...deadlines.map((t) => row(t, { session: false }))) : el('p', { class: 'empty' }, 'No deadlines yet.')),
          el('div', { class: 'panel' }, el('h2', {}, 'Notes'), notes))));
  }

  function calendar() {
    const base = new Date();
    base.setDate(1);
    base.setMonth(base.getMonth() + monthOffset);
    const month = base.getMonth();
    const start = new Date(base);
    start.setDate(1 - ((base.getDay() + 6) % 7));
    const k = dayKey();
    const all = filtered();
    const cells = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const key = dayKey(d);
      const items = all.filter((t) => t.due === key || (t.remindAt && t.remindAt.slice(0, 10) === key && t.due !== key));
      cells.push(dropZone(el('div', { class: `day${d.getMonth() !== month ? ' other' : ''}${key === k ? ' today' : ''}` },
        el('b', {}, d.getDate()),
        ...items.slice(0, 4).map((t) => el('span', {
          class: 'item', style: { background: t.projectId ? projectColor(t.projectId) : undefined, textDecoration: t.status === 'done' ? 'line-through' : '' },
          onclick: () => edit(t.id), title: t.title,
        }, t.due === key ? t.title : `Reminder: ${t.title}`)),
        items.length > 4 ? el('span', { class: 'hint' }, `+${items.length - 4} more`) : null), (id) => editTask(id, { due: key })));
    }
    const dows = Array.from({ length: 7 }, (_, i) => new Date(2024, 0, 1 + i).toLocaleDateString(undefined, { weekday: 'short' }));
    return el('div', {},
      el('div', { class: 'nav-row' },
        el('button', { class: 'round', type: 'button', 'aria-label': 'Previous month', onclick: () => { monthOffset -= 1; render(); } }, '‹'),
        el('h3', {}, base.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })),
        el('button', { class: 'round', type: 'button', 'aria-label': 'Next month', onclick: () => { monthOffset += 1; render(); } }, '›'),
        monthOffset ? el('button', { class: 'link-btn', type: 'button', onclick: () => { monthOffset = 0; render(); } }, 'This month') : null),
      el('div', { class: 'cal' }, ...dows.map((d) => el('div', { class: 'dow' }, d)), ...cells));
  }

  function archive() {
    const q = archiveQuery.toLowerCase();
    const list = state.tasks
      .filter((t) => t.archived && (!q || t.title.toLowerCase().includes(q)))
      .filter((t) => state.planner.project === 'all' || t.projectId === state.planner.project)
      .sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0));
    const search = el('input', { type: 'text', value: archiveQuery, placeholder: 'Search finished tasks', 'aria-label': 'Search the archive', style: { maxWidth: '340px' } });
    search.addEventListener('input', () => {
      archiveQuery = search.value;
      render();
      requestAnimationFrame(() => { const s = body.querySelector('input'); s?.focus(); s?.setSelectionRange(s.value.length, s.value.length); });
    });
    return el('div', { class: 'list' },
      el('p', { class: 'hint', style: { marginTop: 0 } }, `Finished tasks move here ${state.planner.archiveAfter || 7} days after you tick them off.`),
      search,
      ...(list.length ? list.map((t) => el('div', { class: 'row-task is-done' },
        el('span', { class: 'title' }, t.title), chips(t),
        el('span', { class: 'hint', style: { margin: 0 } }, t.doneAt ? new Date(t.doneAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : ''),
        el('button', { class: 's-add', type: 'button', onclick: () => editTask(t.id, { archived: false }) }, 'Restore'))) : [el('p', { class: 'empty' }, q ? 'Nothing matches.' : 'Nothing archived yet.')]));
  }

  function progress() {
    const box = el('div', { class: 'panel', style: { maxWidth: '520px' } });
    renderStats(box);
    return box;
  }

  // Pour out your notes: write anything, then sort it into suggested tasks
  // (dates and projects picked up from the words); stray thoughts go to the pig.
  function notes() {
    const ta = el('textarea', { class: 'ruled notes-page', rows: '14', placeholder: 'Everything on your mind: tasks, dates, half-thoughts. Then sort it.', 'aria-label': 'Your notes' });
    ta.value = state.notes;
    ta.addEventListener('input', () => update('notes', (s) => { s.notes = ta.value; }));
    const sort = () => {
      suggestions = sortNotes(state.notes, projects());
      sortedBy = 'here';
      if (!suggestions.length) toast('Nothing to sort yet. Write a few lines first.', { timeout: 3000 });
      render();
    };
    // Sorting with AI: Apple Intelligence on this Mac (Mac app), or Claude (your key).
    const runSort = async (kind) => {
      if (!state.notes.trim()) return toast('Nothing to sort yet. Write a few lines first.', { timeout: 3000 });
      busy = kind;
      render();
      try {
        suggestions = kind === 'mac' ? await sortOnThisMac(state.notes, projects()) : await sortWithClaude(state.notes, projects());
        sortedBy = kind;
        if (!suggestions.length) toast('Nothing came out of these notes to sort.', { timeout: 3000 });
      } catch (err) {
        toast(err instanceof SortError ? err.message : 'Something went wrong sorting. Try again, or sort another way.', { timeout: 6000 });
      } finally {
        busy = '';
        render();
      }
    };
    const mac = macSort();
    const claude = hasKey();
    const buttons = [];
    if (mac.available) buttons.push(el('button', { class: 'btn btn-main', type: 'button', onclick: () => runSort('mac'), disabled: !!busy }, busy === 'mac' ? 'Sorting on this Mac…' : 'Sort on this Mac'));
    if (claude) buttons.push(el('button', { class: `btn ${buttons.length ? 'btn-soft' : 'btn-main'}`, type: 'button', onclick: () => runSort('claude'), disabled: !!busy }, busy === 'claude' ? 'Claude is reading…' : 'Sort with Claude'));
    buttons.push(el('button', { class: `btn ${buttons.length ? 'btn-quiet' : 'btn-main'}`, type: 'button', onclick: sort, disabled: !!busy }, buttons.length ? 'Sort with simple rules' : suggestions ? 'Sort them again' : 'Sort them into tasks'));
    const hints = [];
    if (mac.available) hints.push('Sorting on this Mac uses Apple Intelligence, and your notes stay on this computer.');
    else if (isMac && mac.reason) hints.push(mac.reason);
    if (claude) hints.push('Sorting with Claude sends these notes to Anthropic.');
    if (!mac.available && !claude) hints.push('Simple rules sort here, and nothing leaves this page. To sort with Claude, add your Anthropic API key in Settings.');
    const left = el('section', { class: 'spread-left', 'aria-label': 'Your notes' },
      el('p', { class: 'aside', style: { marginTop: 0 } }, 'Write anything here, in any order. When you’re ready, sort it: each line becomes a suggested task, with a date and project if your words give one.'),
      ta,
      el('div', { class: 'row' }, ...buttons),
      ...hints.map((h) => el('p', { class: 'hint' }, h)),
      !mac.available && !claude ? el('button', { class: 'link-btn', type: 'button', onclick: () => $('#settingsBtn').click() }, 'Open Settings') : null);

    const defaultProject = state.planner.project !== 'all' ? state.planner.project : '';
    const add = (x) => { addTask({ title: x.title, due: x.due, projectId: x.projectId || defaultProject }); x.done = 'added'; };
    const open = (suggestions || []).filter((x) => !x.done);
    const row = (x) => {
      const isTask = x.kind === 'task';
      const meta = [x.due ? dueLabel(x.due) : '', x.projectId ? projectName(x.projectId) : ''].filter(Boolean);
      return el('div', { class: `suggestion ${x.kind}` },
        isTask ? (x.projectId ? initial({ projectId: x.projectId }) : el('span', { class: 'p-initial blank-initial', 'aria-hidden': 'true' })) : el('span', { class: 'thought-mark', 'aria-hidden': 'true' }, '~'),
        el('div', { class: 'what' },
          el('p', { class: 'title' }, x.title),
          isTask ? (meta.length ? el('p', { class: 'meta-line' }, meta.join(', ')) : null) : el('p', { class: 'meta-line' }, 'A stray thought')),
        el('div', { class: 'acts' },
          isTask
            ? el('button', { class: 'btn btn-soft', type: 'button', onclick: () => { add(x); render(); } }, 'Add')
            : el('button', { class: 'btn btn-soft', type: 'button', onclick: () => { feed(x.title); x.done = 'pig'; render(); } }, 'Give it to the pig'),
          el('button', { class: 'link-btn', type: 'button', onclick: () => { x.done = 'skipped'; render(); } }, 'Skip')));
    };
    const tasksLeft = open.filter((x) => x.kind === 'task');
    const right = el('section', { class: 'spread-right', 'aria-label': 'Suggested tasks' },
      el('h3', {}, 'Suggested tasks'),
      suggestions ? el('p', { class: 'aside', style: { margin: '-4px 0 6px' } }, { mac: 'Sorted on this Mac by Apple Intelligence.', claude: 'Sorted by Claude.' }[sortedBy] || 'Sorted with simple rules, here in your browser.') : null,
      !suggestions
        ? el('p', { class: 'empty' }, 'Sort your notes and the suggestions appear here.')
        : open.length
          ? el('div', { class: 'suggestions' }, ...open.map(row),
              tasksLeft.length > 1 ? el('div', { class: 'row' }, el('button', { class: 'btn btn-main', type: 'button', onclick: () => { tasksLeft.forEach(add); toast(`Added ${tasksLeft.length} tasks to your planner.`, { timeout: 2500 }); render(); } }, `Add all ${tasksLeft.length} tasks`)) : null)
          : el('div', {},
              el('p', { class: 'empty' }, `All sorted: ${suggestions.filter((x) => x.done === 'added').length} added, ${suggestions.filter((x) => x.done === 'pig').length} given to the pig.`),
              el('button', { class: 'btn btn-soft', type: 'button', onclick: () => { update('notes', (s) => { s.notes = ''; }); suggestions = null; render(); } }, 'Clear the page')));
    return el('div', { class: 'spread notes-spread' }, left, right);
  }

  // ── Task editor ──
  function descendants(id) {
    const out = new Set();
    const walk = (pid) => live().filter((t) => t.parentId === pid).forEach((t) => { out.add(t.id); walk(t.id); });
    walk(id);
    return out;
  }

  function edit(id, { select = false } = {}) {
    editingId = id;
    fillEditor();
    if (!dlg.open) dlg.showModal();
    if (select) requestAnimationFrame(() => { const i = $('#taskForm .title-input'); i?.focus(); i?.select(); });
  }

  function fillEditor() {
    const t = taskById(editingId);
    const box = $('#taskForm');
    if (!t) { if (dlg.open) dlg.close(); return; }
    const set = (patch) => editTask(t.id, patch);
    const field = (label, control) => el('label', { class: 'field' }, el('span', {}, label), control);

    const title = el('input', { type: 'text', class: 'title-input', value: t.title, maxlength: '120', 'aria-label': 'Task title' });
    title.addEventListener('change', () => set({ title: cleanText(title.value, 120) || 'Untitled' }));

    const proj = el('select', {}, el('option', { value: '' }, 'No project'), ...projects().map((p) => el('option', { value: p.id, selected: p.id === t.projectId }, p.name)));
    proj.addEventListener('change', () => set({ projectId: proj.value }));

    const status = el('select', {}, ...Object.entries(STATUSES).map(([v, l]) => el('option', { value: v, selected: v === t.status }, l)));
    status.addEventListener('change', () => finishOrMove(t.id, status.value));

    const due = el('input', { type: 'date', value: t.due });
    due.addEventListener('change', () => set({ due: due.value }));
    const remind = el('input', { type: 'datetime-local', value: t.remindAt });
    remind.addEventListener('change', () => set({ remindAt: remind.value }));
    const repeat = el('select', {}, ...Object.entries(REPEATS).map(([v, l]) => el('option', { value: v, selected: v === t.repeat }, l)));
    repeat.addEventListener('change', () => set({ repeat: repeat.value }));

    const blocked = descendants(t.id);
    const parent = el('select', {}, el('option', { value: '' }, 'Nothing, it stands alone'),
      ...sortTasks(live().filter((x) => x.id !== t.id && !blocked.has(x.id) && x.status !== 'done')).map((x) => el('option', { value: x.id, selected: x.id === t.parentId }, x.title)));
    parent.addEventListener('change', () => set({ parentId: parent.value }));

    const tags = el('input', { type: 'text', value: t.tags.filter((x) => x !== FOLLOW).join(', '), placeholder: 'waiting, email, errands' });
    tags.addEventListener('change', () => {
      const list = tags.value.split(',').map((x) => cleanText(x, 24).replace(/^#/, '').toLowerCase()).filter(Boolean);
      set({ tags: [...new Set([...list, ...(t.tags.includes(FOLLOW) ? [FOLLOW] : [])])] });
    });
    const follow = el('input', { type: 'checkbox', checked: t.tags.includes(FOLLOW) });
    const followOn = el('input', { type: 'date', value: t.followUpOn, style: { width: 'auto' }, 'aria-label': 'Follow up on' });
    follow.addEventListener('change', () => set({ tags: follow.checked ? [...new Set([...t.tags, FOLLOW])] : t.tags.filter((x) => x !== FOLLOW) }));
    followOn.addEventListener('change', () => set({ followUpOn: followOn.value }));

    const notes = el('textarea', { rows: '3', placeholder: 'Details, links…' });
    notes.value = t.notes || '';
    notes.addEventListener('change', () => set({ notes: notes.value }));

    const kids = el('div', { class: 'kids' },
      ...sortTasks(childrenOf(t.id)).map((k) => el('div', { class: 'kid' },
        el('input', { type: 'checkbox', class: 'check', checked: k.status === 'done', 'aria-label': `Done: ${k.title}`, onchange: (e) => finish(k.id, e.target.checked) }),
        el('span', { style: { flex: '1', textDecoration: k.status === 'done' ? 'line-through' : '' } }, k.title),
        el('button', { class: 'link-btn', type: 'button', onclick: () => edit(k.id) }, 'Open'))));
    const addKid = el('input', { type: 'text', maxlength: '120', placeholder: 'Add a step', 'aria-label': 'Add a step' });
    const kidForm = el('form', { class: 'add-line', autocomplete: 'off' }, addKid);
    kidForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = cleanText(addKid.value, 120);
      if (!name) return;
      addTask({ title: name, parentId: t.id, projectId: t.projectId, due: '' });
      requestAnimationFrame(() => $('#taskForm input[placeholder="Add a step"]')?.focus());
    });

    const inSession = state.session.taskIds.includes(t.id);
    box.replaceChildren(
      field('Task', title),
      el('div', { class: 'grid-2' }, field('Project', proj), field('Status', status)),
      el('div', { class: 'grid-2' }, field('Due', due), field('Remind me at', remind)),
      el('p', { class: 'hint' }, 'Reminders wait until your break if you’re focusing.'),
      el('div', { class: 'grid-2' }, field('Repeats', repeat), field('Part of', parent)),
      field('Tags', tags),
      el('label', { class: 'switch' }, follow, el('span', { class: 'track', 'aria-hidden': 'true' }), el('span', {}, 'Needs a follow-up when done'), followOn),
      field('Notes', notes),
      el('div', { class: 'field' }, el('span', {}, 'Steps'), kids, kidForm),
      el('div', { class: 'actions' },
        el('div', { class: 'row', style: { marginTop: 0 } },
          el('button', { class: 'btn btn-soft', type: 'button', onclick: () => { inSession ? removeFromSession(t.id) : addToSession(t.id); } }, inSession ? 'Remove from session' : 'Add to this session'),
          el('button', {
            class: 'btn btn-quiet', type: 'button',
            onclick: () => {
              const removed = removeTask(t.id);
              dlg.close();
              toast(removed.length > 1 ? `Deleted ${removed.length} tasks` : 'Task deleted', { action: 'Undo', onAction: () => restoreTasks(removed) });
            },
          }, 'Delete')),
        el('button', { class: 'btn btn-main', type: 'button', onclick: () => dlg.close() }, 'Done')),
    );
  }

  on('tasks', () => { render(); if (dlg.open) fillEditor(); });
  on('categories', () => { render(); if (dlg.open) fillEditor(); });
  on('planner', render);
  on('profile', render);
  on('stats', () => { if (tab() === 'progress') render(); });
  on('all', render);

  return { open, close, edit, render, get isOpen() { return !root.hidden; } };
}

function removeFromSession(id) {
  update('tasks', (s) => { s.session.taskIds = s.session.taskIds.filter((x) => x !== id); });
}
