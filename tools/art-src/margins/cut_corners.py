"""Cut the vine-and-figure corners out of the cream scene as see-through PNGs.

    python3 tools/art-src/margins/cut_corners.py

Source: margins/scene-cream-vines.jpg (the user's productive-possum-outlined-
cream-no-stars-v2, 1280x720). The possum is left out (it is its own art) and
the parchment becomes transparent, so the corners sit on any screen colour.
Writes assets/art/margins/{top-left,top-right,bottom-left,bottom-sprig}.png.
"""
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

HERE = Path(__file__).parent
OUT = HERE.parent.parent.parent / 'assets' / 'art' / 'margins'
OUT.mkdir(parents=True, exist_ok=True)
im = np.asarray(Image.open(HERE / 'scene-cream-vines.jpg').convert('RGB')).astype(np.float32)
PAPER = np.median(im[200:500, 450:850].reshape(-1, 3), axis=0)

# Anything clearly not parchment, then fill the insides of outlined shapes
# (pale faces, hands and leaf centres sit inside an ink line).
diff = np.sqrt(((im - PAPER) ** 2).sum(-1))
drawn = diff > 26
drawn = ndimage.binary_closing(drawn, iterations=1)
holes = ndimage.binary_fill_holes(drawn) & ~drawn
hl, hn = ndimage.label(holes)
hsizes = ndimage.sum(holes, hl, range(1, hn + 1))
drawn |= np.concatenate([[False], hsizes < 900])[hl]  # faces and hands, not vine loops
# The possum's ear pokes into the top-right corner: it is not part of the vines.
drawn[300:380, 980:1190] = False
lab, n = ndimage.label(drawn)
sizes = ndimage.sum(drawn, lab, range(1, n + 1))
drawn = np.concatenate([[False], sizes >= 25])[lab]  # paper speckle out
# Soft 1px edge so the cut never looks jagged.
alpha = ndimage.gaussian_filter(drawn.astype(np.float32), 0.6)
alpha = np.clip((alpha - 0.15) / 0.7, 0, 1)

BOXES = {
    'top-left': (0, 0, 348, 388),
    'top-right': (912, 0, 1280, 362),
    'bottom-left': (0, 384, 604, 720),
    'bottom-sprig': (600, 566, 898, 708),
}
for name, (x0, y0, x1, y1) in BOXES.items():
    rgba = np.dstack([im[y0:y1, x0:x1], alpha[y0:y1, x0:x1] * 255]).clip(0, 255).astype(np.uint8)
    a = rgba[..., 3] > 8
    ys, xs = np.nonzero(a)
    rgba = rgba[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    Image.fromarray(rgba, 'RGBA').save(OUT / f'{name}.png', optimize=True)
    print(name, rgba.shape[1], 'x', rgba.shape[0])
