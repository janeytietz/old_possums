"""Cut the locked v3 collage into crude stop-motion pieces.

This deliberately keeps the raster engraving and real paper edge. OpenCV is
only used to remove each moving piece from a clean plate; no smoothing or
redrawing is applied.
"""
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

HERE = Path(__file__).parent
SRC = HERE / "cat-collage-v3.jpg"
OUT = HERE / "collage-parts"
OUT.mkdir(exist_ok=True)

# Separate polygons avoid taking the large empty wedge between quill and arm.
PARTS = {
    "writing": [
        [(181, 42), (250, 72), (285, 250), (331, 405), (319, 466), (294, 421), (245, 286), (166, 95)],
        [(313, 349), (366, 344), (430, 378), (543, 411), (527, 452), (467, 466), (369, 466), (322, 435)],
    ],
    "tail": [
        [(769, 596), (830, 606), (865, 646), (902, 671), (948, 664), (972, 702),
         (965, 771), (928, 810), (870, 829), (816, 805), (792, 755), (783, 685)],
    ],
}

bgr = cv2.imread(str(SRC))
rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
h, w = bgr.shape[:2]

# The corners are all untouched parchment. Their median is a reliable local
# paper colour for removing empty space inside each hand-drawn polygon.
corner = np.concatenate([
    rgb[:80, :80].reshape(-1, 3),
    rgb[:80, -80:].reshape(-1, 3),
    rgb[-80:, :80].reshape(-1, 3),
    rgb[-80:, -80:].reshape(-1, 3),
])
paper = np.median(corner, axis=0)
distance = np.linalg.norm(rgb.astype(np.float32) - paper, axis=2)

plate = rgb.copy()
erase_masks = {}
for name, polygons in PARTS.items():
    region = np.zeros((h, w), np.uint8)
    for points in polygons:
        cv2.fillPoly(region, [np.array(points, np.int32)], 255)

    # Keep engraved/cut paper and its small edge shadow, but not the untouched
    # background enclosed by the rough selection.
    alpha = np.where((region > 0) & (distance > 10), 255, 0).astype(np.uint8)
    alpha = cv2.morphologyEx(alpha, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
    alpha = cv2.dilate(alpha, np.ones((3, 3), np.uint8), iterations=1)

    rgba = np.dstack([rgb, alpha])
    Image.fromarray(rgba).save(OUT / f"{name}.png")

    erase_masks[name] = cv2.dilate(alpha, np.ones((5, 5), np.uint8), iterations=1)

# Fit the empty parchment as a smooth quadratic surface. This avoids the
# stretched smears that generic inpainting creates behind a large feather.
yy, xx = np.mgrid[0:h, 0:w]
known_paper = distance < 16
sample = known_paper & ((xx % 8 == 0) & (yy % 8 == 0))
features = np.column_stack([
    np.ones(sample.sum()),
    xx[sample] / w, yy[sample] / h,
    (xx[sample] / w) ** 2, (yy[sample] / h) ** 2,
    (xx[sample] * yy[sample]) / (w * h),
])
all_features = np.column_stack([
    np.ones(h * w),
    xx.ravel() / w, yy.ravel() / h,
    (xx.ravel() / w) ** 2, (yy.ravel() / h) ** 2,
    (xx.ravel() * yy.ravel()) / (w * h),
])
background = np.empty_like(rgb)
for channel in range(3):
    coefficients, *_ = np.linalg.lstsq(features, rgb[..., channel][sample], rcond=None)
    background[..., channel] = np.clip(all_features @ coefficients, 0, 255).reshape(h, w)

for erase in erase_masks.values():
    plate[erase > 0] = background[erase > 0]

# Hidden ochre overlap under the two hinges. It is normally covered completely;
# it only prevents a cream crack when a cutout rocks by a few degrees.
fur = tuple(int(v) for v in np.median(rgb[340:410, 560:650], axis=(0, 1)))
cv2.fillPoly(plate, [np.array([(500, 390), (534, 404), (538, 435), (512, 455), (490, 430)], np.int32)], fur)
cv2.fillPoly(plate, [np.array([(772, 603), (806, 610), (819, 641), (797, 660), (778, 638)], np.int32)], fur)

Image.fromarray(plate).save(OUT / "plate.jpg", quality=94)
print("paper", paper.astype(int).tolist())
print("wrote", sorted(p.name for p in OUT.iterdir()))
