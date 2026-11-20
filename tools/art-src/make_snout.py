"""Cut the possum's snout out as its own layer, so it can sit over the planner page.

    python3 tools/art-src/make_snout.py

On the planner the possum peers over the top edge of the page: its head is
behind the page, and this snout layer goes in front of it, lined up exactly
(same 1024 x 1024 viewBox as possum-writing.svg). So the page edge crosses the
face below the eyes and the snout and grin lie over the paper.

The snout is the cream face, nose and teeth below the eyes, grown out to take
in its ink outline. Above SNOUT_TOP it is cut straight; that part sits behind
nothing (it is above the page edge), so the cut never shows. A thin ink line is
drawn round the rest, where the snout meets the hidden cheek fur.
Writes assets/art/possum-snout.svg.
"""
import re
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage
from skimage import measure

HERE = Path(__file__).parent
ROOT = HERE.parents[1]
LAYERS = HERE / 'layers-possum-calm'
SNOUT_TOP = 282       # straight cut, a little above where the page edge crosses
LINE_FROM = 300       # draw the outline only below the page edge
SEED = (380, 320)     # a point on the snout (x, y)

paint = np.asarray(Image.open(LAYERS / 'paint-static.png').convert('RGB')).copy()
for name in ['tail', 'head', 'writing-arm', 'resting-arm']:
    part = np.asarray(Image.open(LAYERS / f'paint-{name}.png').convert('RGB'))
    on = (part != 255).any(-1)
    paint[on] = part[on]
ink = np.zeros(paint.shape[:2], bool)
for name in ['static', 'tail', 'head', 'writing-arm', 'resting-arm']:
    ink |= np.asarray(Image.open(LAYERS / f'ink-{name}.png').convert('L')) < 128

p = paint.astype(int)
near = lambda c, tol: (np.abs(p - np.array(c)) <= tol).all(-1)
face = near((230, 203, 168), 12) | near((212, 134, 110), 14) | near((246, 239, 221), 10) | near((243, 234, 214), 10)
# Bounded below by the jaw line, so the throat fur under the grin stays behind
# the page; on the right the cream face itself ends where the cheek fur begins.
win = Image.new('L', (1024, 1024), 0)
ImageDraw.Draw(win).polygon([(326, SNOUT_TOP), (540, SNOUT_TOP), (540, 318), (500, 338), (470, 354),
                             (440, 374), (402, 400), (370, 412), (326, 414)], fill=255)
window = np.asarray(win) > 0
# The grey streak under the eye runs down onto the snout: include it (but not the
# cheek fur further right), or the page's yellow band shows through the face there.
face |= near((134, 119, 105), 16) & (np.arange(1024)[None, :] < 470)
face &= window
lab, _ = ndimage.label(face)
snout = lab == lab[SEED[1], SEED[0]]
# Take in the outline and the mouth (teeth and the dark of the grin), then close up.
snout = ndimage.binary_dilation(snout, iterations=6) & (snout | ink) & window
snout = ndimage.binary_fill_holes(ndimage.binary_closing(snout, iterations=2)) & window
lab, _ = ndimage.label(snout)
snout = lab == lab[SEED[1], SEED[0]]

contours = [measure.approximate_polygon(c, tolerance=0.6)
            for c in measure.find_contours(np.pad(snout, 1).astype(float), 0.5) if len(c) > 12]
d = ' '.join('M ' + ' L '.join(f'{col - 1:.1f} {row - 1:.1f}' for row, col in c) + ' Z' for c in contours)

art = (ROOT / 'assets/art/possum-writing.svg').read_text(encoding='utf-8')
# The head group runs up to the writing arm's group; drop its closing tag and the
# eyelids (they hold no nested groups).
head = art[art.index('<g id="head">') + len('<g id="head">'):art.index('<g id="writing-arm">')]
head = head[:head.rindex('</g>')]
head = re.sub(r'<g id="lids".*?</g>', '', head, flags=re.S)
head = re.sub(r' id="[^"]*"', '', head)
svg = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">\n'
       f'<defs><clipPath id="snout"><path d="{d}" clip-rule="evenodd"/></clipPath>'
       f'<clipPath id="below"><rect x="0" y="{LINE_FROM}" width="1024" height="{1024 - LINE_FROM}"/></clipPath></defs>\n'
       f'<g clip-path="url(#snout)">{head}</g>\n'
       f'<g clip-path="url(#below)"><path d="{d}" fill="none" stroke="#211D18" stroke-width="2.4" stroke-linejoin="round"/></g>\n'
       '</svg>\n')
out = ROOT / 'assets/art/possum-snout.svg'
out.write_text(svg, encoding='utf-8')
ys, xs = np.nonzero(snout)
print('wrote', out, f'{out.stat().st_size // 1024} KB', 'snout box', xs.min(), ys.min(), xs.max(), ys.max())
