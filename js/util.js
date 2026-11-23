// Small DOM + formatting helpers shared across modules.

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/**
 * el('button', { class: 'btn', onclick }, 'Label') — tiny element builder.
 * Strings become text nodes (never HTML), so peer-supplied text is safe.
 */
export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else if (k === 'class') node.className = v;
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
    else if (v === true) node.setAttribute(k, '');
    else node.setAttribute(k, v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return node;
}

/**
 * Write a line into node letter by letter, as if a scribe were inking it
 * (css .inscribe). Words never break across lines; screen readers get the
 * whole line at once. Writing the same line again does nothing.
 *
 * When the line is written it settles into plain text, so it is always sharp
 * and fully there, even if the browser paused the animation (WebKit does,
 * for a window in the background or covered by another).
 */
const STEP = 38;      // ms between letters
const LETTER = 420;   // ms for one letter to ink in
const settling = new WeakMap(); // node -> timer that turns it into plain text
export function inscribe(node, text) {
  if (!node || node.dataset.inscribed === text) return;
  node.dataset.inscribed = text;
  let i = 0;
  const letters = text.split(/(\s+)/).map((part) => (/^\s*$/.test(part)
    ? part
    : el('span', { class: 'word' }, ...[...part].map((c) => el('span', { class: 'ch', style: { animationDelay: `${Math.min(i++ * STEP, 2400)}ms` } }, c)))));
  const shown = el('span', { 'aria-hidden': 'true' }, ...letters);
  node.classList.add('inscribe');
  node.replaceChildren(el('span', { class: 'sr-only' }, text), shown);
  clearTimeout(settling.get(node));
  settling.set(node, setTimeout(() => {
    if (node.dataset.inscribed === text) shown.textContent = text;
  }, Math.min(Math.max(i - 1, 0) * STEP, 2400) + LETTER + 80));
}

export const pad = (n) => String(n).padStart(2, '0');

export function fmtClock(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${pad(m)}:${pad(s)}`;
}

export function fmtMinutes(min) {
  const m = Math.round(min);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h} h ${r} min` : `${h} h`;
}

export const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

export function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

export const uid = () => Math.random().toString(36).slice(2, 10);

export function dayKey(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function daysBetween(a, b) {
  const da = new Date(`${a}T00:00:00`);
  const db = new Date(`${b}T00:00:00`);
  return Math.round((db - da) / 86400000);
}

export function cleanText(v, max = 80) {
  return String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
}

export function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

const ICONS = {
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  star: '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z"/>',
  heart: '<path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z"/>',
  paw: '<ellipse cx="12" cy="15.5" rx="4.6" ry="3.8"/><ellipse cx="6.2" cy="10.4" rx="1.8" ry="2.3"/><ellipse cx="9.6" cy="6.9" rx="1.8" ry="2.4"/><ellipse cx="14.4" cy="6.9" rx="1.8" ry="2.4"/><ellipse cx="17.8" cy="10.4" rx="1.8" ry="2.3"/>',
};

/** Small line icon as an <svg> element (sized by CSS, coloured by currentColor). */
export function icon(name, { filled = false } = {}) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', `ic ic-${name}${filled ? ' filled' : ''}`);
  svg.innerHTML = ICONS[name] || '';
  return svg;
}
