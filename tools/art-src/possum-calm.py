"""Calm trace layers for the possum (the default buddy), matching the calm cat.

    python3 tools/art-src/possum-calm.py

Same idea as `layers.py calm`, tuned for the possum drawing
(tools/art-src/possum-writing-source.jpg):

  paint: a handful of flat washes kept inside the lines: one grey-brown fur,
         cream face, pink skin, sage desk, brown stool, blue ink pot, red book
         edge, ochre quill tip. Each colour may only appear where it belongs,
         so no stray green on the fur or pink on the desk.
  ink:   near-black linework only (the possum's fur is ~110 bright and its
         dashes ~10-40, so the cat's cut-off of 105 would turn fur into ink).
         Face, ears, hands and feet keep every line; the dense fur dashes are
         thinned, more inside the body than along its edge; furniture keeps only
         its thick strokes; and a drawn outline goes round the whole figure,
         because the possum's own edge is a fringe of dashes, not a line.

Writes tools/art-src/layers-possum-calm/{paint,ink}-{static,head,writing-arm,
resting-arm,tail}.png for trace-layers.jsx, plus fur.txt, lids.txt and a
preview.png to check before tracing.
"""
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage

HERE = Path(__file__).parent
SRC = HERE / 'possum-writing-source.jpg'
OUT = HERE / 'layers-possum-calm'
OUT.mkdir(exist_ok=True)
WHITE = np.array([255, 255, 255], np.uint8)
PAPER = np.array([233, 225, 208], np.float32)
PAPER_WASH = (246, 239, 221)
TONES = 20
INK_CUT = 58

# Same cut lines as possum-layers.py, so tools/possum-motion.html pivots still fit.
PARTS = {
    'head': [(338, 78), (548, 70), (590, 128), (586, 215), (548, 302), (510, 360), (452, 398), (372, 420),
             (332, 378), (330, 246)],
    'writing-arm': [(185, 228), (238, 235), (280, 378), (326, 432), (382, 424), (454, 398), (520, 388),
                    (534, 438), (494, 473), (414, 478), (350, 500), (294, 492), (278, 438), (230, 350)],
    'resting-arm': [(375, 468), (460, 444), (548, 456), (644, 486), (658, 526), (622, 562), (548, 574),
                    (466, 556), (390, 542), (362, 508)],
    'tail': [(850, 614), (910, 640), (958, 704), (980, 790), (958, 860), (904, 900), (800, 926), (682, 944),
             (566, 990), (538, 962), (566, 926), (684, 900), (800, 884), (882, 840), (904, 780), (892, 710),
             (854, 660)],
}
PLUGGED = ('head', 'writing-arm', 'resting-arm')
# Eyes as measured on the source: centre x, y and radii, a little larger than the
# black bead so a blink covers the white glint too.
EYES = [(372.9, 260.3, 14, 21), (455.3, 256.8, 25, 27)]


def poly_mask(poly):
    m = Image.new('L', (1024, 1024), 0)
    ImageDraw.Draw(m).polygon(poly, fill=255)
    return np.asarray(m) > 0


def box_mask(x0, y0, x1, y1):
    m = np.zeros((1024, 1024), bool)
    m[y0:y1, x0:x1] = True
    return m


def ellipse_mask(cx, cy, rx, ry):
    return ((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2 < 1


yy, xx = np.mgrid[0:1024, 0:1024].astype(np.float32)
rs = np.random.default_rng(7)
rs2 = np.random.default_rng(11)


def field(gen, cells, amp):
    f = ndimage.zoom(gen.standard_normal((cells, cells)).astype(np.float32), 1024 / cells, order=3)[:1024, :1024]
    return f / (np.abs(f).max() + 1e-6) * amp


src = np.asarray(Image.open(SRC).convert('RGB').resize((1024, 1024))).astype(np.float32)

# A gentle bend over the whole drawing, as if drawn without a ruler. Record where
# the eyes end up so the blink lids still fit.
dy, dx = field(rs2, 5, 10), field(rs2, 5, 10)
src = np.stack([ndimage.map_coordinates(src[..., c], [yy + dy, xx + dx], order=1, mode='nearest') for c in range(3)], -1)
lids = []
for cx, cy, rx, ry in EYES:
    px, py = cx, cy
    for _ in range(6):
        px, py = cx - dx[int(py), int(px)], cy - dy[int(py), int(px)]
    lids.append(f'{px:.1f} {py:.1f} {rx} {ry}')
(OUT / 'lids.txt').write_text('\n'.join(lids) + '\n')

lum = src @ np.array([0.299, 0.587, 0.114], np.float32)
chroma = src.max(-1) - src.min(-1)
ink = np.asarray(Image.fromarray((((lum < INK_CUT) & (chroma < 50)) * 255).astype(np.uint8))
                 .filter(ImageFilter.ModeFilter(3))) > 0


def fill_under(img, hole, iters=20):
    """Fill masked pixels from their unmasked neighbours, growing inward."""
    img = img.copy()
    known = ~hole
    for _ in range(iters):
        if known.all():
            break
        acc = np.zeros_like(img)
        cnt = np.zeros(hole.shape, np.float32)
        for oy, ox in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (1, -1), (-1, 1), (-1, -1)):
            k = np.roll(known, (oy, ox), (0, 1))
            acc += np.roll(img, (oy, ox), (0, 1)) * k[..., None]
            cnt += k
        grow = ~known & (cnt > 0)
        img[grow] = acc[grow] / cnt[grow][:, None]
        known |= grow
    return img


paint = fill_under(src, ndimage.binary_dilation(ink, iterations=1))
paint = np.asarray(Image.fromarray(paint.clip(0, 255).astype(np.uint8)).filter(ImageFilter.MedianFilter(7)))
q = Image.fromarray(paint).quantize(colors=TONES, method=Image.Quantize.MEDIANCUT, kmeans=4, dither=Image.Dither.NONE)
pal = np.array(q.getpalette()[: TONES * 3], np.uint8).reshape(-1, 3)
smooth = paint.astype(np.int16)
paint = pal[np.asarray(q.filter(ImageFilter.ModeFilter(3)))]
# Small saturated accents get merged away when tones are reduced: give them back.
red = (smooth[..., 0] > 130) & (smooth[..., 0] - smooth[..., 1] > 85) & (smooth[..., 0] - smooth[..., 2] > 100)
blue = (smooth[..., 2] - smooth[..., 0] > 35) & (smooth[..., 2] > 70)
for m in (red, blue):
    if m.any():
        paint[m] = np.median(smooth[m], axis=0).astype(np.uint8)

# Where each colour belongs.
head_m = poly_mask(PARTS['head'])
desk_m = box_mask(108, 478, 558, 968)
stool_m = poly_mask([(594, 684), (824, 684), (824, 908), (594, 908)])
quill_tip = box_mask(192, 226, 302, 350)
quill_m = poly_mask([(196, 234), (228, 230), (264, 270), (302, 338), (318, 410), (332, 522), (312, 526),
                     (294, 432), (264, 372), (230, 320), (202, 272)])
pot_m = box_mask(148, 422, 248, 522)
book_m = box_mask(186, 478, 512, 634)

# Background: paper-coloured areas touching the edge, big enclosed ones, and the
# enclosed gaps (between the arms, by the stool), but not pages, teeth, eye
# glints or the pale quill.
paper = ((paint.astype(np.float32) - PAPER) ** 2).sum(-1) < 22 ** 2
labels, n = ndimage.label(paper)
idxs = range(1, n + 1)
sizes = ndimage.sum(paper, labels, idxs)
coms = ndimage.center_of_mass(paper, labels, idxs)
edge = set(np.unique(np.concatenate([labels[0], labels[-1], labels[:, 0], labels[:, -1]]))) - {0}
keep = np.zeros(n + 1, bool)
for i, (s, (cy, cx)) in enumerate(zip(sizes, coms), start=1):
    y, x = int(cy), int(cx)
    keep[i] = i in edge or s > 2500 or (s > 250 and not (book_m[y, x] or head_m[y, x] or quill_m[y, x]))
paper = keep[labels]

# ── Washes: each family has an anchor (what it looks like in the draft), the flat
# wash it becomes, and where it is allowed to appear.
FUR = (134, 119, 105)
FAMILIES = [
    # name, anchor, wash, allowed region (None = anywhere)
    ('fur', (120, 106, 94), FUR, None),
    ('fur_light', (138, 121, 106), FUR, None),
    ('fur_dark', (75, 74, 73), FUR, None),
    ('cream', (215, 182, 149), (230, 203, 168), head_m),
    ('pink', (193, 120, 98), (212, 134, 110), None),
    ('pink_dark', (150, 92, 78), (212, 134, 110), None),
    ('green', (98, 120, 104), (112, 138, 118), desk_m),
    ('green_dark', (81, 100, 86), (112, 138, 118), desk_m),
    ('brown', (133, 88, 56), (146, 98, 60), stool_m),
    ('ochre', (183, 120, 56), (196, 136, 66), quill_tip),
    ('page', (220, 207, 192), (243, 234, 214), None),
    ('page_shade', (210, 189, 166), (243, 234, 214), ~head_m),
    ('red', (175, 70, 50), (178, 72, 50), book_m),
    ('blue', (45, 70, 120), (56, 82, 138), pot_m),
    ('quill', (171, 146, 127), (216, 206, 190), quill_m),
]
ANCHOR = np.array([f[1] for f in FAMILIES], np.float32)
WASH = np.array([f[2] for f in FAMILIES], np.uint8)
dist2 = ((paint.astype(np.float32)[:, :, None, :] - ANCHOR[None, None]) ** 2).sum(-1)
for k, (_, _, _, region) in enumerate(FAMILIES):
    if region is not None:
        dist2[~region, k] = np.inf
# The desk's shaded side is as dark as the fur: tell them apart by hue. Green
# only where the draft leans green, fur only where it doesn't.
greenish = ndimage.uniform_filter((smooth[..., 1] - smooth[..., 0]).astype(np.float32), 5) > 6
for k, (nm, *_rest) in enumerate(FAMILIES):
    if nm.startswith('green'):
        dist2[~greenish, k] = np.inf
    elif nm.startswith('fur'):
        dist2[greenish & desk_m, k] = np.inf
# The quill tip is ochre, not skin.
for nm in ('pink', 'pink_dark', 'red'):
    dist2[quill_tip, [f[0] for f in FAMILIES].index(nm)] = np.inf
fam = dist2.argmin(-1)
# One wash per area: merge specks into whatever surrounds them.
fam = np.asarray(Image.fromarray(fam.astype(np.uint8)).filter(ImageFilter.ModeFilter(7))).astype(int)
# The whiskers were too faint to be ink and break into dashes of colour: drop them.
paper |= box_mask(296, 300, 356, 378) & ~head_m & ~ndimage.binary_dilation(quill_m, iterations=5)
washed = WASH[fam]
washed[paper] = WHITE
paint = washed
name_of = [f[0] for f in FAMILIES]
furniture = ndimage.binary_dilation(np.isin(fam, [name_of.index(n) for n in ('green', 'green_dark', 'brown')]) & ~paper,
                                    iterations=4)
pink = np.isin(fam, [name_of.index('pink'), name_of.index('pink_dark')]) & ~paper

# ── Ink: pen wobble and thick-and-thin, then fewer fur strokes.
soft = ndimage.gaussian_filter(ink.astype(np.float32), 0.9)
soft = ndimage.map_coordinates(soft, [yy + field(rs, 22, 2.2), xx + field(rs, 22, 2.2)], order=1, mode='nearest')
ink = soft > 0.48 + field(rs, 9, 0.14)

disk = np.hypot(*np.mgrid[-2:3, -2:3]) <= 2.2
ink = np.where(furniture, ndimage.binary_opening(ink, structure=disk) | (ink & ~furniture), ink)

# Lines kept exactly as drawn: the face (eyes, grin, nose, whiskers), the ears,
# and the hands and feet (claws).
protect = (ellipse_mask(372, 260, 34, 36) | ellipse_mask(455, 257, 46, 44) | ellipse_mask(352, 386, 24, 22)
           | poly_mask([(372, 334), (470, 292), (496, 316), (474, 352), (420, 384), (370, 402), (346, 382)])
           | ellipse_mask(376, 126, 40, 44) | ellipse_mask(556, 118, 44, 46)
           | box_mask(272, 432, 358, 508) | box_mask(378, 498, 474, 562)
           | box_mask(428, 826, 594, 948) | box_mask(326, 752, 424, 848))
# Distance into the figure: fur dashes near the edge are kept more often, so the
# possum still looks furry, while the middle of the body goes quiet.
figure = ~paper
whiskers = box_mask(282, 306, 352, 374)
depth = ndimage.distance_transform_edt(figure)
patch = field(rs2, 6, 0.3)
lab, n = ndimage.label(ink)
idxs = range(1, n + 1)
area = ndimage.sum(ink, lab, idxs)
com = ndimage.center_of_mass(ink, lab, idxs)
keep = np.ones(n + 1, bool)
for i, (a, (cy, cx)) in enumerate(zip(area, com), start=1):
    y, x = int(cy), int(cx)
    if protect[y, x]:
        continue
    if furniture[y, x]:
        keep[i] = a > 900 or rs2.random() > 0.8
        continue
    if a > 420:  # long outlines
        continue
    if whiskers[y, x]:
        keep[i] = False  # broken whiskers
        continue
    if not figure[y, x]:
        keep[i] = rs2.random() > 0.97  # specks out on the paper
        continue
    if pink[y, x]:
        p = 0.7  # rings on the tail
    elif depth[y, x] < 16:
        p = 0.55  # the furry edge
    else:
        p = 0.9 + patch[y, x]
    keep[i] = rs2.random() > np.clip(p, 0, 0.97)
keep[0] = False
ink = keep[lab]

# A drawn outline round the figure, wobbling like the rest of the pen work.
sil = ndimage.binary_opening(figure, iterations=2)
sil = ndimage.binary_closing(sil, iterations=3)
rim = sil & ~ndimage.binary_erosion(sil, iterations=3)
rim = ndimage.map_coordinates(rim.astype(np.float32), [yy + field(rs, 22, 1.6), xx + field(rs, 22, 1.6)],
                              order=1, mode='nearest') > 0.5
ink |= rim

# Colour laid on a touch off the line, but never past the outline.
sy = np.clip(np.rint(yy - field(rs, 12, 0.8) - 0.4), 0, 1023).astype(int)
sx = np.clip(np.rint(xx - field(rs, 12, 0.8) - 0.5), 0, 1023).astype(int)
paint = paint[sy, sx]
paint[~figure] = WHITE
paper = (paint == WHITE).all(-1)

# Only real background stays see-through: paper reachable from the edge without
# crossing ink, and big gaps low down (under the desk, between stool legs).
# Enclosed slivers get a paper wash so a coloured backdrop never shows inside.
open_paper = paper & ~ndimage.binary_dilation(ink, iterations=1)
lab, n = ndimage.label(open_paper)
idxs = range(1, n + 1)
edge_ids = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
# Enclosed gaps (between the arms, by the stool, pockets in the fur fringe) are
# background too, unless they lie mostly in pages, teeth, eye glints, the pale
# quill or the glint on the ink pot.
kept_pale = book_m | head_m | quill_m | pot_m
inside = ndimage.mean(kept_pale, lab, idxs)
sizes = ndimage.sum(open_paper, lab, idxs)
see_through = np.zeros(n + 1, bool)
for i, (frac, size) in enumerate(zip(inside, sizes), 1):
    # Teeth and glints are small; anything big is a gap (e.g. under the snout).
    see_through[i] = i in edge_ids or frac < 0.6 or size > 1200
background = ndimage.binary_dilation(see_through[lab], iterations=2) & paper
paint[paper & ~background] = PAPER_WASH
paper = (paint == WHITE).all(-1)
ink_img = np.where(ink[..., None], np.uint8(0), WHITE).astype(np.uint8)

fur = np.array(FUR, np.uint8)
static_paint, static_ink = paint.copy(), ink_img.copy()
for name, poly in PARTS.items():
    m = poly_mask(poly)
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
(OUT / 'parts.txt').write_text('static\n' + '\n'.join(PARTS) + '\n')  # for trace-layers.jsx

# Preview on cream and on the starry blue, to check before tracing.
prev = []
for bg in ((241, 231, 208), (36, 64, 122)):
    p = np.where(paper[..., None], np.array(bg, np.uint8), paint).astype(np.uint8)
    p[ink] = (33, 29, 24)
    prev.append(p)
Image.fromarray(np.concatenate(prev, 1)).save(OUT / 'preview.png')
print('wrote', sorted(p.name for p in OUT.iterdir()))
