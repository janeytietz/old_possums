"""Split an AI draft into two layers per moving part, for a drawn (not poster-flat) trace.

    python3 tools/art-src/layers.py [drawn|bold|fine]

  paint: the draft's own colours with the ink lifted out and filled from the
         neighbours, gently smoothed and reduced to ~20 tones, so shading and
         blended fur survive the trace.
  ink:   just the dark linework, black on white, traced separately at high
         fidelity and laid on top.

Writes tools/art-src/layers[-variant]/{paint,ink}-{static,head,arm,tail}.png for
trace-layers.jsx. The polygons match split.py so animation pivots stay the same.

Variants only change the ink: "drawn" is the middle, "bold" is thicker and
wobblier, "fine" is thinner and drops the smallest fur flecks.
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage

HERE = Path(__file__).parent
SRC = HERE / 'cat-desk-writing-v2-color.jpg'
VARIANT = sys.argv[1] if len(sys.argv) > 1 else 'drawn'
INK_STYLE = {
    # wobble: pen wobble in px; pressure: thick-and-thin; base: lower = thicker lines;
    # sigma: softness before re-thresholding; min_area: drop ink flecks smaller than this
    'drawn': dict(wobble=1.8, pressure=0.12, base=0.50, sigma=0.9, min_area=0),
    'bold': dict(wobble=3.0, pressure=0.20, base=0.36, sigma=1.3, min_area=0),
    'fine': dict(wobble=1.2, pressure=0.08, base=0.62, sigma=0.7, min_area=30),
    # Less "AI" looking: thin: drop this share of small strokes, in uneven patches;
    # washes: a few flat hand-coloured washes instead of smooth shading;
    # wonk: bend everything a few px, as if drawn without a ruler.
    'fewer': dict(wobble=1.8, pressure=0.12, base=0.50, sigma=0.9, min_area=0, thin=0.7),
    'washes': dict(wobble=1.8, pressure=0.12, base=0.50, sigma=0.9, min_area=0, thin=0.7, washes=True),
    'freehand': dict(wobble=2.2, pressure=0.14, base=0.48, sigma=0.9, min_area=0, thin=0.7, washes=True, wonk=10),
    # Calmer freehand: one fur wash (dark only in the tail stripes), colour kept
    # inside the outline, more strokes left out, and bare wood on the furniture.
    'calm': dict(wobble=2.2, pressure=0.14, base=0.48, sigma=0.9, min_area=0, thin=0.85, washes=True, wonk=10,
                 flat_fur=True, tight=True, bare_wood=True),
}[VARIANT]
OUT = HERE / ('layers' if VARIANT == 'drawn' else f'layers-{VARIANT}')
OUT.mkdir(exist_ok=True)
PAPER = np.array([241, 233, 216], dtype=np.float32)
WHITE = np.array([255, 255, 255], dtype=np.uint8)
TONES = 20

# Same cut lines as split.py.
PARTS = {
    'head': [(355, 92), (585, 86), (604, 170), (606, 245), (594, 300), (588, 338), (520, 342),
             (470, 338), (430, 328), (356, 326), (350, 270)],
    'arm': [(252, 248), (302, 246), (346, 326), (382, 412), (430, 396), (500, 374), (532, 382),
            (544, 418), (522, 446), (470, 462), (420, 474), (398, 500), (382, 514), (352, 516),
            (318, 498), (306, 448)],
    'tail': [(786, 612), (852, 626), (904, 700), (910, 800), (884, 884), (832, 934), (740, 940),
             (676, 908), (672, 858), (702, 850), (760, 878), (806, 872), (816, 840), (824, 780),
             (816, 720), (796, 680), (778, 650)],
}
PLUGGED = ('head', 'arm')

src = np.asarray(Image.open(SRC).convert('RGB').resize((1024, 1024))).astype(np.float32)

# Extra randomness for the less-AI knobs lives on its own generator, so the other
# variants stay exactly as they were.
rs2 = np.random.default_rng(11)
yy, xx = np.mgrid[0:1024, 0:1024].astype(np.float32)


def field2(cells, amp):
    f = ndimage.zoom(rs2.standard_normal((cells, cells)).astype(np.float32), 1024 / cells, order=3)[:1024, :1024]
    return f / (np.abs(f).max() + 1e-6) * amp


if INK_STYLE.get('wonk'):
    w = INK_STYLE['wonk']
    dy, dx = field2(5, w), field2(5, w)
    src = np.stack([ndimage.map_coordinates(src[..., c], [yy + dy, xx + dx], order=1, mode='nearest') for c in range(3)], -1)
    # The bend moves the eyes a few px; record where, so the blink lids still fit.
    lids = []
    for cx, cy, rx, ry in [(423, 244, 21, 15), (508, 242, 29, 16)]:
        px, py = float(cx), float(cy)
        for _ in range(6):
            px, py = cx - dx[int(py), int(px)], cy - dy[int(py), int(px)]
        lids.append(f'{px:.1f} {py:.1f} {rx} {ry}')
    (OUT / 'lids.txt').write_text('\n'.join(lids) + '\n')

# Ink: dark and nearly grey, so red ears and the blue ink pot stay paint.
lum = src @ np.array([0.299, 0.587, 0.114], dtype=np.float32)
chroma = src.max(-1) - src.min(-1)
ink = np.asarray(Image.fromarray((((lum < 105) & (chroma < 50)) * 255).astype(np.uint8)).filter(ImageFilter.ModeFilter(3))) > 0


def fill_under(img, hole, iters=14):
    """Fill masked pixels from their unmasked neighbours, growing inward."""
    img = img.copy()
    known = ~hole
    for _ in range(iters):
        if known.all():
            break
        acc = np.zeros_like(img)
        cnt = np.zeros(hole.shape, np.float32)
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (1, -1), (-1, 1), (-1, -1)):
            k = np.roll(known, (dy, dx), (0, 1))
            acc += np.roll(img, (dy, dx), (0, 1)) * k[..., None]
            cnt += k
        grow = ~known & (cnt > 0)
        img[grow] = acc[grow] / cnt[grow][:, None]
        known |= grow
    return img


paint = fill_under(src, ink)
paint = np.asarray(Image.fromarray(paint.clip(0, 255).astype(np.uint8)).filter(ImageFilter.MedianFilter(5)))
q = Image.fromarray(paint).quantize(colors=TONES, method=Image.Quantize.MEDIANCUT, kmeans=4, dither=Image.Dither.NONE)
idx = np.asarray(q.filter(ImageFilter.ModeFilter(3)))
pal = np.array(q.getpalette()[: TONES * 3], dtype=np.uint8).reshape(-1, 3)
smooth = paint.astype(np.int16)
paint = pal[idx]
# Small bright accents (red ears, book edges) get merged into brown when tones are
# reduced, so give them back their own colour.
red = (smooth[..., 0] > 140) & (smooth[..., 0] - smooth[..., 1] > 85) & (smooth[..., 0] - smooth[..., 2] > 95)
if red.any():
    paint[red] = np.median(smooth[red], axis=0).astype(np.uint8)
paper = (((paint.astype(np.float32) - PAPER) ** 2).sum(-1) < 22 ** 2)
# Only real background counts as paper: areas touching the edge, or big enclosed
# gaps (between stool rungs). Small paper-coloured islands are eye whites and pages.
labels, n = ndimage.label(paper)
sizes = ndimage.sum(paper, labels, range(1, n + 1))
edge = set(np.unique(np.concatenate([labels[0], labels[-1], labels[:, 0], labels[:, -1]]))) - {0}
keep = np.zeros(n + 1, bool)
for i, s in enumerate(sizes, start=1):
    keep[i] = i in edge or s > 2500
paper = keep[labels]
paint[paper] = WHITE

def _poly_mask(poly):
    m = Image.new('L', (1024, 1024), 0)
    ImageDraw.Draw(m).polygon(poly, fill=255)
    return np.asarray(m) > 0


if INK_STYLE.get('washes'):
    # A handful of flat washes, the way a print was coloured by hand. Fur gets two:
    # a light wash and a darker one laid in a few broad, uneven patches.
    FAM = ['fur', 'fur_dark', 'cream', 'red', 'green', 'green_dark', 'blue', 'brown', 'page', 'grey', 'grey_dark']
    ANCHOR = np.array([(196, 134, 52), (163, 111, 52), (233, 214, 178), (192, 58, 34), (110, 146, 121),
                       (80, 115, 95), (52, 79, 118), (120, 82, 44), (244, 236, 214), (205, 200, 190),
                       (140, 136, 126)], np.float32)
    WASH = np.array([(206, 144, 64), (176, 114, 50), (238, 221, 188), (188, 66, 42), (118, 150, 124),
                     (118, 150, 124), (60, 86, 126), (136, 94, 54), (246, 239, 221), (216, 208, 192),
                     (216, 208, 192)], np.uint8)
    dist2 = ((paint.astype(np.float32)[:, :, None, :] - ANCHOR[None, None]) ** 2).sum(-1)
    dist2[:470, :, [4, 5]] = np.inf  # green belongs to the desk only
    fam = dist2.argmin(-1)
    # One wash per area: merge specks into whatever surrounds them.
    fam = np.asarray(Image.fromarray(fam.astype(np.uint8)).filter(ImageFilter.ModeFilter(7))).astype(int)
    furry_all = np.isin(fam, [0, 1]) & ~paper
    dark = ndimage.gaussian_filter(((fam == 1) & furry_all).astype(np.float32), 7) > 0.42
    if INK_STYLE.get('flat_fur'):
        # One fur colour; the darker wash only for the bands on the tail.
        tail_m = _poly_mask(PARTS['tail'])
        dark = (ndimage.gaussian_filter(((fam == 1) & furry_all).astype(np.float32), 3) > 0.5) & tail_m
    fam[furry_all] = np.where(dark[furry_all], 1, 0)
    # Brown is only the stool. Brown elsewhere is dark fur (tail stripes, shading),
    # which coats need to repaint.
    stool = np.asarray(_poly_mask([(560, 660), (810, 660), (812, 930), (556, 930)])) & ~_poly_mask(PARTS['tail'])
    stray_brown = (fam == 7) & ~stool
    fam[stray_brown] = np.where(_poly_mask(PARTS['tail'])[stray_brown], 1, 0) if INK_STYLE.get('flat_fur') else 1
    # Grey is only the quill. Elsewhere grey pixels are the soft halo around ink
    # outlines: send them to the background so no pale rim shows past the lines.
    quill = np.zeros(paper.shape, bool)
    quill[230:530, 240:400] = True
    paper = paper | (np.isin(fam, [9, 10]) & ~quill)
    washed = WASH[fam]
    washed[paper] = WHITE
    paint = washed
    furniture = ndimage.binary_dilation(np.isin(fam, [4, 5, 7]), iterations=4)

# ── Hand-drawn feel, baked into the pixels before tracing (no live filters) ──
# Ink gets a gentle pen wobble and thick-and-thin; the colour is laid on a little
# loosely and off the line, like a hand-coloured print.
LOOSE, OFFSET = (0.8, (0.5, 0.4)) if INK_STYLE.get('tight') else (2.6, (1.6, 1.1))
st = INK_STYLE
silhouette = ~paper  # where there is any colour at all, before it is shifted
rs = np.random.default_rng(7)


def field(cells, amp):
    f = ndimage.zoom(rs.standard_normal((cells, cells)).astype(np.float32), 1024 / cells, order=3)[:1024, :1024]
    return f / (np.abs(f).max() + 1e-6) * amp


soft = ndimage.gaussian_filter(ink.astype(np.float32), st['sigma'])
soft = ndimage.map_coordinates(soft, [yy + field(22, st['wobble']), xx + field(22, st['wobble'])], order=1, mode='nearest')
ink = soft > st['base'] + field(9, st['pressure'])
if st['min_area']:
    lab, n = ndimage.label(ink)
    area = ndimage.sum(ink, lab, range(1, n + 1))
    ink = np.concatenate([[False], area >= st['min_area']])[lab]
if st.get('bare_wood'):
    # Furniture keeps only its thick outline strokes; thin grain lines go.
    disk = np.hypot(*np.mgrid[-2:3, -2:3]) <= 2.2
    thick = ndimage.binary_opening(ink, structure=disk)
    ink = np.where(furniture, thick, ink)
if st.get('thin'):
    # Leave some areas bare: drop small strokes, more in some patches than others.
    # Outlines, long lines (whiskers) and the face stay as drawn.
    lab, n = ndimage.label(ink)
    idxs = range(1, n + 1)
    area = ndimage.sum(ink, lab, idxs)
    com = ndimage.center_of_mass(ink, lab, idxs)
    patch = field2(6, 0.45)
    keep = np.ones(n + 1, bool)
    for i, (a, (cy, cx)) in enumerate(zip(area, com), start=1):
        # keep outlines (big), and the face and whiskers as drawn (by position)
        if ((cx - 465) / 150) ** 2 + ((cy - 262) / 72) ** 2 < 1:
            continue
        on_wood = st.get('bare_wood') and furniture[int(cy), int(cx)]
        if a > (900 if on_wood else 320):
            continue
        p = 0.8 if on_wood else st['thin'] + patch[int(cy), int(cx)]
        keep[i] = rs2.random() > np.clip(p, 0, 0.95)
    keep[0] = False
    ink = keep[lab]

sy = np.clip(np.rint(yy - field(12, LOOSE) - OFFSET[1]), 0, 1023).astype(int)
sx = np.clip(np.rint(xx - field(12, LOOSE) - OFFSET[0]), 0, 1023).astype(int)
paint = paint[sy, sx]
if st.get('tight'):
    paint[~silhouette] = WHITE  # never spill past the outline
paper = (paint == WHITE).all(-1)

if st.get('tight'):
    # Only the real background stays see-through, so a dark backdrop (the bestiary's
    # blue) never shows through pages, chest or the slivers inside an outline.
    # Background = paper reachable from the edge without crossing ink, plus the big
    # gaps between stool rungs and desk legs. Everything else gets a paper wash.
    open_paper = paper & ~ndimage.binary_dilation(ink, iterations=1)
    lab, n = ndimage.label(open_paper)
    idxs = range(1, n + 1)
    edge_ids = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    see_through = np.zeros(n + 1, bool)
    for i, (size, (cy, cx)) in enumerate(zip(ndimage.sum(open_paper, lab, idxs), ndimage.center_of_mass(open_paper, lab, idxs)), 1):
        see_through[i] = i in edge_ids or (cy > 640 and size > 800)
    # Gaps specific to this drawing that are enclosed but are really background
    # (between the writing arm and the body).
    for sx_, sy_ in [(487, 463)]:
        if lab[sy_, sx_]:
            see_through[lab[sy_, sx_]] = True
    background = ndimage.binary_dilation(see_through[lab], iterations=2) & paper
    paint[paper & ~background] = (246, 239, 221)
    paper = (paint == WHITE).all(-1)
ink_img = np.where(ink[..., None], np.uint8(0), WHITE).astype(np.uint8)


def mask(poly):
    m = Image.new('L', (1024, 1024), 0)
    ImageDraw.Draw(m).polygon(poly, fill=255)
    return np.asarray(m) > 0


# A fur plug under the moving head and arm so a moved part never shows a hole.
furry = (~paper) & (paint[..., 0] > 150) & (paint[..., 0] < 225) & (paint[..., 2] < 110)
fur = np.median(paint[furry], axis=0).astype(np.uint8) if furry.any() else np.array([196, 134, 52], np.uint8)

static_paint, static_ink = paint.copy(), ink_img.copy()
for name, poly in PARTS.items():
    m = mask(poly)
    # Each moving part reaches 3px past its cut line so it overlaps the still
    # layer: no hairline seam at rest, and nothing opens up when it moves.
    grown = ndimage.binary_dilation(m, iterations=3)
    Image.fromarray(np.where(grown[..., None], paint, WHITE).astype(np.uint8)).save(OUT / f'paint-{name}.png')
    Image.fromarray(np.where(grown[..., None], ink_img, WHITE).astype(np.uint8)).save(OUT / f'ink-{name}.png')
    static_paint[m] = WHITE
    static_ink[m] = WHITE
    if name in PLUGGED:
        solid = np.asarray(Image.fromarray(((m & ~paper) * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(9))) > 0
        static_paint[solid] = fur
Image.fromarray(static_paint).save(OUT / 'paint-static.png')
Image.fromarray(static_ink).save(OUT / 'ink-static.png')
(OUT / 'fur.txt').write_text('#%02X%02X%02X\n' % tuple(fur))
print('wrote', sorted(p.name for p in OUT.iterdir()), 'fur', '#%02X%02X%02X' % tuple(fur))
