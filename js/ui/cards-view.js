// Drawing bestiary cards, the break-time reveal, and the Bestiary page.
//
//   const cardsView = initCards()
//   cardsView.offer()        when a break starts: a face-down card, turn it over or save it
//   cardsView.openBestiary() your collection, and any cards still waiting
//
// A card's look (woodcut, bestiary leaf or playing card) comes from cards.js;
// sizes inside a card are in container units, so one drawing works at any width.

import { state, on } from '../store.js';
import { $, el } from '../util.js';
import { buddyPreview } from '../scene/scene.js';
import { DECK, RARITY, KIND_LABEL, SESSIONS_PER_CARD, styleOf, owns, turnOver, useCard, inUse, justEarned, sessionsToGo, findable, foundCount } from '../cards.js';
import { toast } from './toast.js';

const ART = { possum: 'assets/art/possum-writing.svg', cat: 'assets/art/cat-writing.svg' };

function roman(n) {
  const marks = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  let out = '';
  for (const [v, m] of marks) while (n >= v) { out += m; n -= v; }
  return out;
}

const svg = (markup, cls = '') => {
  const span = el('span', { class: `cf-svg ${cls}`, 'aria-hidden': 'true' });
  span.innerHTML = markup;
  return span;
};

const SHIELD = '<svg viewBox="0 0 100 120"><path d="M12 14 C 36 7 64 7 88 14 C 90 52 82 88 50 112 C 18 88 10 52 12 14 Z" fill="#a8432e" stroke="#1c1913" stroke-width="4" stroke-linejoin="round"/><path d="M20 21 C 40 16 60 16 80 21 C 81 52 75 80 50 100 C 25 80 19 52 20 21 Z" fill="none" stroke="#d6b05c" stroke-width="3"/><path d="M50 34 L54.5 50.5 L71 55 L54.5 59.5 L50 76 L45.5 59.5 L29 55 L45.5 50.5 Z" fill="#f3e7bf" stroke="#1c1913" stroke-width="2.4" stroke-linejoin="round"/></svg>';
const INK = '<svg viewBox="0 0 100 120"><path d="M57 54 C 64 34 77 17 96 5 C 89 24 77 41 63 56" fill="#f3e7bf" stroke="#1c1913" stroke-width="3" stroke-linejoin="round"/><path d="M43 54 C 36 34 23 17 4 5 C 11 24 23 41 37 56" fill="#f3e7bf" stroke="#1c1913" stroke-width="3" stroke-linejoin="round"/><path d="M28 64 C 24 80 23 98 32 106 C 44 114 56 114 68 106 C 77 98 76 80 72 64 Z" fill="#2f4f8f" stroke="#1c1913" stroke-width="4" stroke-linejoin="round"/><path d="M35 52 L65 52 L66 65 L34 65 Z" fill="#2f4f8f" stroke="#1c1913" stroke-width="4" stroke-linejoin="round"/><path d="M38 82 C 42 92 48 96 56 96" fill="none" stroke="#8fa6d6" stroke-width="3" stroke-linecap="round"/></svg>';
const HOURGLASS = '<svg viewBox="0 0 200 200"><circle cx="100" cy="100" r="92" fill="#24407a" stroke="#d6b05c" stroke-width="6"/><circle cx="100" cy="100" r="80" fill="none" stroke="#d6b05c" stroke-width="1.5"/><path d="M100 26 L103 37 L114 40 L103 43 L100 54 L97 43 L86 40 L97 37 Z" fill="#d6b05c"/><path d="M76 64 L124 64 L124 70 C 124 88 108 94 104 100 C 108 106 124 112 124 130 L124 136 L76 136 L76 130 C 76 112 92 106 96 100 C 92 94 76 88 76 70 Z" fill="#f3e7bf" stroke="#d6b05c" stroke-width="3" stroke-linejoin="round"/><path d="M84 128 C 90 116 110 116 116 128 Z M92 76 L108 76 C 106 86 102 90 100 96 C 98 90 94 86 92 76 Z" fill="#d6b05c"/><path d="M70 62 L130 62 M70 138 L130 138" stroke="#d6b05c" stroke-width="5" stroke-linecap="round"/><circle cx="44" cy="100" r="4" fill="#d6b05c"/><circle cx="156" cy="100" r="4" fill="#d6b05c"/><circle cx="100" cy="166" r="4" fill="#d6b05c"/></svg>';
const QUILL = '<svg viewBox="0 0 26 26"><path d="M22 2 C14 4 8 10 5 20 L4 24 L7 21 C12 18 18 12 22 2 Z" fill="#f3e6c4" stroke="#1c1913" stroke-width="1.8" stroke-linejoin="round"/><path d="M5 21 L16 9" stroke="#1c1913" stroke-width="1.6"/></svg>';
const BANNER = '<svg viewBox="0 0 300 52" preserveAspectRatio="none"><path d="M0 8 L28 8 L28 2 L272 2 L272 8 L300 8 L286 27 L300 46 L268 46 L268 50 L32 50 L32 46 L0 46 L14 27 Z" fill="#b33a2a" stroke="#1c1913" stroke-width="2" stroke-linejoin="round"/><rect x="28" y="6" width="244" height="40" fill="#f3e6c4" stroke="#1c1913" stroke-width="2"/></svg>';
const SEAL = '<svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="17" fill="#a8432e"/><circle cx="20" cy="20" r="19" fill="none" stroke="#a8432e" stroke-width="1.2"/><path d="M20 8 L21.6 18.4 L32 20 L21.6 21.6 L20 32 L18.4 21.6 L8 20 L18.4 18.4 Z" fill="#f6ecd4"/></svg>';
const SCALLOP = '<svg viewBox="0 0 312 22" preserveAspectRatio="none"><path d="M0 2 a13 13 0 0 0 26 0 a13 13 0 0 0 26 0 a13 13 0 0 0 26 0 a13 13 0 0 0 26 0 a13 13 0 0 0 26 0 a13 13 0 0 0 26 0 a13 13 0 0 0 26 0 a13 13 0 0 0 26 0 a13 13 0 0 0 26 0 a13 13 0 0 0 26 0 a13 13 0 0 0 26 0 a13 13 0 0 0 26 0" fill="none" stroke="#d6b05c" stroke-width="2"/></svg>';

const star = (on) => `<svg viewBox="0 0 16 16"><path d="M8 0 L9.2 6.8 L16 8 L9.2 9.2 L8 16 L6.8 9.2 L0 8 L6.8 6.8 Z" ${on ? 'fill="#d6b05c"' : 'fill="none" stroke="#6b5a3a" stroke-width="1.2"'}/></svg>`;

/** What's in the picture window. */
function picture(card) {
  if (card.kind === 'beast') return el('img', { class: 'cf-beast', src: ART[card.beast], alt: '' });
  if (card.kind === 'backdrop') {
    return el('span', { class: 'cf-scene' },
      el('img', { class: 'cf-vine tl', src: 'assets/art/margins/top-left.png', alt: '' }),
      el('img', { class: 'cf-vine tr', src: 'assets/art/margins/top-right.png', alt: '' }),
      el('img', { class: 'cf-beast small', src: ART.possum, alt: '' }));
  }
  if (card.kind === 'coat') return el('span', { class: 'cf-medal' }, buddyPreview('cat', card.coat));
  return svg(card.id === 'shield' ? SHIELD : INK, 'cf-emblem');
}

const label = (card) => `Bestiary card number ${card.no}: ${card.name}, a ${RARITY[card.rarity].toLowerCase()} ${KIND_LABEL[card.kind].toLowerCase()}`;

/** The face of a card, in its own style. */
export function cardFace(card) {
  const style = styleOf(card);
  const kind = KIND_LABEL[card.kind].toUpperCase();
  if (style === 'woodcut') {
    return el('article', { class: 'card-face cf-woodcut', 'aria-label': label(card) }, el('div', { class: 'cf-card' },
      el('div', { class: 'cf-frame' },
        el('div', { class: 'cf-top' }, el('h3', { class: 'cf-name' }, card.name), el('span', { class: 'cf-no' }, String(card.no))),
        el('div', { class: 'cf-pic' }, picture(card)),
        svg(SCALLOP, 'cf-scallop'),
        el('div', { class: 'cf-foot' }, el('span', {}, kind), svg([1, 2, 3, 4].map((i) => star(i <= card.rarity)).join(''), 'cf-stars')))));
  }
  if (style === 'leaf') {
    return el('article', { class: 'card-face cf-leaf', 'aria-label': label(card) }, el('div', { class: 'cf-card' },
      el('div', { class: 'cf-frame' },
        el('p', { class: 'cf-kindrow' }, kind, el('span', { class: 'cf-no' }, `No. ${card.no}`)),
        el('h3', { class: 'cf-name' }, el('span', { class: 'initial' }, card.name[0]), card.name.slice(1)),
        el('div', { class: 'cf-pic' }, picture(card)),
        el('p', { class: 'cf-line' }, card.line),
        el('div', { class: 'cf-seal' }, svg(SEAL), el('span', {}, `${RARITY[card.rarity]} seal`)))));
  }
  return el('article', { class: 'card-face cf-playing', 'aria-label': label(card) }, el('div', { class: 'cf-card' },
    el('div', { class: 'cf-frame' },
      el('div', { class: 'cf-top' }, svg(QUILL, 'cf-quill'), el('span', { class: 'cf-no' }, roman(card.no)), svg(QUILL, 'cf-quill flip-x')),
      el('div', { class: 'cf-pic' }, picture(card)),
      el('div', { class: 'cf-banner' }, svg(BANNER), el('h3', { class: 'cf-name' }, card.name.toUpperCase())))));
}

export function cardBack(text = '') {
  return el('div', { class: 'card-back', role: 'img', 'aria-label': text || 'A face-down card' },
    el('div', { class: 'cb-card' }, el('div', { class: 'cb-frame' }, svg(HOURGLASS, 'cb-medal'), text ? el('span', { class: 'cb-text' }, text) : null)));
}

// ── The reveal ──────────────────────────────────────────────────────────────
const NOTE = {
  beast: 'A new beast for your bestiary. Make it your buddy any time.',
  backdrop: 'A new backdrop for the page. Switch to it any time.',
  coat: 'A new coat for your cat.',
};
const USE = { beast: 'Make it my buddy', backdrop: 'Use this backdrop', coat: 'Dress my cat in it' };

export function initCards() {
  const dlg = $('#reveal');
  const flip = $('#revealFlip');
  const page = $('#bestiary');

  function setActions(...buttons) {
    $('#revealActions').replaceChildren(...buttons.filter(Boolean));
  }
  const button = (text, onclick, main = false) => el('button', { class: `ink-btn${main ? ' main' : ''}`, type: 'button', onclick }, text);
  const waitingLine = () => (state.cards.waiting > 1 ? `${state.cards.waiting} cards are waiting.` : '');

  function showBack({ kicker = 'A CARD FOR YOU', why = '' } = {}) {
    flip.classList.remove('turned');
    $('#revealFlipBack').replaceChildren(cardBack());
    $('#revealFlipFront').replaceChildren();
    $('#revealKicker').textContent = kicker;
    $('#revealTitle').textContent = state.cards.waiting > 1 ? `${state.cards.waiting} cards for your break` : 'A card for your break';
    $('#revealWhy').textContent = why;
    $('#revealNote').textContent = '';
    setActions(button('Turn it over', turn, true), button('Save for later', save));
  }

  function turn() {
    const got = turnOver();
    if (!got) return close();
    const { card } = got;
    $('#revealFlipFront').replaceChildren(cardFace(card));
    requestAnimationFrame(() => flip.classList.add('turned'));
    $('#revealKicker').textContent = got.isNew ? `NEW ${KIND_LABEL[card.kind].toUpperCase()}` : 'ANOTHER HELPER';
    $('#revealTitle').textContent = card.kind === 'beast' ? `The ${card.name}` : card.name;
    $('#revealWhy').textContent = '';
    const kept = card.id === 'shield' ? state.cards.shields : state.cards.ink;
    $('#revealNote').textContent = card.kind === 'helper'
      ? `${card.line} You have ${kept === 1 ? 'one' : kept}.`
      : NOTE[card.kind];
    const canUse = USE[card.kind] && !inUse(card);
    setActions(
      canUse ? button(USE[card.kind], () => { useCard(card); toast(card.kind === 'beast' ? `Your ${card.name} is at its desk.` : 'Done.', { timeout: 2500 }); close(); }, true) : null,
      state.cards.waiting > 0 ? button(`Turn over another (${state.cards.waiting} left)`, () => showBack(), !canUse) : null,
      button(page.hidden ? 'Back to my break' : 'Back to the bestiary', close, !canUse && !state.cards.waiting),
    );
    renderBestiary();
  }

  function save() {
    close();
    toast(state.cards.waiting === 1 ? 'Saved. It waits face down in your bestiary.' : 'Saved. They wait face down in your bestiary.', { timeout: 3500 });
  }

  function close() {
    if (dlg.open) dlg.close();
  }

  /** When a break starts: offer the waiting card(s). */
  function offer() {
    if (state.cards.waiting <= 0 || dlg.open) return;
    showBack({ kicker: 'FOUR SESSIONS DONE', why: justEarned() ? `Earned for finishing ${SESSIONS_PER_CARD} focus sessions.` : '' });
    dlg.showModal();
  }

  function openOne() {
    if (state.cards.waiting <= 0) return;
    showBack();
    dlg.showModal();
  }

  // ── The Bestiary page ──
  function renderBestiary() {
    if (page.hidden) return;
    const total = DECK.length;
    $('#bestiaryCount').textContent = `${foundCount()} of ${total} found`;
    const sections = [
      ['beast', 'Beasts'],
      ['backdrop', 'Backdrops'],
      ['coat', 'Coats for your cat'],
      ['helper', 'Helpers'],
    ];
    const slot = (card) => {
      const mine = owns(card.id);
      if (!mine) return el('div', { class: 'slot' }, cardBack(`No. ${card.no}`), el('p', { class: 'slot-cap' }, 'Not yet found'));
      const using = inUse(card);
      const extra = card.kind === 'helper'
        ? el('p', { class: 'slot-cap' }, `You have ${card.id === 'shield' ? state.cards.shields : state.cards.ink}`)
        : using
          ? el('p', { class: 'slot-cap yours' }, 'Yours now')
          : el('button', { class: 'link-btn', type: 'button', onclick: () => { useCard(card); renderBestiary(); } }, USE[card.kind]);
      return el('div', { class: 'slot' }, cardFace(card), extra);
    };
    $('#bestiaryBody').replaceChildren(
      state.cards.waiting > 0
        ? el('div', { class: 'waiting' },
            el('div', { class: 'stack', 'aria-hidden': 'true' }, cardBack(), cardBack()),
            el('div', {},
              el('p', { class: 'waiting-title' }, state.cards.waiting === 1 ? 'One card waits face down' : `${state.cards.waiting} cards wait face down`),
              el('button', { class: 'ink-btn main', type: 'button', onclick: openOne }, 'Turn one over')))
        : el('p', { class: 'aside' }, `Every ${SESSIONS_PER_CARD} focus sessions earns a card: ${toGoLine()}. ${findable().filter((c) => !owns(c.id)).length ? 'There is more to find.' : 'You have found every card; helpers still turn up.'}`),
      ...sections.map(([kind, title]) => el('section', { class: 'shelf', 'aria-label': title },
        el('h3', {}, title),
        el('div', { class: 'shelf-cards' }, ...DECK.filter((c) => c.kind === kind).map(slot)))),
    );
  }

  function openBestiary() {
    page.hidden = false;
    renderBestiary();
  }
  $('#closeBestiary').addEventListener('click', () => { page.hidden = true; });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !page.hidden && !dlg.open) page.hidden = true;
  });
  $('#bestiaryBtn').addEventListener('click', openBestiary);
  dlg.addEventListener('close', renderBestiary);

  const toGoLine = () => (sessionsToGo() === 1 ? 'one more session to the next' : `${sessionsToGo()} more sessions to the next`);
  // On the break card: how close the next card is.
  function renderToward() {
    $('#cardNote').textContent = `${toGoLine()[0].toUpperCase()}${toGoLine().slice(1)} card.`;
  }

  function renderBadge() {
    const b = $('#cardBadge');
    b.hidden = !state.cards.waiting;
    b.textContent = state.cards.waiting > 9 ? '9+' : String(state.cards.waiting);
    $('#bestiaryBtn').setAttribute('aria-label', state.cards.waiting ? `Bestiary, ${state.cards.waiting} cards waiting` : 'Bestiary');
  }
  on('cards', () => { renderBadge(); renderToward(); renderBestiary(); });
  on('profile', renderBestiary);
  on('scene', renderBestiary);
  on('all', () => { renderBadge(); renderToward(); renderBestiary(); });
  renderBadge();
  renderToward();

  return { offer, openBestiary, isOpen: () => !page.hidden || dlg.open, waitingLine };
}
