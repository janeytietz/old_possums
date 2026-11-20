// Buddy rooms: peer-to-peer "body doubling" over WebRTC.
//
// Uses Trystero (https://github.com/dmotz/trystero) with its Nostr strategy, so
// there is no server to run and no accounts: browsers find each other through
// public Nostr relays, then talk directly and end-to-end encrypted. The room
// code doubles as the password that encrypts the matchmaking messages.
//
// Want a more reliable backbone later? Swap LIB for '@trystero-p2p/supabase' or
// '@trystero-p2p/firebase' (same API) and add your project details to joinRoom().

import { COAT_IDS, BEAST_IDS } from './coats.js';
import { isPhase } from './timer.js';
import { clamp, cleanText, pick } from './util.js';

const LIB = 'https://cdn.jsdelivr.net/npm/@trystero-p2p/nostr@0.26.0/+esm';
const APP_ID = 'pomocat-buddy-doubling-v1';
const STATUSES = ['focus', 'break', 'paused', 'idle', 'away'];
const PROPS = ['laptop', 'notebook', 'book'];
const MAX_BYTES = 4096;

// ── Room codes ──────────────────────────────────────────────────────────────
const ADJ = ['amber', 'autumn', 'calm', 'cocoa', 'cozy', 'dreamy', 'dusky', 'foggy', 'fuzzy', 'gentle',
  'golden', 'hazel', 'honey', 'lazy', 'lucky', 'maple', 'merry', 'misty', 'mossy', 'plum', 'quiet',
  'rainy', 'rosy', 'sage', 'sleepy', 'snug', 'soft', 'sunny', 'toasty', 'velvet', 'warm', 'woolly'];
const NOUN = ['acorn', 'biscuit', 'bramble', 'candle', 'clover', 'comet', 'cricket', 'cushion', 'fern',
  'harbor', 'kettle', 'lagoon', 'lantern', 'marble', 'meadow', 'mitten', 'muffin', 'nimbus', 'otter',
  'pancake', 'pebble', 'pillow', 'puddle', 'quill', 'scarf', 'sparrow', 'sprout', 'sunbeam', 'teacup',
  'thimble', 'walnut', 'willow'];

export function newRoomCode() {
  return `${pick(ADJ)}-${pick(NOUN)}-${1000 + Math.floor(Math.random() * 9000)}`;
}

/** Accepts a bare code or a full invite link; returns a normalised code or ''. */
export function parseRoomCode(input) {
  let s = String(input || '').trim();
  const m = s.match(/[#&?]room=([^&\s]+)/i);
  if (m) {
    try {
      s = decodeURIComponent(m[1]);
    } catch {
      s = m[1];
    }
  }
  s = s.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  return s.length >= 4 && s.length <= 64 ? s : '';
}

export function inviteLink(code) {
  const url = new URL(location.href);
  url.hash = `room=${encodeURIComponent(code)}`;
  url.search = '';
  return url.toString();
}

// ── Message hygiene: everything from peers is untrusted ─────────────────────
function cleanPresence(d) {
  if (!d || typeof d !== 'object') return null;
  return {
    name: cleanText(d.name, 24) || 'A buddy',
    beast: BEAST_IDS.includes(d.beast) ? d.beast : 'cat',
    coat: COAT_IDS.includes(d.coat) ? d.coat : 'ginger',
    status: STATUSES.includes(d.status) ? d.status : 'idle',
    phase: isPhase(d.phase) ? d.phase : 'focus',
    running: !!d.running,
    remaining: clamp(+d.remaining || 0, 0, 6 * 3600e3),
    category: cleanText(d.category, 30),
    prop: PROPS.includes(d.prop) ? d.prop : 'laptop',
    task: cleanText(d.task, 80),
    sessions: clamp(Math.floor(+d.sessions || 0), 0, 999),
    follow: !!d.follow,
  };
}

function cleanTimer(d) {
  if (!d || typeof d !== 'object' || !isPhase(d.phase)) return null;
  const dur = d.durations || {};
  const mins = (v, lo, hi, dflt) => clamp(+v || dflt, lo, hi);
  return {
    v: clamp(Math.floor(+d.v || 0), 0, Number.MAX_SAFE_INTEGER),
    by: /^[A-Za-z0-9_-]{1,40}$/.test(String(d.by || '')) ? d.by : '',
    phase: d.phase,
    running: !!d.running,
    remaining: clamp(+d.remaining || 0, 0, 6 * 3600e3),
    total: clamp(+d.total || 0, 60e3, 6 * 3600e3),
    cycle: clamp(Math.floor(+d.cycle || 0), 0, 99),
    durations: {
      focus: mins(dur.focus, 1, 240, 25),
      short: mins(dur.short, 1, 60, 5),
      long: mins(dur.long, 1, 120, 15),
      longEvery: Math.floor(mins(dur.longEvery, 1, 12, 4)),
      autoBreak: !!dur.autoBreak,
      autoFocus: !!dur.autoFocus,
    },
  };
}

const newer = (a, b) => !b || a.v > b.v || (a.v === b.v && a.by > b.by);

/**
 * Where a shared timer is now, given how long ago we heard about it. Phases
 * that ended in the meantime are stepped through the same way every peer's
 * own timer does, so a stale "focus, 0:00 left" is never replayed.
 */
function project(t, elapsed) {
  const s = { ...t, durations: { ...t.durations } };
  if (!s.running) return s;
  const d = s.durations;
  let left = s.remaining - elapsed;
  for (let guard = 0; left <= 0 && guard < 100; guard++) {
    if (s.phase === 'focus') {
      s.cycle += 1;
      s.phase = s.cycle % (d.longEvery || 4) === 0 ? 'long' : 'short';
    } else {
      if (s.phase === 'long') s.cycle = 0;
      s.phase = 'focus';
    }
    s.total = Math.round((d[s.phase] || 25) * 60000);
    const auto = s.phase === 'focus' ? d.autoFocus : d.autoBreak;
    if (!auto) {
      s.running = false;
      s.remaining = s.total;
      return s;
    }
    left += s.total;
  }
  s.remaining = Math.max(0, Math.round(left));
  return s;
}

function send(action, data, opts) {
  try {
    action?.send(data, opts)?.catch?.(() => {});
  } catch {
    /* peer went away mid-send */
  }
}

// ── Room ────────────────────────────────────────────────────────────────────
export class BuddyRoom extends EventTarget {
  /**
   * @param {string} code
   * @param {() => object} getPresence  returns this user's current presence
   */
  constructor(code, getPresence) {
    super();
    this.code = code;
    this.getPresence = getPresence;
    this.peers = new Map(); // peerId → presence (+ seen)
    this.timerState = null; // latest shared room timer
    this.timerSetAt = 0;
    this.chat = [];
    this.status = 'connecting';
    this.selfId = null;
    this.left = false;
    this.chatTimes = new Map();
  }

  emit(type, detail) {
    this.dispatchEvent(new CustomEvent(type, { detail }));
  }

  async join() {
    let lib;
    try {
      lib = await import(LIB);
    } catch (err) {
      this.setStatus('offline');
      throw new Error("Couldn't load the buddy-room code. Are you online?");
    }
    if (this.left) return; // left while the library was loading
    this.lib = lib;
    this.selfId = lib.selfId;
    const room = lib.joinRoom({ appId: APP_ID, password: this.code }, `room-${this.code}`);
    this.room = room;

    const action = (name) => room.makeAction(name, { onReceive: ({ byteLength }) => byteLength <= MAX_BYTES });
    this.aPresence = action('presence');
    this.aTimer = action('timer');
    this.aChat = action('chat');
    this.aPaw = action('paw');
    this.aNews = action('news');

    room.onPeerJoin = (peerId) => {
      this.sendPresence(peerId);
      // Bring the newcomer up to speed on the shared timer.
      if (this.timerState) {
        const live = this.getLiveTimer?.();
        const t = live ? { ...this.timerState, ...live } : this.liveTimer();
        send(this.aTimer, t, { target: peerId });
      }
    };
    room.onPeerLeave = (peerId) => {
      const p = this.peers.get(peerId);
      this.peers.delete(peerId);
      if (p) this.emit('leave', { peerId, ...p });
      this.emit('peers');
    };

    this.aPresence.onMessage = (data, { peerId }) => {
      const p = cleanPresence(data);
      if (!p) return;
      const isNew = !this.peers.has(peerId);
      this.peers.set(peerId, { ...p, seen: Date.now(), localAt: Date.now() });
      if (isNew) this.emit('join', { peerId, ...p });
      this.emit('peers');
    };

    this.aTimer.onMessage = (data, { peerId }) => {
      const t = cleanTimer(data);
      if (!t) return;
      if (!t.by) t.by = peerId;
      if (newer(t, this.timerState)) {
        this.timerState = t;
        this.timerSetAt = Date.now();
        this.emit('timer', { ...t, from: peerId });
      }
    };

    this.aChat.onMessage = (data, { peerId }) => {
      const text = cleanText(data?.text, 280);
      if (!text) return;
      // gentle flood protection: max 5 messages per 5 s per peer
      const now = Date.now();
      const times = (this.chatTimes.get(peerId) || []).filter((t) => now - t < 5000);
      if (times.length >= 5) return;
      times.push(now);
      this.chatTimes.set(peerId, times);
      const p = this.peers.get(peerId);
      const msg = { from: peerId, name: p?.name || 'A buddy', beast: p?.beast || 'cat', coat: p?.coat || 'ginger', text, at: now };
      this.pushChat(msg);
      this.emit('chat', msg);
    };

    this.aNews.onMessage = (data, { peerId }) => {
      const text = cleanText(data?.text, 120);
      if (!text) return;
      const now = Date.now();
      const times = (this.chatTimes.get(`n:${peerId}`) || []).filter((t) => now - t < 10000);
      if (times.length >= 5) return;
      times.push(now);
      this.chatTimes.set(`n:${peerId}`, times);
      this.emit('news', { from: peerId, name: this.peers.get(peerId)?.name || 'A cat', text });
    };

    this.aPaw.onMessage = (data, { peerId }) => {
      const to = cleanText(data?.to, 40);
      if (!to) return;
      this.emit('paw', { from: peerId, to, name: this.peers.get(peerId)?.name || 'A cat' });
    };

    this.beat = setInterval(() => this.sendPresence(), 15000);
    this.sweep = setInterval(() => this.pruneQuiet(), 10000);
    this.relayCheck = setInterval(() => this.checkRelays(), 1500);
    this.joinedAt = Date.now();
    this.checkRelays();
  }

  setStatus(s) {
    if (s === this.status) return;
    this.status = s;
    this.emit('status', s);
  }

  checkRelays() {
    if (!this.lib) return;
    if (this.peers.size) return this.setStatus('connected');
    const sockets = Object.values(this.lib.getRelaySockets?.() || {});
    const open = sockets.some((ws) => ws && ws.readyState === 1);
    if (open) this.setStatus('waiting');
    else if (Date.now() - this.joinedAt > 20000) this.setStatus('offline');
    else this.setStatus('connecting');
  }

  // Peers that vanish without a clean leave (closed laptop lid) are dropped
  // after a few minutes of silence. Kept generous so a buddy whose tab is in
  // the background (slower heartbeats) doesn't flicker in and out.
  pruneQuiet() {
    const now = Date.now();
    let changed = false;
    for (const [id, p] of this.peers) {
      if (now - p.seen > 180000) {
        this.peers.delete(id);
        changed = true;
        this.emit('leave', { peerId: id, ...p });
      }
    }
    if (changed) this.emit('peers');
    this.checkRelays();
  }

  sendPresence(target) {
    if (!this.aPresence) return;
    send(this.aPresence, this.getPresence(), target ? { target } : undefined);
  }

  /** Share a change you made to the room timer. */
  shareTimer(snapshot, durations) {
    if (!this.aTimer) return;
    const v = (this.timerState?.v || 0) + 1;
    this.timerState = { v, by: this.selfId, ...snapshot, durations: { ...durations } };
    this.timerSetAt = Date.now();
    send(this.aTimer, this.timerState);
  }

  /** The room timer as it stands right now (remaining adjusted for time passed). */
  liveTimer() {
    const t = this.timerState;
    if (!t) return null;
    return project(t, Date.now() - this.timerSetAt);
  }

  sendChat(text) {
    const clean = cleanText(text, 280);
    if (!clean || !this.aChat) return null;
    send(this.aChat, { text: clean });
    const p = this.getPresence();
    const msg = { from: this.selfId, name: p.name, beast: p.beast, coat: p.coat, text: clean, at: Date.now(), self: true };
    this.pushChat(msg);
    return msg;
  }

  pushChat(msg) {
    this.chat.push(msg);
    if (this.chat.length > 150) this.chat.shift();
  }

  /** Tell the room you finished something. */
  sendNews(text) {
    const clean = cleanText(text, 120);
    if (clean) send(this.aNews, { text: clean });
  }

  sendPaw(to) {
    if (!this.aPaw) return;
    send(this.aPaw, { to });
  }

  leave() {
    this.left = true;
    clearInterval(this.beat);
    clearInterval(this.sweep);
    clearInterval(this.relayCheck);
    try {
      this.room?.leave();
    } catch {
      /* already gone */
    }
    this.peers.clear();
    this.room = null;
    this.emit('left');
  }
}
