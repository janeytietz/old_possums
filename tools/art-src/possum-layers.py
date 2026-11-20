"""Prepare the approved Productive Possum draft for Illustrator Image Trace.

The source is reduced to a restrained print palette and cut into independently
animatable pieces. White is transparent after tracing.
"""
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage

HERE = Path(__file__).parent
SRC = HERE / "possum-writing-source.jpg"
OUT = HERE / "possum-layers"
OUT.mkdir(exist_ok=True)
WHITE = np.array([255, 255, 255], np.uint8)

PARTS = {
    "head": [
        (338, 78), (548, 70), (590, 128), (586, 215), (548, 302),
        (510, 360), (452, 398), (372, 420), (332, 378), (330, 246),
    ],
    "writing-arm": [
        (185, 228), (238, 235), (280, 378), (326, 432), (382, 424),
        (454, 398), (520, 388), (534, 438), (494, 473), (414, 478),
        (350, 500), (294, 492), (278, 438), (230, 350),
    ],
    "resting-arm": [
        (375, 468), (460, 444), (548, 456), (644, 486), (658, 526),
        (622, 562), (548, 574), (466, 556), (390, 542), (362, 508),
    ],
    "tail": [
        (850, 614), (910, 640), (958, 704), (980, 790), (958, 860),
        (904, 900), (800, 926), (682, 944), (566, 990), (538, 962),
        (566, 926), (684, 900), (800, 884), (882, 840), (904, 780),
        (892, 710), (854, 660),
    ],
}


def poly_mask(points):
    mask = Image.new("L", (1024, 1024), 0)
    ImageDraw.Draw(mask).polygon(points, fill=255)
    return np.asarray(mask) > 0


source = Image.open(SRC).convert("RGB").resize((1024, 1024)).filter(ImageFilter.MedianFilter(3))
rgb = np.asarray(source)

# Fewer flat tones make a cleaner hand-coloured print and a much smaller SVG.
quantized = source.quantize(
    colors=14,
    method=Image.Quantize.MEDIANCUT,
    kmeans=4,
    dither=Image.Dither.NONE,
).filter(ImageFilter.ModeFilter(3)).convert("RGB")
art = np.asarray(quantized).copy()

# Only parchment connected to an image edge becomes transparent. Cream in the
# face, book and eye dots remains opaque.
corner = np.median(
    np.concatenate([
        rgb[:60, :60].reshape(-1, 3),
        rgb[:60, -60:].reshape(-1, 3),
        rgb[-60:, :60].reshape(-1, 3),
        rgb[-60:, -60:].reshape(-1, 3),
    ]),
    axis=0,
)
paper = np.linalg.norm(art.astype(float) - corner, axis=2) < 24
labels, count = ndimage.label(paper)
edge_ids = set(np.unique(np.concatenate([labels[0], labels[-1], labels[:, 0], labels[:, -1]]))) - {0}
background = np.isin(labels, list(edge_ids))
art[background] = WHITE

# Median colours used behind moving hinges.
body_patch = np.median(rgb[340:470, 610:760].reshape(-1, 3), axis=0).astype(np.uint8)
arm_patch = np.median(rgb[430:520, 470:600].reshape(-1, 3), axis=0).astype(np.uint8)

static = art.copy()
for name, points in PARTS.items():
    mask = poly_mask(points)
    grown = ndimage.binary_dilation(mask, iterations=3)
    Image.fromarray(np.where(grown[..., None], art, WHITE).astype(np.uint8)).save(OUT / f"{name}.png")
    static[mask] = WHITE

    # Small hidden overlaps stop a cream crack appearing when a part rocks.
    if name == "head":
        plug = ndimage.binary_erosion(mask & ~background, iterations=8)
        static[plug] = body_patch
    elif name in ("writing-arm", "resting-arm"):
        plug = ndimage.binary_erosion(mask & ~background, iterations=7)
        static[plug] = arm_patch

Image.fromarray(static).save(OUT / "static.png")
print("wrote", sorted(p.name for p in OUT.glob("*.png")))
