// Talking to the Mac app (mac/), when the page runs inside it. Everywhere else
// these do nothing.
//
//   isMac               true inside the Mac app
//   send(msg)           message the Mac app (see mac/Sources/OldPossum/AppDelegate.swift)
//   onCommand(name, fn) the menu bar or scene window asks for 'toggle' / 'skip' /
//                       'completeTask' (with the task's id)

const handler = window.webkit?.messageHandlers?.possum;
export const isMac = !!(handler && window.possumMac);

export function send(msg) {
  if (!isMac) return;
  try {
    handler.postMessage(msg);
  } catch {
    /* the Mac side went away (quitting) */
  }
}

const commands = {};
export function onCommand(name, fn) {
  commands[name] = fn;
}

// Sorting notes on this Mac with Apple Intelligence (mac/Sources/OldPossum/OnDeviceSorter.swift).
// The Mac app says at launch whether it can, and why not if it can't.
export const onDeviceAI = () => (isMac && window.possumMac?.onDeviceAI) || { available: false, reason: '' };
const waiting = new Map();
let nextId = 0;

/** Ask the Mac to sort notes; resolves with its JSON text, rejects with a message for people. */
export function sortOnMac(notes, projects, today) {
  return new Promise((resolve, reject) => {
    const id = ++nextId;
    const timer = setTimeout(() => {
      waiting.delete(id);
      reject(new Error('Sorting on this Mac took too long. Try again.'));
    }, 120000);
    waiting.set(id, { resolve, reject, timer });
    send({ type: 'sortNotes', id, notes, projects, today });
  });
}

window.possumNative = {
  command: (name, arg) => commands[name]?.(arg),
  sorted(id, ok, payload) {
    const job = waiting.get(id);
    if (!job) return;
    waiting.delete(id);
    clearTimeout(job.timer);
    if (ok) job.resolve(payload);
    else job.reject(new Error(payload));
  },
};

// Only send timer state when something you'd see has changed. While the timer
// runs, the Mac app counts down from endsAt by itself.
let last = '';
export function shareState(s) {
  if (!isMac) return;
  const key = JSON.stringify({ ...s, remaining: s.running ? 0 : Math.round(s.remaining / 1000), endsAt: Math.round(s.endsAt / 1000) });
  if (key === last) return;
  last = key;
  send({ type: 'state', ...s });
}
