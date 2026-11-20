"""Cut a beast's resting paw out of its drawing as its own vector file.

    python3 tools/art-src/make_paw.py [cat|possum]

Finds the paw's outline in the calm layers (fur and ink, not the book page),
cuts it at the wrist, and writes assets/art/paw.svg: the real traced drawing
clipped to that outline, with an ink line round it so the cut reads as the top
of the paw. Used for the beast peering over the planner.
cat -> assets/art/paw.svg, possum -> assets/art/possum-paw.svg.
"""
import re
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage
from skimage import measure

HERE = Path(__file__).parent
ROOT = HERE.parents[1]
BEAST = sys.argv[1] if len(sys.argv) > 1 else 'cat'
CFG = {
    # layers, moving parts, art file, box round the paw (x1 = wrist cut), a point
    # inside the paw, the rounded wrist (cx, cy, rx, ry), output file
    'cat': dict(layers='layers-calm', parts=['tail', 'head', 'arm'], art='cat-writing.svg',
                box=(416, 464, 501, 550), seed=(455, 515), wrist=(457, 513, 47, 37), out='paw.svg'),
    'possum': dict(layers='layers-possum-calm', parts=['tail', 'head', 'writing-arm', 'resting-arm'],
                   art='possum-writing.svg', box=(356, 492, 484, 572), seed=(420, 525),
                   wrist=(420, 531, 60, 35), out='possum-paw.svg'),
}[BEAST]
LAYERS = HERE / CFG['layers']
X0, Y0, X1, Y1 = CFG['box']
SEED = CFG['seed']

paint = np.asarray(Image.open(LAYERS / 'paint-static.png').convert('RGB')).copy()
for name in CFG['parts']:
    part = np.asarray(Image.open(LAYERS / f'paint-{name}.png').convert('RGB'))
    on = (part != 255).any(-1)
    paint[on] = part[on]
ink = np.zeros(paint.shape[:2], bool)
for name in ['static'] + CFG['parts']:
    ink |= np.asarray(Image.open(LAYERS / f'ink-{name}.png').convert('L')) < 128

box = (slice(Y0, Y1), slice(X0, X1))
r, g, b = (paint[box][..., i].astype(int) for i in range(3))
if BEAST == 'possum':
    # pink skin, plus the grey-brown fur wash where shading crept onto the hand
    skin = (r > 180) & (g > 110) & (g < 165) & (b > 80) & (b < 140) & (r - g > 50)
    fur = skin | ((np.abs(r - 134) < 14) & (np.abs(g - 119) < 14) & (np.abs(b - 105) < 14))
    core_src = skin
else:
    fur = (r > 150) & (g > 95) & (g < 175) & (b < 115) & (r - b > 70)
    core_src = fur
# Grow out from the paw's own fur (so far-off ink that happens to touch it stays out),
# keep only fur and ink, and round the wrist off so the cut reads as the paw's edge.
lab, _ = ndimage.label(core_src)
core = lab == lab[SEED[1] - Y0, SEED[0] - X0]
core = ndimage.binary_fill_holes(core)
grown = ndimage.binary_dilation(core, iterations=4)
yy, xx = np.mgrid[Y0:Y1, X0:X1]
wcx, wcy, wrx, wry = CFG['wrist']
rounded = ((xx - wcx) / wrx) ** 2 + ((yy - wcy) / wry) ** 2 <= 1
mask = grown & (fur | ink[box]) & rounded
mask = ndimage.binary_opening(mask, iterations=1)
lab, _ = ndimage.label(mask)
mask = lab == lab[SEED[1] - Y0, SEED[0] - X0]

# Outer outline plus any holes (gaps between toes), clipped even-odd so holes stay open.
contours = [measure.approximate_polygon(c, tolerance=0.7)
            for c in measure.find_contours(np.pad(mask, 1).astype(float), 0.5) if len(c) > 12]
paths = []
pts = []
for c in contours:
    cp = [(X0 + col - 1, Y0 + row - 1) for row, col in c]
    pts += cp
    paths.append('M ' + ' L '.join(f'{x:.1f} {y:.1f}' for x, y in cp) + ' Z')
d = ' '.join(paths)
xs, ys = [p[0] for p in pts], [p[1] for p in pts]
vb = (min(xs) - 3, min(ys) - 3, max(xs) - min(xs) + 6, max(ys) - min(ys) + 6)

art = (ROOT / 'assets/art' / CFG['art']).read_text(encoding='utf-8')
inner = re.search(r'<svg[^>]*>(.*)</svg>', art, re.S).group(1)
inner = re.sub(r'<g id="lids".*?</g>', '', inner, flags=re.S)   # no eyelids in a paw
inner = re.sub(r' id="[^"]*"', '', inner)                        # no ids to clash
svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb[0]:.1f} {vb[1]:.1f} {vb[2]:.1f} {vb[3]:.1f}">\n'
       f'<defs><clipPath id="paw"><path d="{d}" clip-rule="evenodd"/></clipPath></defs>\n'
       f'<g clip-path="url(#paw)">{inner}</g>\n'
       f'<path d="{d}" fill="none" stroke="#211D18" stroke-width="1.8" stroke-linejoin="round"/>\n'
       f'</svg>\n')
out = ROOT / 'assets/art' / CFG['out']
out.write_text(svg, encoding='utf-8')
print('wrote', out, f'{out.stat().st_size // 1024} KB', 'viewBox', [round(v, 1) for v in vb], len(pts), 'points')
