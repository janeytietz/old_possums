// Settings dialog. Every field saves as you change it — no Save button.

import { state, update, exportData, importData, resetAll, DEFAULT_MESSAGES, PROJECT_COLORS } from '../store.js';
import { COAT_LIST, BEAST_LIST, BACKDROP_LIST } from '../coats.js';
import { $, el, clamp, cleanText, uid, dayKey, icon } from '../util.js';
import { play } from '../sound.js';
import { getKey, setKey } from '../claude-sort.js';
import { isMac, send as sendMac } from '../native.js';
import { toast } from './toast.js';

export function initSettings({ timer, buddyPreview }) {
  const dlg = $('#settingsDialog');

  $('#settingsBtn').addEventListener('click', () => {
    fill();
    dlg.showModal();
  });

  function fill() {
    $('#setName').value = state.profile.name;
    renderBeasts();
    renderCoats();
    renderBackdrops();
    renderClaudeKey();
    $('#setFocus').value = state.timer.focus;
    $('#setShort').value = state.timer.short;
    $('#setLong').value = state.timer.long;
    $('#setEvery').value = state.timer.longEvery;
    $('#setAutoBreak').checked = state.timer.autoBreak;
    $('#setAutoFocus').checked = state.timer.autoFocus;
    $('#followNote').hidden = !timer.override;
    renderCategories();
    $('#setArchive').value = state.planner.archiveAfter || 7;
    $('#setCountOn').checked = state.countdown.on;
    $('#setCountLabel').value = state.countdown.label;
    $('#setCountDate').value = state.countdown.date;
    $('#setTalks').checked = state.catTalks;
    $('#setMessages').value = state.messages.join('\n');
    $('#setSound').checked = state.sound.on;
    $('#setVolume').value = state.sound.volume;
    $('#setNotify').checked = isMac ? state.notify : state.notify && 'Notification' in window && Notification.permission === 'granted';
    $('#setTheme').value = state.theme;
    $('#setTime').value = state.scene.time;
  }

  // ── Your buddy ──
  $('#setName').addEventListener('input', (e) => update('profile', (s) => { s.profile.name = cleanText(e.target.value, 24); }));

  // Beasts you haven't earned yet show as locked: they come from bestiary cards.
  function renderBeasts() {
    const box = $('#beastPicker');
    box.replaceChildren(
      ...BEAST_LIST.map((b) => {
        const mine = state.unlocks.beasts.includes(b.id);
        return el(
          'button',
          {
            class: 'coat', type: 'button', role: 'radio',
            'aria-checked': String(state.profile.beast === b.id),
            'aria-disabled': String(!mine),
            onclick: () => {
              if (!mine) return toast(`The ${b.name} comes from a bestiary card. Keep finishing sessions to turn one over.`, { timeout: 4500 });
              update('profile', (s) => { s.profile.beast = b.id; });
              renderBeasts();
              renderCoats();
            },
          },
          el('span', { class: 'pic' }, buddyPreview(b.id, state.profile.coat)),
          b.name,
          mine ? null : el('span', { class: 'lock' }, 'From a bestiary card'),
        );
      }),
    );
  }

  function renderCoats() {
    $('#coatBox').hidden = state.profile.beast !== 'cat';
    if (state.profile.beast !== 'cat') return;
    const box = $('#coatPicker');
    box.replaceChildren(
      ...COAT_LIST.map((c) => {
        const mine = state.unlocks.coats.includes(c.id);
        return el(
          'button',
          {
            class: 'coat', type: 'button', role: 'radio', 'aria-checked': String(state.profile.coat === c.id),
            'aria-disabled': String(!mine),
            onclick: () => {
              if (!mine) return toast(`The ${c.name} coat comes from a bestiary card.`, { timeout: 3500 });
              update('profile', (s) => { s.profile.coat = c.id; });
              renderCoats();
            },
          },
          el('span', { class: 'pic' }, buddyPreview('cat', c.id)),
          c.name,
          mine ? null : el('span', { class: 'lock' }, 'From a card'),
        );
      }),
    );
  }

  // ── Sorting notes with Claude: the key lives in its own storage, not in state ──
  function renderClaudeKey() {
    const key = getKey();
    $('#setClaudeKey').value = '';
    $('#setClaudeKey').placeholder = key ? 'saved; paste a new one to replace it' : 'paste it here';
    $('#claudeKeyNote').textContent = key ? `A key ending in ${key.slice(-4)} is saved in this browser.` : 'No key saved. Notes are sorted here in your browser.';
    $('#forgetClaudeKey').hidden = !key;
  }
  $('#setClaudeKey').addEventListener('change', (e) => {
    const key = e.target.value.trim();
    if (!key) return;
    setKey(key);
    renderClaudeKey();
    toast('Key saved in this browser. “Pour out your notes” can now sort with Claude.', { timeout: 4000 });
  });
  $('#forgetClaudeKey').addEventListener('click', () => {
    setKey('');
    renderClaudeKey();
    toast('Key forgotten.', { timeout: 2500 });
  });

  // ── Backdrop ── parchment for everyone; the starry vault once its card turns up.
  function renderBackdrops() {
    const box = $('#backdropPicker');
    box.replaceChildren(
      ...BACKDROP_LIST.map((b) => {
        const mine = state.unlocks.backdrops.includes(b.id);
        return el(
          'button',
          {
            class: 'backdrop', type: 'button', role: 'radio',
            'aria-checked': String(state.scene.backdrop === b.id),
            'aria-disabled': String(!mine),
            onclick: () => {
              if (!mine) return toast(`${b.name} comes from a bestiary card.`, { timeout: 4000 });
              update('scene', (s) => { s.scene.backdrop = b.id; });
              renderBackdrops();
            },
          },
          el('span', { class: `swatch ${b.id}`, 'aria-hidden': 'true' }),
          el('span', {}, b.name),
          mine ? null : el('span', { class: 'lock' }, 'Locked: from a bestiary card'),
        );
      }),
    );
  }

  // ── Timer ──
  const num = (sel, key, lo, hi) =>
    $(sel).addEventListener('change', (e) => {
      const v = clamp(Math.round(+e.target.value || 0), lo, hi);
      e.target.value = v;
      update('timer', (s) => { s.timer[key] = v; });
      timer.refreshDurations();
    });
  num('#setFocus', 'focus', 1, 240);
  num('#setShort', 'short', 1, 60);
  num('#setLong', 'long', 1, 120);
  num('#setEvery', 'longEvery', 1, 12);
  $('#setAutoBreak').addEventListener('change', (e) => update('timer', (s) => { s.timer.autoBreak = e.target.checked; }));
  $('#setAutoFocus').addEventListener('change', (e) => update('timer', (s) => { s.timer.autoFocus = e.target.checked; }));

  // ── Categories ──
  function renderCategories() {
    const box = $('#catEditor');
    box.replaceChildren(
      ...state.categories.map((c) => {
        const row = el(
          'div',
          { class: 'cat-edit' },
          el('input', { name: 'color', type: 'color', value: c.color || PROJECT_COLORS[0], 'aria-label': `Colour for ${c.name}` }),
          el('input', { name: 'name', type: 'text', value: c.name, maxlength: '30', 'aria-label': 'Name' }),
          el('button', {
            class: 'icon-btn', type: 'button', title: 'Remove', 'aria-label': `Remove ${c.name}`,
            disabled: state.categories.length <= 1,
            onclick: () => {
              update('categories', (s) => {
                s.categories = s.categories.filter((x) => x.id !== c.id);
                if (s.category === c.id) s.category = s.categories[0].id;
              });
              renderCategories();
            },
          }, icon('x')),
          el('input', { name: 'note', class: 'note', type: 'text', value: c.note || '', maxlength: '80', placeholder: 'What this project is about (optional)', 'aria-label': 'Description' }),
        );
        row.addEventListener('input', (e) => {
          const f = e.target.name;
          if (!f) return;
          update('categories', (s) => {
            const cat = s.categories.find((x) => x.id === c.id);
            if (!cat) return;
            cat[f] = f === 'name' ? cleanText(e.target.value, 30) || 'Untitled' : f === 'note' ? cleanText(e.target.value, 80) : e.target.value;
            if (f === 'color' && !/^#[0-9a-f]{6}$/i.test(cat.color)) cat.color = PROJECT_COLORS[0];
          });
        });
        return row;
      }),
    );
  }
  $('#addCategory').addEventListener('click', () => {
    update('categories', (s) => { s.categories.push({ id: uid(), name: 'New project', color: PROJECT_COLORS[s.categories.length % PROJECT_COLORS.length], prop: 'laptop', note: '', notes: '' }); });
    renderCategories();
    $('#catEditor').lastElementChild?.querySelector('input[name="name"]')?.select();
  });

  $('#setArchive').addEventListener('change', (e) => {
    const v = clamp(Math.round(+e.target.value || 7), 1, 60);
    e.target.value = v;
    update('planner', (s) => { s.planner.archiveAfter = v; });
  });

  // ── Countdown ──
  $('#setCountOn').addEventListener('change', (e) => update('countdown', (s) => { s.countdown.on = e.target.checked; }));
  $('#setCountLabel').addEventListener('input', (e) => update('countdown', (s) => { s.countdown.label = cleanText(e.target.value, 40); }));
  $('#setCountDate').addEventListener('change', (e) => {
    update('countdown', (s) => {
      s.countdown.date = e.target.value;
      if (e.target.value) s.countdown.on = true;
    });
    $('#setCountOn').checked = state.countdown.on;
  });

  // ── Chatter ──
  $('#setTalks').addEventListener('change', (e) => update('chatter', (s) => { s.catTalks = e.target.checked; }));
  $('#setMessages').addEventListener('input', (e) => {
    const lines = e.target.value.split('\n').map((l) => cleanText(l, 120)).filter(Boolean);
    update('chatter', (s) => { s.messages = lines.length ? lines : [...DEFAULT_MESSAGES]; });
  });

  // ── Sound & alerts ──
  $('#setSound').addEventListener('change', (e) => update('sound', (s) => { s.sound.on = e.target.checked; }));
  $('#setVolume').addEventListener('input', (e) => update('sound', (s) => { s.sound.volume = +e.target.value; }));
  $('#testSound').addEventListener('click', () => play('break'));
  $('#setNotify').addEventListener('change', async (e) => {
    if (!e.target.checked) return update('notify', (s) => { s.notify = false; });
    // In the Mac app, macOS asks for permission itself.
    if (isMac) {
      update('notify', (s) => { s.notify = true; });
      return sendMac({ type: 'askNotify' });
    }
    if (!('Notification' in window)) {
      e.target.checked = false;
      return toast("This browser doesn't support desktop notifications.");
    }
    const perm = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
    const ok = perm === 'granted';
    e.target.checked = ok;
    update('notify', (s) => { s.notify = ok; });
    if (!ok) toast('Notifications are blocked for this site in your browser settings.');
  });

  // ── Look ──
  $('#setTheme').addEventListener('change', (e) => update('theme', (s) => { s.theme = e.target.value; }));
  $('#setTime').addEventListener('change', (e) => update('scene', (s) => { s.scene.time = e.target.value; }));

  // ── Data ──
  $('#exportData').addEventListener('click', () => {
    const blob = new Blob([exportData()], { type: 'application/json' });
    const a = el('a', { href: URL.createObjectURL(blob), download: `pomocat-backup-${dayKey()}.json` });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
  $('#importData').addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      importData(await file.text());
      fill();
      toast('Backup imported.');
    } catch (err) {
      toast(err.message || "Couldn't read that file.");
    }
  });
  $('#resetData').addEventListener('click', () => {
    if (!confirm('Start a fresh book? This deletes your tasks, notes, tallies and settings in this browser.')) return;
    resetAll();
    location.reload();
  });

  return { fill };
}
