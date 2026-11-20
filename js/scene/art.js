// ─────────────────────────────────────────────────────────────────────────────
//  Your buddy at its desk, drawn freehand in a medieval woodcut manner.
//
//  Each beast is one traced drawing (made in tools/art-src) with moving layers:
//    possum  assets/art/possum-writing.svg   tail, static, head, writing-arm, resting-arm
//    cat     assets/art/cat-writing.svg      tail, static, head, arm
//  Every layer holds a .paint and an .ink group; the head also holds hidden
//  #lids for blinking and sleeping. Poses are classes on the .beast group (see
//  css/scene.css): focus (writing), brk, idle, away.
//  Cats can wear coats: the fur washes are repainted. The possum has one coat.
// ─────────────────────────────────────────────────────────────────────────────

const NS = 'http://www.w3.org/2000/svg';

const BEASTS = {
  possum: {
    url: new URL('../../assets/art/possum-writing.svg', import.meta.url),
    viewBox: '110 60 860 950',
    face: '334 90 244 244',
    preview: '326 76 268 268',
  },
  cat: {
    url: new URL('../../assets/art/cat-writing.svg', import.meta.url),
    viewBox: '110 50 840 930',
    face: '348 78 268 268',
    preview: '340 70 284 284',
    coats: true,
  },
};
const beastOf = (id) => BEASTS[id] || BEASTS.possum;

// The cat drawing's own washes, and what each coat paints them with: [fur, dark fur, cream].
const WASHES = [[205, 143, 64], [176, 114, 50], [237, 220, 187]];
export const COATS = {
  ginger: ['#CD8F40', '#B07232', '#EDDCBB'],
  tuxedo: ['#45404A', '#353139', '#F4EEE4'],
  midnight: ['#38333D', '#2A262E', '#4E4855'],
  silver: ['#BBB7BE', '#908B95', '#F0EEF1'],
  calico: ['#F3ECE1', '#D9934E', '#FBF7F0'],
  snow: ['#F4F0EA', '#DCD5CB', '#FFFFFF'],
  siamese: ['#EEE3D2', '#7A604F', '#F8F1E6'],
  blue: ['#8F99A9', '#727C8C', '#B3BBC7'],
  cocoa: ['#9B775D', '#76563F', '#ECDDCC'],
};

// Drawings are fetched once, when first needed.
const drawings = new Map();
function load(id) {
  const key = BEASTS[id] ? id : 'possum';
  if (!drawings.has(key)) {
    drawings.set(key, fetch(beastOf(key).url)
      .then((r) => r.text())
      .then((text) => new DOMParser().parseFromString(text, 'image/svg+xml').documentElement));
  }
  return drawings.get(key);
}

const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

/** Repaint a cat's fur, dark fur and cream washes for a coat (in place). */
function recolour(root, coatId) {
  const coat = COATS[coatId] || COATS.ginger;
  if (coat === COATS.ginger) return root;
  for (const node of root.querySelectorAll('[fill]')) {
    const fill = node.getAttribute('fill');
    if (!/^#[0-9a-f]{6}$/i.test(fill)) continue;
    const c = rgb(fill);
    let best = -1;
    let bestDist = 22 * 22;
    WASHES.forEach((w, i) => {
      const d = (c[0] - w[0]) ** 2 + (c[1] - w[1]) ** 2 + (c[2] - w[2]) ** 2;
      if (d < bestDist) { bestDist = d; best = i; }
    });
    if (best >= 0) node.setAttribute('fill', coat[best]);
  }
  return root;
}

// ── Mounting ─────────────────────────────────────────────────────────────────
export function mount(svg) {
  svg.setAttribute('preserveAspectRatio', 'xMidYMax meet');
  svg.classList.add('art');
  let beast = null;
  let coat = null;
  let pose = 'idle';
  let group = null;
  let token = 0;

  async function draw() {
    const mine = ++token;
    const drawing = await load(beast);
    if (mine !== token) return;
    const g = document.createElementNS(NS, 'g');
    for (const child of drawing.children) g.append(document.importNode(child, true));
    if (beastOf(beast).coats) recolour(g, coat);
    group = g;
    group.setAttribute('class', `beast ${beast} ${pose}`);
    svg.setAttribute('viewBox', beastOf(beast).viewBox);
    svg.dataset.beast = beast;
    svg.replaceChildren(g);
    svg.dispatchEvent(new Event('art:drawn'));
  }

  function setBeast({ beast: nextBeast = 'possum', coat: nextCoat, pose: nextPose }) {
    pose = nextPose;
    if (group) group.setAttribute('class', `beast ${beast} ${pose}`);
    const coatMatters = beastOf(nextBeast).coats;
    if (nextBeast !== beast || (coatMatters && nextCoat !== coat)) {
      beast = nextBeast;
      coat = nextCoat;
      draw();
    }
  }

  /** Time of day dims the page a little in the evening (see css/scene.css). */
  function ambience({ time, weather }) {
    const host = svg.parentElement;
    if (!host) return;
    host.dataset.time = time;
    host.dataset.weather = weather;
  }

  /** Where the head is on screen (for the speech bubble and petting). */
  function headBox() {
    const head = svg.querySelector('#head');
    return head ? head.getBoundingClientRect() : null;
  }

  return { setBeast, ambience, headBox };
}

// ── Faces for friend lists and the buddy picker ──────────────────────────────
// The possum's face is the drawing itself, framed (an <image>, so it costs
// nothing extra); a cat's is its head, repainted for its coat.
function headSvg(beastId, coatId, box, cls) {
  const b = beastOf(beastId);
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', b[box]);
  svg.setAttribute('class', cls);
  svg.setAttribute('aria-hidden', 'true');
  if (!b.coats) {
    const img = document.createElementNS(NS, 'image');
    img.setAttribute('href', b.url.href);
    img.setAttribute('width', '1024');
    img.setAttribute('height', '1024');
    svg.append(img);
    return svg;
  }
  load(beastId).then((drawing) => {
    const head = document.importNode(drawing.querySelector('#head'), true);
    head.removeAttribute('id');
    head.querySelector('#lids')?.remove();
    svg.append(recolour(head, coatId));
  });
  return svg;
}

/** Little face for friend lists. */
export function face(beastId, coatId, { size = 36 } = {}) {
  const svg = headSvg(beastId, coatId, 'face', `beast-face ${BEASTS[beastId] ? beastId : 'possum'}`);
  svg.setAttribute('width', size);
  svg.setAttribute('height', size);
  return svg;
}

/** Bigger head for the buddy picker. */
export const preview = (beastId, coatId) => headSvg(beastId, coatId, 'preview', 'beast-preview');
