"""Cut the flattened cat-at-desk image into the parts that move, ready for tracing.

    python3 tools/art-src/split.py

Reads  tools/art-src/cat-desk-flat.png  (1024 x 1024, from flatten.py)
Writes tools/art-src/parts/{static,head,arm,tail}.png  (paper turned white so Image Trace drops it)

Polygons are in image pixels. The still layer gets a fur-coloured plug under the
head and arm, shrunk a little, so a slightly moved part never reveals a hole.
"""
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

HERE = Path(__file__).parent
PAPER = np.array([241, 233, 216])
FUR = np.array([196, 134, 52])
WHITE = np.array([255, 255, 255])

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

img = np.asarray(Image.open(HERE / 'cat-desk-flat.png').convert('RGB')).copy()
paper = (img == PAPER).all(-1)
out_dir = HERE / 'parts'
out_dir.mkdir(exist_ok=True)


def mask(poly):
    m = Image.new('L', (img.shape[1], img.shape[0]), 0)
    ImageDraw.Draw(m).polygon(poly, fill=255)
    return np.asarray(m) > 0


static = img.copy()
for name, poly in PARTS.items():
    m = mask(poly)
    part = np.where(m[..., None], img, WHITE)
    part[paper] = WHITE
    Image.fromarray(part.astype(np.uint8)).save(out_dir / f'{name}.png')
    static[m] = WHITE
    if name in PLUGGED:
        solid = Image.fromarray(((m & ~paper) * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(9))
        static[np.asarray(solid) > 0] = FUR

static[paper] = WHITE
Image.fromarray(static.astype(np.uint8)).save(out_dir / 'static.png')
print('wrote', sorted(p.name for p in out_dir.iterdir()))
