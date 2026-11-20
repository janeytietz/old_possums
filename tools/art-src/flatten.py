"""Snap an AI draft to the locked pomocat palette so Image Trace gives clean flat shapes.

    python3 tools/art-src/flatten.py <in.jpg> <out.png>
"""
import sys

import numpy as np
from PIL import Image, ImageFilter

# name: (colour to match in the draft, colour to output)
PALETTE = {
    'paper': ((241, 233, 216), (241, 233, 216)),
    'ink': ((33, 29, 24), (33, 29, 24)),
    'ochre': ((196, 134, 52), (196, 134, 52)),
    'ochre_dark': ((164, 112, 52), (164, 112, 52)),
    'cream': ((233, 214, 178), (233, 214, 178)),
    'vermilion': ((192, 58, 34), (192, 58, 34)),
    'verdigris': ((110, 146, 121), (110, 146, 121)),
    'verdigris_shade': ((62, 96, 80), (110, 146, 121)),
    'lapis': ((52, 79, 118), (52, 79, 118)),
    'brown': ((120, 82, 44), (120, 82, 44)),
}

src, dst = sys.argv[1], sys.argv[2]
img = Image.open(src).convert('RGB').filter(ImageFilter.MedianFilter(3))
px = np.asarray(img).astype(np.float32)
match = np.array([m for m, _ in PALETTE.values()], dtype=np.float32)
output = np.array([o for _, o in PALETTE.values()], dtype=np.uint8)
dist = ((px[:, :, None, :] - match[None, None, :, :]) ** 2).sum(-1)
idx = dist.argmin(-1).astype(np.uint8)

# Mode-filter the label map so speckles from paper grain don't become shapes.
labels = np.asarray(Image.fromarray(idx).filter(ImageFilter.ModeFilter(5))).copy()

# The mode filter also erases thin ink strokes (the fur lines on the chest), so put
# ink back wherever the draft is dark and nearly grey (so red ears and the blue ink
# pot stay coloured), with only a light clean-up.
names = list(PALETTE)
lum = px @ np.array([0.299, 0.587, 0.114], dtype=np.float32)
chroma = px.max(-1) - px.min(-1)
ink = Image.fromarray((((lum < 105) & (chroma < 50)) * 255).astype(np.uint8)).filter(ImageFilter.ModeFilter(3))
labels[np.asarray(ink) > 0] = names.index('ink')

# Green only belongs to the desk. Stray green specks above the desk top come from
# dark fur next to ink: give them the next-closest colour instead.
VERDIGRIS = [names.index('verdigris'), names.index('verdigris_shade')]
DESK_TOP = int(sys.argv[3]) if len(sys.argv) > 3 else 470
stray = np.isin(labels, VERDIGRIS)
stray[DESK_TOP:] = False
if stray.any():
    d = dist[stray]
    d[:, VERDIGRIS] = np.inf
    labels[stray] = d.argmin(-1)
Image.fromarray(output[labels]).save(dst)
counts = np.bincount(labels.ravel(), minlength=len(PALETTE))
for name, n in zip(PALETTE, counts):
    print(f'{name:15s} {n / counts.sum():6.1%}')
