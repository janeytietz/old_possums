// "Pour out your notes", sorted by Apple Intelligence on this Mac (only inside
// the Mac app, on macOS 26 with Apple Intelligence on). The notes stay on the Mac.

import { sortOnMac, onDeviceAI } from './native.js';
import { SortError } from './claude-sort.js';
import { findDate, findProject } from './notes-sort.js';
import { uid } from './util.js';

export const macSort = () => onDeviceAI();

export async function sortOnThisMac(notes, projects, today = new Date()) {
  const label = `${today.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} (${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')})`;
  let text;
  try {
    text = await sortOnMac(notes, projects.map((p) => p.name), label);
  } catch (err) {
    throw new SortError(err.message);
  }
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new SortError('The answer from this Mac came back garbled. Try again.');
  }
  // Apple's model splits the notes and writes the titles; dates and projects
  // come from the item's own words, with the page's rules (more reliable).
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return (Array.isArray(data.items) ? data.items : [])
    .filter((x) => x && typeof x.title === 'string' && x.title.trim())
    .map((x) => {
      const isTask = x.kind === 'task';
      const words = `${x.source || ''} ${x.title}`;
      return {
        id: uid(),
        kind: isTask ? 'task' : 'thought',
        title: x.title.trim().slice(0, 200),
        due: isTask ? findDate(words, base)?.due || '' : '',
        projectId: isTask ? findProject(words, projects) : '',
        source: x.source || '',
      };
    });
}
