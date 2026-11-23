import { el, inscribe } from '../util.js';

/** Small, self-dismissing message at the bottom of the screen. */
export function toast(text, { action, onAction, timeout = 4500 } = {}) {
  const box = document.getElementById('toasts');
  if (!box) return () => {};
  const line = el('span');
  inscribe(line, text);
  const t = el('div', { class: 'toast', role: 'status' }, line);
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    t.classList.add('out');
    setTimeout(() => t.remove(), 260);
  };
  if (action) {
    t.append(el('button', { type: 'button', onclick: () => { onAction?.(); close(); } }, action));
  }
  box.append(t);
  while (box.children.length > 3) box.firstElementChild.remove();
  setTimeout(close, timeout);
  return close;
}
