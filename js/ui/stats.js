// Stats tab: today, streak, level, the last 7 days, and time by category.

import { state, todayStats, liveStreak, xpForNext } from '../store.js';
import { el, dayKey, fmtMinutes } from '../util.js';

export function renderStats(root) {
  const t = todayStats();
  const need = xpForNext(state.stats.level);
  const pct = Math.min(100, (state.stats.xp / need) * 100);

  const kpi = (v, k, extra) => el('div', { class: 'kpi' }, el('div', { class: 'v' }, v), el('div', { class: 'k' }, k), extra);

  const kpis = el(
    'div',
    { class: 'kpis' },
    kpi(fmtMinutes(t.min), 'focused today'),
    kpi(String(t.sessions), t.sessions === 1 ? 'session today' : 'sessions today'),
    kpi(`${liveStreak()}`, liveStreak() === 1 ? 'day streak' : 'day streak'),
    kpi(
      `Level ${state.stats.level}`,
      `${Math.floor(state.stats.xp)} / ${need} min to next`,
      el('div', { class: 'level-bar' }, el('i', { style: { width: `${pct}%` } })),
    ),
  );

  // Last 7 days
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const k = dayKey(d);
    days.push({ k, label: d.toLocaleDateString(undefined, { weekday: 'narrow' }), min: state.stats.days[k]?.min || 0, today: i === 0 });
  }
  const max = Math.max(30, ...days.map((d) => d.min));
  const week = el(
    'div',
    { class: 'week', role: 'img', 'aria-label': `Focus minutes, last 7 days: ${days.map((d) => Math.round(d.min)).join(', ')}` },
    days.map((d) =>
      el(
        'div',
        { class: `bar${d.today ? ' today' : ''}`, title: `${d.k}: ${fmtMinutes(d.min)}` },
        el('div', { class: 'col', style: { height: `${(d.min / max) * 100}%` } }, d.min >= 1 ? el('span', {}, Math.round(d.min)) : null),
        el('div', {}, d.label),
      ),
    ),
  );

  // By category (all time)
  const names = Object.fromEntries(state.categories.map((c) => [c.id, c.name]));
  const rows = Object.entries(state.stats.byCat)
    .filter(([, m]) => m >= 0.5)
    .sort((a, b) => b[1] - a[1]);
  const top = rows[0]?.[1] || 1;
  const cats = rows.length
    ? el(
        'div',
        { class: 'cats' },
        rows.map(([id, m]) =>
          el(
            'div',
            { class: 'cat-row' },
            el('span', {}, names[id] || id.replace(/_/g, ' ')),
            el('span', { class: 'm' }, fmtMinutes(m)),
            el('div', { class: 'track' }, el('i', { style: { width: `${(m / top) * 100}%` } })),
          ),
        ),
      )
    : el('p', { class: 'empty' }, 'Finish a focus session and your time shows up here.');

  root.replaceChildren(
    kpis,
    el('h3', { class: 'stats-h' }, 'Last 7 days'),
    week,
    el('h3', { class: 'stats-h' }, 'All time'),
    el('p', { class: 'hint', style: { marginTop: '-4px', marginBottom: '10px' } }, `${fmtMinutes(state.stats.totalMin)} focused over ${state.stats.sessions} sessions`),
    cats,
  );
}
