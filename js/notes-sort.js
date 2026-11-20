// "Pour out your notes": sort a messy page into suggested tasks, here in the
// browser (no AI, nothing leaves the page). Each line or sentence becomes a
// suggestion: a task if it reads like one (starts with a doing word, says
// "need to", or names a day), otherwise a stray thought you can give to the pig.
// Dates ("friday", "tomorrow", "the 27th", "27 nov", "next week") and project
// names in the words are picked up and taken out of the title.
//
//   sortNotes(text, projects, today = new Date())
//     -> [{ id, kind: 'task' | 'thought', title, due, projectId, source }]

import { dayKey, uid } from './util.js';

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const SHORT_DAYS = { sun: 0, mon: 1, tue: 2, tues: 2, wed: 3, thu: 4, thur: 4, thurs: 4, fri: 5, sat: 6 };
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const VERBS = new Set(('email write draft send book pay buy read finish fix plan ask check review submit edit outline chase ' +
  'call ring phone text message reply schedule print renew clean tidy update prepare make sort order cancel meet ' +
  'post return collect pick get start file sign apply research find look learn practise practice revise test ship ' +
  'water feed walk wash cook bake visit see tell remind thank invite confirm arrange organise organize move rewrite ' +
  'proofread cite transcribe code build design').split(' '));
const PREP = '(?:by|on|before|for|due|until|till|this|next|come)?';

const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const ord = (n) => +String(n).replace(/(st|nd|rd|th)$/, '');

/** Find a date in the text: { due, at, length } or null. */
export function findDate(text, today) {
  const t = text.toLowerCase();
  const rules = [
    [new RegExp(`\\b${PREP}\\s*(today|tonight)\\b`), () => today],
    [new RegExp(`\\b${PREP}\\s*tomorrow\\b`), () => addDays(today, 1)],
    [new RegExp(`\\b(?:by|on|before|for|due)?\\s*the\\s*weekend\\b|\\bthis weekend\\b`), () => addDays(today, (6 - today.getDay() + 7) % 7 || 7)],
    [/\bnext week\b/, () => addDays(today, ((8 - today.getDay()) % 7) || 7)],
    [/\bin (\d{1,2}|a|two|three) (day|days|week|weeks)\b/, (m) => {
      const n = { a: 1, two: 2, three: 3 }[m[1]] || +m[1];
      return addDays(today, m[2].startsWith('week') ? n * 7 : n);
    }],
    [new RegExp(`\\b(?:by|on|before|for|due|until)?\\s*(next\\s+)?(${DAYS.join('|')}|${Object.keys(SHORT_DAYS).join('|')})\\b\\.?`), (m) => {
      const want = DAYS.includes(m[2]) ? DAYS.indexOf(m[2]) : SHORT_DAYS[m[2]];
      let ahead = (want - today.getDay() + 7) % 7 || 7;
      if (m[1]) ahead += ahead < 7 ? 7 : 0;
      return addDays(today, ahead);
    }],
    [new RegExp(`\\b(?:by|on|before|for|due)?\\s*(\\d{1,2})(?:st|nd|rd|th)?\\s+(${MONTHS.join('|')})[a-z]*\\b`), (m) => onDate(today, +m[1], MONTHS.indexOf(m[2]))],
    [new RegExp(`\\b(?:by|on|before|for|due)?\\s*(${MONTHS.join('|')})[a-z]*\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b`), (m) => onDate(today, +m[2], MONTHS.indexOf(m[1]))],
    [/\b(?:by|on|before|for|due)?\s*the\s+(\d{1,2}(?:st|nd|rd|th))\b/, (m) => onDay(today, ord(m[1]))],
    [/\b(?:by|on|before|due)\s+(\d{1,2}(?:st|nd|rd|th))\b/, (m) => onDay(today, ord(m[1]))],
  ];
  for (const [re, when] of rules) {
    const m = t.match(re);
    if (!m) continue;
    const d = when(m);
    if (!d || Number.isNaN(d.getTime())) continue;
    return { due: dayKey(d), at: m.index, length: m[0].length };
  }
  return null;
}

function onDay(today, day) {
  if (day < 1 || day > 31) return null;
  const d = new Date(today.getFullYear(), today.getMonth(), day);
  return d < new Date(today.getFullYear(), today.getMonth(), today.getDate()) ? new Date(today.getFullYear(), today.getMonth() + 1, day) : d;
}

function onDate(today, day, month) {
  if (day < 1 || day > 31 || month < 0) return null;
  const d = new Date(today.getFullYear(), month, day);
  return d < new Date(today.getFullYear(), today.getMonth(), today.getDate()) ? new Date(today.getFullYear() + 1, month, day) : d;
}

export function findProject(text, projects) {
  const t = text.toLowerCase();
  for (const p of projects) {
    const name = p.name.toLowerCase();
    const words = name.split(/\s+/).filter((w) => w.length > 3);
    if (t.includes(`#${name.replace(/\s+/g, '')}`) || t.includes(name) || words.some((w) => new RegExp(`\\b${w}\\b`).test(t))) return p.id;
  }
  return '';
}

const tidy = (s) => {
  let out = s
    .replace(/^\s*(?:[-*•–]+|\d+[.)]|\[\s?\]|todo:?|to do:?)\s*/i, '')
    .replace(/^(?:i\s+)?(?:need to|have to|must|should|gotta|got to|remember to|don'?t forget to)\s+/i, '')
    .replace(/\s+/g, ' ')
    .replace(/[\s,;:.!?-]+$/, '')
    .trim();
  return out ? out[0].toUpperCase() + out.slice(1) : '';
};

/** The first word after a "Label:" prefix, if there is one. */
const afterLabel = (s) => (s.match(/^[^:]{1,30}:\s*(\w+)/)?.[1] || '').toLowerCase();

/** Split the page into pieces: lines, then sentences. */
function pieces(text) {
  return text
    .split(/\n+/)
    .flatMap((line) => line.split(/(?<=[.;!?])\s+|\s+(?:—|–)\s+/))
    .map((p) => p.trim())
    .filter((p) => p.replace(/[^a-z0-9]/gi, '').length > 1);
}

export function sortNotes(text, projects = [], today = new Date()) {
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return pieces(text).map((source) => {
    const date = findDate(source, base);
    const plain = date ? `${source.slice(0, date.at)} ${source.slice(date.at + date.length)}` : source;
    const first = tidy(plain).split(/\s+/)[0]?.toLowerCase() || '';
    const wantsTo = /\b(need to|have to|must|todo|to do|remember to|don'?t forget)\b/i.test(source);
    const wondering = /^\s*(maybe|perhaps|idea|what if|i wonder|thought)\b/i.test(source) || (/\?\s*$/.test(source) && !date);
    const isTask = !wondering && (VERBS.has(first) || VERBS.has(afterLabel(plain)) || wantsTo || !!date);
    const projectId = isTask ? findProject(source, projects) : '';
    // "Thesis: rewrite the methods" files it under Thesis; the label leaves the title.
    const label = projects.find((p) => p.id === projectId)?.name;
    let title = tidy(isTask ? plain : source) || tidy(source);
    if (label) title = tidy(title.replace(new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\s*[:\-–]\s*`, 'i'), ''));
    return {
      id: uid(),
      kind: isTask ? 'task' : 'thought',
      title,
      due: isTask ? date?.due || '' : '',
      projectId,
      source,
    };
  });
}
