// ─────────────────────────────────────────────────────────────────────────────
//  Collectible items you win by turning over cards after a pomodoro.
//
//  slot: 'head' | 'face' | 'neck' are worn by your cat (drawn in the cat's own
//  coordinates: x = 0 is the centre line, the top of the head is y ≈ -208).
//  slot: 'desk' items sit on the desk (base at 0,0, same scale as the cat).
//  Shapes with class "ink" get an ink outline in the hand-drawn look.
// ─────────────────────────────────────────────────────────────────────────────

export const RARITY = {
  common: { label: 'Common', weight: 60, color: '#7d9270' },
  uncommon: { label: 'Uncommon', weight: 30, color: '#4f7591' },
  rare: { label: 'Rare', weight: 10, color: '#c8674a' },
};

export const ITEMS = [
  // ── Worn ──
  {
    id: 'bow', name: 'Ribbon bow', slot: 'head', rarity: 'common', blurb: 'Tied with care. Mostly.',
    svg: `<g transform="translate(-40 -214) rotate(-18)">
      <path class="ink" d="M 0 0 C -14 -16 -30 -12 -28 0 C -30 12 -14 16 0 0 Z" fill="#e7849a"/>
      <path class="ink" d="M 0 0 C 14 -16 30 -12 28 0 C 30 12 14 16 0 0 Z" fill="#e7849a"/>
      <path d="M -20 -4 Q -12 -2 -6 0 M 20 -4 Q 12 -2 6 0" stroke="#c9607a" stroke-width="2" fill="none"/>
      <circle class="ink" r="6" fill="#d76f88"/></g>`,
  },
  {
    id: 'party', name: 'Party hat', slot: 'head', rarity: 'common', blurb: 'Every finished session is a small party.',
    svg: `<g transform="translate(14 -206) rotate(14)">
      <path class="ink" d="M -26 0 L 0 -66 L 26 0 Z" fill="#7fb3c9"/>
      <path d="M -15 -28 L 15 -28 M -8 -48 L 8 -48 M -21 -12 L 21 -12" stroke="#f3d27a" stroke-width="6" stroke-linecap="round"/>
      <circle class="ink" cy="-68" r="8" fill="#e7849a"/></g>`,
  },
  {
    id: 'scarf', name: 'Knitted scarf', slot: 'neck', rarity: 'common', blurb: 'Hand-knitted during a very long break.',
    svg: `<g>
      <path class="ink" d="M -58 -112 Q 0 -86 58 -112 L 60 -94 Q 0 -66 -60 -94 Z" fill="#c8674a"/>
      <path d="M -44 -101 L -44 -86 M -24 -94 L -24 -80 M -4 -92 L -4 -78 M 16 -94 L 16 -80 M 36 -99 L 36 -85" stroke="#e9a37f" stroke-width="5" stroke-linecap="round"/>
      <path class="ink" d="M 26 -92 L 44 -92 L 52 -30 L 30 -30 Z" fill="#c8674a"/>
      <path d="M 32 -30 L 32 -20 M 40 -30 L 40 -20 M 48 -30 L 48 -20" stroke="#c8674a" stroke-width="3" stroke-linecap="round"/></g>`,
  },
  {
    id: 'beanie', name: 'Cozy beanie', slot: 'head', rarity: 'uncommon', blurb: 'Warm ears, clear thoughts.',
    svg: `<g transform="translate(0 -196)">
      <path class="ink" d="M -40 0 C -42 -30 -24 -46 0 -46 C 24 -46 42 -30 40 0 Z" fill="#d9a441"/>
      <path d="M -26 -6 L -26 -36 M -13 -4 L -13 -42 M 0 -4 L 0 -45 M 13 -4 L 13 -42 M 26 -6 L 26 -36" stroke="#b8862e" stroke-width="2.5" stroke-linecap="round"/>
      <rect class="ink" x="-44" y="-8" width="88" height="16" rx="7" fill="#c49036"/>
      <circle class="ink" cy="-52" r="11" fill="#f3e3c3"/></g>`,
  },
  {
    id: 'beret', name: 'Artist beret', slot: 'head', rarity: 'uncommon', blurb: 'For creative sessions and strong opinions.',
    svg: `<g transform="translate(-6 -204) rotate(-12)">
      <ellipse class="ink" cx="0" cy="0" rx="52" ry="15" fill="#9a4f45"/>
      <path d="M -40 2 Q 0 14 40 2" stroke="#7e3d35" stroke-width="3" fill="none"/>
      <path class="ink" d="M -3 -14 L 0 -26 L 3 -14 Z" fill="#7e3d35"/></g>`,
  },
  {
    id: 'glasses', name: 'Round glasses', slot: 'face', rarity: 'uncommon', blurb: 'Instantly +2 to reading comprehension.',
    svg: `<g fill="#cfe7f2" fill-opacity=".28" stroke="#2a1f1a" stroke-width="3">
      <circle cx="-26" cy="-158" r="17"/><circle cx="26" cy="-158" r="17"/>
      <path d="M -9 -160 Q 0 -166 9 -160 M -43 -160 L -58 -166 M 43 -160 L 58 -166" fill="none"/></g>`,
  },
  {
    id: 'headphones', name: 'Headphones', slot: 'head', rarity: 'rare', blurb: 'Lo-fi beats to purr to.',
    svg: `<g>
      <path class="ink" d="M -60 -146 C -66 -214 66 -214 60 -146" fill="none" stroke="#5f8b6a" stroke-width="9" stroke-linecap="round"/>
      <rect class="ink" x="-74" y="-162" width="20" height="38" rx="9" fill="#5f8b6a"/>
      <rect class="ink" x="54" y="-162" width="20" height="38" rx="9" fill="#5f8b6a"/>
      <rect x="-70" y="-156" width="8" height="26" rx="4" fill="#f3e3c3"/><rect x="62" y="-156" width="8" height="26" rx="4" fill="#f3e3c3"/></g>`,
  },
  {
    id: 'flowers', name: 'Flower crown', slot: 'head', rarity: 'rare', blurb: 'Grown slowly, one pomodoro at a time.',
    svg: `<g>${[[-44, -192], [-24, -204], [0, -208], [24, -204], [44, -192]].map(([x, y], i) => `
      <g transform="translate(${x} ${y})">${[0, 72, 144, 216, 288].map((a) => `<circle class="ink" cx="${Math.cos((a * Math.PI) / 180) * 6}" cy="${Math.sin((a * Math.PI) / 180) * 6}" r="5" fill="${['#f3a6b8', '#f3d27a', '#ffffff', '#b7a4e8', '#f3a6b8'][i]}"/>`).join('')}
      <circle r="3.5" fill="#d9a441"/></g>`).join('')}
      <path d="M -32 -198 q 4 -6 8 -2 M 10 -206 q 4 -6 8 -2 M 32 -198 q 4 -6 8 -2" stroke="#5f8b6a" stroke-width="3" fill="none"/></g>`,
  },
  {
    id: 'crown', name: 'Tiny crown', slot: 'head', rarity: 'rare', blurb: 'Ruler of the to-do list.',
    svg: `<g transform="translate(10 -204) rotate(10)">
      <path class="ink" d="M -28 0 L -32 -34 L -15 -18 L 0 -40 L 15 -18 L 32 -34 L 28 0 Z" fill="#e8b94a"/>
      <circle cx="0" cy="-12" r="5" fill="#c8674a"/><circle cx="-17" cy="-8" r="3.5" fill="#4f7591"/><circle cx="17" cy="-8" r="3.5" fill="#5f8b6a"/></g>`,
  },

  // ── Desk ──
  {
    id: 'books', name: 'Book stack', slot: 'desk', rarity: 'common', blurb: 'To be read. Eventually.',
    svg: `<g>
      <rect class="ink" x="-44" y="-18" width="88" height="18" rx="3" fill="#4f7591"/>
      <rect class="ink" x="-38" y="-34" width="78" height="16" rx="3" fill="#d9a441"/>
      <rect class="ink" x="-42" y="-52" width="80" height="18" rx="3" fill="#9a4f45"/>
      <path d="M -36 -9 L 34 -9 M -30 -26 L 32 -26 M -34 -43 L 30 -43" stroke="#fff" stroke-width="2" opacity=".35"/></g>`,
  },
  {
    id: 'succulent', name: 'Succulent', slot: 'desk', rarity: 'common', blurb: 'Thrives on neglect and good vibes.',
    svg: `<g>
      <path class="ink" d="M -26 0 L -30 -34 L 30 -34 L 26 0 Z" fill="#e3c9a4"/>
      ${[[-20, -48, -40], [20, -48, 40], [-8, -58, -12], [8, -58, 12], [0, -64, 0], [-24, -40, -60], [24, -40, 60]].map(([x, y, r]) => `<ellipse class="ink" cx="${x}" cy="${y}" rx="9" ry="17" fill="#7fb38b" transform="rotate(${r} ${x} ${y})"/>`).join('')}</g>`,
  },
  {
    id: 'duck', name: 'Rubber duck', slot: 'desk', rarity: 'common', blurb: 'Explain your problem to the duck.',
    svg: `<g>
      <path class="ink" d="M -30 0 C -36 -24 -10 -30 6 -24 C 20 -20 30 -14 30 -4 L 28 0 Z" fill="#f2cb47"/>
      <circle class="ink" cx="14" cy="-38" r="16" fill="#f2cb47"/>
      <path class="ink" d="M 28 -38 L 42 -34 L 28 -30 Z" fill="#e88a3a"/>
      <circle cx="18" cy="-42" r="2.6" fill="#2a1f1a"/>
      <path d="M -20 -14 Q -8 -6 4 -14" stroke="#d9a930" stroke-width="3" fill="none"/></g>`,
  },
  {
    id: 'cupcake', name: 'Cupcake', slot: 'desk', rarity: 'common', blurb: 'A reward for the reward.',
    svg: `<g>
      <path class="ink" d="M -24 0 L -28 -28 L 28 -28 L 24 0 Z" fill="#d98a4e"/>
      <path d="M -14 -26 L -12 -2 M 0 -26 L 0 -2 M 14 -26 L 12 -2" stroke="#b8693a" stroke-width="2.5"/>
      <path class="ink" d="M -32 -28 C -36 -48 -14 -56 0 -52 C 14 -56 36 -48 32 -28 Z" fill="#f7d3dc"/>
      <circle class="ink" cy="-58" r="7" fill="#d9454f"/></g>`,
  },
  {
    id: 'cactus', name: 'Cactus', slot: 'desk', rarity: 'uncommon', blurb: 'Prickly outside, supportive inside.',
    svg: `<g>
      <path class="ink" d="M -24 0 L -28 -30 L 28 -30 L 24 0 Z" fill="#c8674a"/>
      <path class="ink" d="M -11 -30 L -11 -86 C -11 -98 11 -98 11 -86 L 11 -30 Z" fill="#6f9a74"/>
      <path class="ink" d="M 11 -54 L 22 -54 C 28 -54 28 -62 28 -66 L 28 -74 C 28 -80 36 -80 36 -74 L 36 -60 C 36 -50 30 -46 22 -46 L 11 -46 Z" fill="#6f9a74"/>
      <circle cx="0" cy="-98" r="6" fill="#f3a6b8"/></g>`,
  },
  {
    id: 'candle', name: 'Jar candle', slot: 'desk', rarity: 'uncommon', blurb: 'Smells like finished drafts.',
    svg: `<g>
      <path class="ink" d="M -20 0 L -22 -40 L 22 -40 L 20 0 Z" fill="#f3e3c3"/>
      <rect x="-22" y="-28" width="44" height="12" fill="#9a4f45" opacity=".8"/>
      <path d="M 0 -40 L 0 -48" stroke="#2a1f1a" stroke-width="2"/>
      <path class="flame" d="M 0 -64 Q 8 -54 0 -48 Q -8 -54 0 -64 Z" fill="#ffc46b"/>
      <circle class="glow-dot" cy="-55" r="22" fill="#ffd58a" opacity=".35"/></g>`,
  },
  {
    id: 'globe', name: 'Tiny globe', slot: 'desk', rarity: 'uncommon', blurb: 'Somewhere, someone is also focusing.',
    svg: `<g>
      <path class="ink" d="M -20 0 L 20 0 L 12 -8 L -12 -8 Z" fill="#6f4d36"/>
      <path d="M 0 -8 L 0 -18" stroke="#6f4d36" stroke-width="4"/>
      <circle class="ink" cy="-48" r="30" fill="#7fb3c9"/>
      <path d="M -18 -62 C -6 -66 2 -58 -4 -50 C -12 -44 -20 -50 -18 -62 Z M 6 -40 C 16 -44 22 -34 14 -28 C 8 -26 2 -34 6 -40 Z" fill="#7fb38b"/>
      <path class="ink" d="M -34 -50 C -36 -20 -6 -12 18 -20" fill="none" stroke="#b8862e" stroke-width="3"/></g>`,
  },
  {
    id: 'fishbowl', name: 'Goldfish bowl', slot: 'desk', rarity: 'rare', blurb: 'Your cat promises to only watch.',
    svg: `<g>
      <ellipse class="ink" cy="-36" rx="38" ry="34" fill="#cfe7f2" fill-opacity=".75"/>
      <path d="M -36 -30 Q 0 -22 36 -30 L 34 -16 Q 0 4 -34 -16 Z" fill="#7fb3c9" opacity=".5"/>
      <g class="fish"><path d="M -8 -34 C 0 -44 14 -42 16 -34 C 14 -26 0 -24 -8 -34 Z" fill="#f08a3a"/><path d="M -8 -34 L -18 -42 L -16 -26 Z" fill="#f08a3a"/><circle cx="10" cy="-36" r="1.8" fill="#2a1f1a"/></g>
      <path d="M -10 -14 q 4 -8 0 -14 M 18 -10 q 4 -8 0 -14" stroke="#5f8b6a" stroke-width="3" fill="none"/>
      <ellipse class="ink" cy="-68" rx="22" ry="5" fill="#e3f1f7"/></g>`,
  },
  {
    id: 'snowglobe', name: 'Snow globe', slot: 'desk', rarity: 'rare', blurb: 'Shake it when you need a reset.',
    svg: `<g>
      <path class="ink" d="M -30 0 L 30 0 L 24 -14 L -24 -14 Z" fill="#9a4f45"/>
      <circle class="ink" cy="-44" r="32" fill="#dceef6" fill-opacity=".8"/>
      <path class="ink" d="M -12 -24 L -12 -42 L 0 -54 L 12 -42 L 12 -24 Z" fill="#f3e3c3"/>
      <path d="M -14 -42 L 0 -56 L 14 -42" stroke="#c8674a" stroke-width="4" fill="none" stroke-linecap="round"/>
      <rect x="-4" y="-34" width="8" height="10" fill="#d9a441"/>
      <g class="flakes" fill="#fff">${[[-18, -58], [14, -64], [20, -40], [-22, -36], [4, -70], [-6, -62]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.2"/>`).join('')}</g></g>`,
  },
  {
    id: 'lavalamp', name: 'Lava lamp', slot: 'desk', rarity: 'rare', blurb: 'Hypnotic. Do not stare during focus.',
    svg: `<g>
      <path class="ink" d="M -18 0 L 18 0 L 12 -18 L -12 -18 Z" fill="#4f7591"/>
      <path class="ink" d="M -12 -18 L 12 -18 L 20 -78 C 16 -94 -16 -94 -20 -78 Z" fill="#f3b07a"/>
      <g class="blobs" fill="#d9454f"><ellipse cx="-4" cy="-34" rx="8" ry="10"/><ellipse cx="6" cy="-64" rx="7" ry="9"/></g>
      <path class="ink" d="M -14 -86 C -10 -100 10 -100 14 -86 Z" fill="#4f7591"/></g>`,
  },
];

export const itemById = (id) => ITEMS.find((i) => i.id === id);

/** Weighted draw that leans towards things you don't have yet. */
export function drawItem(owned = {}) {
  const total = Object.values(RARITY).reduce((s, r) => s + r.weight, 0);
  let roll = Math.random() * total;
  let rarity = 'common';
  for (const [k, r] of Object.entries(RARITY)) {
    if ((roll -= r.weight) < 0) {
      rarity = k;
      break;
    }
  }
  const pool = ITEMS.filter((i) => i.rarity === rarity);
  const fresh = pool.filter((i) => !owned[i.id]);
  const from = fresh.length && Math.random() < 0.75 ? fresh : pool;
  return from[Math.floor(Math.random() * from.length)];
}
