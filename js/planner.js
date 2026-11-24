// The planner: projects, tasks (with parent/child links and tags), due dates,
// reminders, repeats, follow-ups, archiving, and the session checklist.
// Pure-ish data helpers; views live in js/ui/planner-view.js.

import { state, update, emit, PROJECT_COLORS } from './store.js';
import { uid, dayKey } from './util.js';

export const STATUSES = { todo: 'To do', doing: 'Doing', done: 'Done' };
export const FOLLOW = 'follow-up';
export const REPEATS = { '': 'Does not repeat', daily: 'Every day', weekly: 'Every week', monthly: 'Every month' };

// ── Lookups ─────────────────────────────────────────────────────────────────
export const projects = () => state.categories;
export const projectById = (id) => state.categories.find((c) => c.id === id) || null;
export const projectName = (id) => projectById(id)?.name || 'No project';
export const projectColor = (id) => projectById(id)?.color || '#efe6d8';
export const taskById = (id) => state.tasks.find((t) => t.id === id) || null;
export const live = () => state.tasks.filter((t) => !t.archived);
export const childrenOf = (id) => live().filter((t) => t.parentId === id);
export const sortTasks = (list) => [...list].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

export function filtered(projectId = state.planner.project) {
  const all = live();
  return projectId && projectId !== 'all' ? all.filter((t) => t.projectId === projectId) : all;
}

// ── Dates ───────────────────────────────────────────────────────────────────
export function addDays(key, n) {
  const d = new Date(`${key}T12:00:00`);
  d.setDate(d.getDate() + n);
  return dayKey(d);
}
function addMonths(key, n) {
  const d = new Date(`${key}T12:00:00`);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return dayKey(d);
}
export function nextDue(key, repeat) {
  if (repeat === 'daily') return addDays(key, 1);
  if (repeat === 'weekly') return addDays(key, 7);
  if (repeat === 'monthly') return addMonths(key, 1);
  return key;
}
/** 'soon' (today/tomorrow), 'late' (overdue), or '' */
export function dueState(t) {
  if (!t.due || t.status === 'done') return '';
  const today = dayKey();
  if (t.due < today) return 'late';
  if (t.due === today || t.due === addDays(today, 1)) return 'soon';
  return '';
}
export function dueLabel(key) {
  if (!key) return '';
  const today = dayKey();
  if (key === today) return 'Today';
  if (key === addDays(today, 1)) return 'Tomorrow';
  if (key === addDays(today, -1)) return 'Yesterday';
  const d = new Date(`${key}T12:00:00`);
  const days = Math.round((d - new Date(`${today}T12:00:00`)) / 86400000);
  if (days > 1 && days < 7) return d.toLocaleDateString(undefined, { weekday: 'long' });
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

// ── Creating and editing ────────────────────────────────────────────────────
export function blankTask(fields = {}) {
  return {
    id: uid(),
    title: '',
    notes: '',
    projectId: state.category || '',
    parentId: '',
    status: 'todo',
    due: '',
    remindAt: '',
    repeat: '',
    tags: [],
    followUpOn: '',
    createdAt: Date.now(),
    doneAt: 0,
    archived: false,
    reminded: false,
    order: Date.now(),
    ...fields,
  };
}

export function addTask(fields = {}) {
  const t = blankTask(fields);
  update('tasks', (s) => { s.tasks.push(t); });
  return t;
}

export function editTask(id, patch) {
  update('tasks', (s) => {
    const t = s.tasks.find((x) => x.id === id);
    if (!t) return;
    Object.assign(t, patch);
    if ('remindAt' in patch) t.reminded = false;
    if ('parentId' in patch && wouldLoop(s.tasks, id, patch.parentId)) t.parentId = '';
  });
}

function wouldLoop(tasks, id, parentId) {
  let p = parentId;
  for (let i = 0; p && i < 100; i++) {
    if (p === id) return true;
    p = tasks.find((x) => x.id === p)?.parentId;
  }
  return false;
}

/** Delete a task and its children. Returns what was removed (for undo). */
export function removeTask(id) {
  const doomed = new Set([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const t of state.tasks) if (t.parentId && doomed.has(t.parentId) && !doomed.has(t.id)) { doomed.add(t.id); grew = true; }
  }
  const removed = state.tasks.filter((t) => doomed.has(t.id)).map((t) => structuredClone(t));
  update('tasks', (s) => {
    s.tasks = s.tasks.filter((t) => !doomed.has(t.id));
    s.session.taskIds = s.session.taskIds.filter((x) => !doomed.has(x));
  });
  return removed;
}

export function restoreTasks(list) {
  update('tasks', (s) => {
    for (const t of list) if (!s.tasks.some((x) => x.id === t.id)) s.tasks.push(t);
  });
}

/**
 * Change status, running the automations:
 *  - a repeating task books its next occurrence
 *  - a "follow-up" task books a follow-up on its date (or in 3 days)
 *  - when every child of a parent is done, the parent is done too
 * Returns the titles that were completed (for telling buddies).
 */
export function setStatus(id, status) {
  const finished = [];
  update('tasks', (s) => {
    const t = s.tasks.find((x) => x.id === id);
    if (!t || t.status === status) return;
    const was = t.status;
    t.status = status;
    if (status === 'done') complete(s, t, finished);
    else if (was === 'done') t.doneAt = 0;
  });
  return finished;
}

function complete(s, t, finished) {
  t.doneAt = Date.now();
  finished.push(t.title);
  if (t.repeat) {
    const due = nextDue(t.due || dayKey(), t.repeat);
    s.tasks.push(blankTask({
      title: t.title, notes: t.notes, projectId: t.projectId, parentId: t.parentId, repeat: t.repeat,
      tags: t.tags.filter((x) => x !== FOLLOW), due,
      remindAt: t.remindAt ? `${due}T${t.remindAt.slice(11, 16)}` : '',
    }));
  }
  if (t.tags.includes(FOLLOW)) {
    s.tasks.push(blankTask({
      title: `Follow up: ${t.title}`, projectId: t.projectId, parentId: t.parentId,
      due: t.followUpOn || addDays(dayKey(), 3),
    }));
  }
  if (t.parentId) {
    const p = s.tasks.find((x) => x.id === t.parentId);
    const kids = s.tasks.filter((x) => x.parentId === t.parentId && !x.archived);
    if (p && p.status !== 'done' && kids.length && kids.every((k) => k.status === 'done')) {
      p.status = 'done';
      complete(s, p, finished);
    }
  }
}

/** Finished tasks tidy themselves into the archive after a few days. */
export function archiveOld() {
  const cutoff = Date.now() - (state.planner.archiveAfter || 7) * 86400000;
  if (!state.tasks.some((t) => t.status === 'done' && !t.archived && t.doneAt && t.doneAt < cutoff)) return;
  let n = 0;
  update('tasks', (s) => {
    for (const t of s.tasks) if (t.status === 'done' && !t.archived && t.doneAt && t.doneAt < cutoff) { t.archived = true; n += 1; }
  });
  emit('archived', n); // the hungry pig eats them (js/ui/pig-view.js)
}

/** Reminders that are due now (and not yet shown). */
export function dueReminders(now = new Date()) {
  const stamp = `${dayKey(now)}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  return live().filter((t) => t.remindAt && !t.reminded && t.status !== 'done' && t.remindAt <= stamp);
}
export function markReminded(ids) {
  update('tasks', (s) => { for (const t of s.tasks) if (ids.includes(t.id)) t.reminded = true; });
}

// ── The session checklist ───────────────────────────────────────────────────
export const sessionTasks = () => state.session.taskIds.map(taskById).filter(Boolean);
/** What you're on: the first unfinished task in this session's order; then the one after it. */
export const currentSessionTask = () => sessionTasks().find((t) => t.status !== 'done') || null;
export const nextSessionTask = () => sessionTasks().filter((t) => t.status !== 'done')[1] || null;

/** Put this session's tasks in a new order (ids you leave out keep their place at the end). */
export function reorderSession(ids) {
  update('tasks', (s) => {
    const have = new Set(s.session.taskIds);
    const first = ids.filter((id) => have.has(id));
    s.session.taskIds = [...first, ...s.session.taskIds.filter((id) => !first.includes(id))];
  });
}
/** Move one task up (-1) or down (+1) in this session. */
export function moveInSession(id, by) {
  const ids = [...state.session.taskIds];
  const from = ids.indexOf(id);
  const to = from + by;
  if (from < 0 || to < 0 || to >= ids.length) return;
  ids.splice(to, 0, ids.splice(from, 1)[0]);
  reorderSession(ids);
}

export function addToSession(id) {
  update('tasks', (s) => { if (!s.session.taskIds.includes(id)) s.session.taskIds.push(id); });
}
export function removeFromSession(id) {
  update('tasks', (s) => { s.session.taskIds = s.session.taskIds.filter((x) => x !== id); });
}
export function clearDoneFromSession() {
  update('tasks', (s) => {
    s.session.taskIds = s.session.taskIds.filter((x) => s.tasks.find((t) => t.id === x)?.status !== 'done');
  });
}
/** Automation: picking tasks for a focus session moves them to "doing". */
export function startSession() {
  update('tasks', (s) => {
    for (const id of s.session.taskIds) {
      const t = s.tasks.find((x) => x.id === id);
      if (t && t.status === 'todo') t.status = 'doing';
    }
  });
}

// ── Projects ────────────────────────────────────────────────────────────────
export function addProject(name) {
  const used = new Set(state.categories.map((c) => c.color));
  const color = PROJECT_COLORS.find((c) => !used.has(c)) || PROJECT_COLORS[state.categories.length % PROJECT_COLORS.length];
  const p = { id: uid(), name: name || 'New project', color, prop: 'laptop', note: '', notes: '' };
  update('categories', (s) => { s.categories.push(p); });
  return p;
}
