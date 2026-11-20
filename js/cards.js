// Bestiary cards: the deck, how cards are earned, and what turning one over does.
//
// Earning: one card for every four focus sessions you complete (the user's
// rule), counted across days. The break that follows the fourth opens with the
// card face down; you can turn it over or save it for later in the Bestiary.
//
// The deck: the possum (everyone's first buddy), the Scribe Cat (always the
// first card turned over), the starry vault backdrop, eight coats for the cat,
// and two helpers that can turn up again and again (Streak Shield, Double Ink).
// Each card has one of three looks (woodcut, bestiary leaf, playing card),
// taken in turn through the deck, so a card always looks the same.

import { state, update, emit, unlock } from './store.js';
import { dayKey } from './util.js';

export const RARITY = ['', 'Common', 'Uncommon', 'Rare', 'Very rare'];
export const STYLES = ['woodcut', 'leaf', 'playing'];
export const KIND_LABEL = { beast: 'Beast', backdrop: 'Backdrop', coat: 'Coat', helper: 'Helper' };

const coat = (no, id, name, rarity, line) => ({ no, id: `coat-${id}`, kind: 'coat', coat: id, name, rarity, line });

export const DECK = [
  { no: 1, id: 'possum', kind: 'beast', beast: 'possum', name: 'Old Possum', rarity: 1, starter: true,
    line: 'It writes through every hour, and if you wander off it plays dead until you come back.' },
  { no: 2, id: 'cat', kind: 'beast', beast: 'cat', name: 'Scribe Cat', rarity: 1,
    line: 'It sits at its desk through every hour, and sharpens its quill whenever you sharpen yours.' },
  { no: 3, id: 'vault', kind: 'backdrop', backdrop: 'vault', name: 'The Starry Vault', rarity: 3,
    line: 'A painted sky of gold stars, for working late beneath.' },
  coat(4, 'tuxedo', 'Tuxedo', 1, 'Black and white, as if dressed for a feast.'),
  coat(5, 'midnight', 'Midnight', 2, 'Dark as an ink pot, with eyes like lamps.'),
  coat(6, 'silver', 'Silver Tabby', 1, 'Grey stripes, like pencil on old paper.'),
  coat(7, 'calico', 'Calico', 2, 'Patches of orange and black, like a careful map.'),
  coat(8, 'snow', 'Snowball', 2, 'White as a fresh page.'),
  coat(9, 'siamese', 'Siamese', 3, 'Cream with dark points, and opinions.'),
  coat(10, 'blue', 'Bluebell', 2, 'Soft blue-grey, like dusk over the scriptorium.'),
  coat(11, 'cocoa', 'Cocoa Tabby', 1, 'Brown stripes, warm as toast.'),
  { no: 12, id: 'shield', kind: 'helper', name: 'Streak Shield', rarity: 2, repeats: true,
    line: 'Keeps your streak going through one missed day. Used up when it does.' },
  { no: 13, id: 'ink', kind: 'helper', name: 'Double Ink', rarity: 2, repeats: true,
    line: 'Your next focus session counts twice toward your level.' },
];

export const cardById = (id) => DECK.find((c) => c.id === id);
export const styleOf = (card) => STYLES[(card.no - 1) % STYLES.length];
export const owns = (id) => state.cards.owned.includes(id);
export const findable = () => DECK.filter((c) => !c.starter);
export const foundCount = () => DECK.filter((c) => owns(c.id)).length;

// ── Earning ─────────────────────────────────────────────────────────────────
export const SESSIONS_PER_CARD = 4;
let earnedNow = false;

function earn(n = 1) {
  update('cards', (s) => { s.cards.waiting += n; });
  earnedNow = true;
  emit('cardEarned', { n });
}

/** Count a finished focus session. Returns true if it earned a card. */
export function sessionDone() {
  let won = false;
  update('cards', (s) => {
    s.cards.toward += 1;
    if (s.cards.toward >= SESSIONS_PER_CARD) {
      s.cards.toward = 0;
      won = true;
    }
  });
  if (won) earn();
  return won;
}

/** Sessions still to go before the next card. */
export const sessionsToGo = () => SESSIONS_PER_CARD - state.cards.toward;

/** True once after a card was earned (so the reveal can say why). */
export function justEarned() {
  const was = earnedNow;
  earnedNow = false;
  return was;
}

// ── Double Ink: switched on for one focus session, from start to finish ────
export function beginFocus() {
  if (state.cards.inkActive || state.cards.ink <= 0) return false;
  update('cards', (s) => { s.cards.ink -= 1; s.cards.inkActive = true; });
  return true;
}
export function endFocus() {
  if (state.cards.inkActive) update('cards', (s) => { s.cards.inkActive = false; });
}

// ── Turning a card over ─────────────────────────────────────────────────────
const WEIGHT = { 1: 6, 2: 3, 3: 1.6, 4: 0.8 };

function draw() {
  // The cat is always the first card you find.
  if (!owns('cat')) return cardById('cat');
  const pool = DECK.filter((c) => {
    if (c.starter) return false;
    if (c.repeats) return true;
    return !owns(c.id);
  });
  // Helpers come up less often while there's still something new to find.
  const fresh = pool.some((c) => !c.repeats);
  const weight = (c) => WEIGHT[c.rarity] * (c.repeats && fresh ? 0.5 : 1);
  let roll = Math.random() * pool.reduce((sum, c) => sum + weight(c), 0);
  for (const c of pool) {
    roll -= weight(c);
    if (roll <= 0) return c;
  }
  return pool[pool.length - 1];
}

/** Turn over one waiting card: adds it to your bestiary and applies it. */
export function turnOver() {
  if (state.cards.waiting <= 0) return null;
  const card = draw();
  const isNew = !owns(card.id);
  update('cards', (s) => {
    s.cards.waiting -= 1;
    if (!s.cards.owned.includes(card.id)) s.cards.owned.push(card.id);
    if (card.id === 'shield') s.cards.shields += 1;
    if (card.id === 'ink') s.cards.ink += 1;
  });
  if (card.kind === 'beast') unlock('beasts', card.beast);
  if (card.kind === 'backdrop') unlock('backdrops', card.backdrop);
  if (card.kind === 'coat') unlock('coats', card.coat);
  return { card, isNew };
}

/** What using a card does: your buddy, your backdrop, or your cat's coat. */
export function useCard(card) {
  if (card.kind === 'beast') update('profile', (s) => { s.profile.beast = card.beast; });
  if (card.kind === 'backdrop') update('scene', (s) => { s.scene.backdrop = card.backdrop; });
  if (card.kind === 'coat') update('profile', (s) => { s.profile.coat = card.coat; s.profile.beast = 'cat'; });
}

export function inUse(card) {
  if (card.kind === 'beast') return state.profile.beast === card.beast;
  if (card.kind === 'backdrop') return state.scene.backdrop === card.backdrop;
  if (card.kind === 'coat') return state.profile.beast === 'cat' && state.profile.coat === card.coat;
  return false;
}
