"""Paint a starry-vault tile: staggered gold eight-point stars on worn deep blue.

    python3 tools/art-src/vault/make_vault.py

Writes vault-tile.png (1024 x 1024, for Adobe generative expand) and
assets/art/vault.svg (a vector version the app can use at any size).
"""
import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage

HERE = Path(__file__).parent
ROOT = HERE.parents[2]
rng = np.random.default_rng(3)
BLUE = np.array([36, 64, 122], np.float32)
GOLD = (214, 176, 92)


def star_points(cx, cy, r, rot):
    pts = []
    for i in range(16):
        a = rot + i * math.pi / 8
        if i % 4 == 0:
            rr = r            # long rays (up, down, left, right)
        elif i % 2 == 0:
            rr = r * 0.62     # short diagonal rays
        else:
            rr = r * 0.16     # the waist between rays
        pts.append((cx + rr * math.sin(a), cy - rr * math.cos(a)))
    return pts


def stars(size, spacing, seed):
    r = np.random.default_rng(seed)
    out = []
    rows = int(size[1] / spacing) + 2
    cols = int(size[0] / spacing) + 2
    for j in range(-1, rows):
        for i in range(-1, cols):
            x = i * spacing + (spacing / 2 if j % 2 else 0) + r.uniform(-9, 9)
            y = j * spacing * 0.92 + r.uniform(-9, 9)
            out.append((x, y, r.uniform(19, 26), math.radians(r.uniform(-9, 9)), r.uniform(0.82, 1.0)))
    return out


# ── raster tile ──
W = H = 1024
noise = ndimage.zoom(rng.standard_normal((9, 9)), W / 9, order=3)[:H, :W]
blotch = ndimage.gaussian_filter(rng.standard_normal((H, W)), 22)
shade = 1 + 0.10 * noise / np.abs(noise).max() + 0.06 * blotch / np.abs(blotch).max()
base = np.clip(BLUE[None, None] * shade[..., None], 0, 255).astype(np.uint8)
img = Image.fromarray(base).convert('RGBA')
layer = Image.new('RGBA', (W, H), (0, 0, 0, 0))
d = ImageDraw.Draw(layer)
for x, y, r, rot, a in stars((W, H), 128, 5):
    d.polygon(star_points(x, y, r, rot), fill=GOLD + (int(255 * a),))
img = Image.alpha_composite(img, layer.filter(ImageFilter.GaussianBlur(0.6))).convert('RGB')
img.save(HERE / 'vault-tile.png')

# ── vector version ──
VW, VH = 1600, 1000
blobs = ''.join(
    f'<ellipse cx="{rng.uniform(0, VW):.0f}" cy="{rng.uniform(0, VH):.0f}" rx="{rng.uniform(120, 320):.0f}" ry="{rng.uniform(80, 220):.0f}" '
    f'fill="{"#2c4d8c" if k % 2 else "#1f3a70"}" opacity="{rng.uniform(0.25, 0.5):.2f}"/>' for k in range(16))
paths = []
for x, y, r, rot, a in stars((VW, VH), 132, 7):
    pts = ' '.join(f'{px:.1f},{py:.1f}' for px, py in star_points(x, y, r, rot))
    paths.append(f'<polygon points="{pts}" opacity="{a:.2f}"/>')
svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {VW} {VH}" preserveAspectRatio="xMidYMid slice">
<defs><filter id="soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="40"/></filter></defs>
<rect width="{VW}" height="{VH}" fill="#24407a"/>
<g filter="url(#soft)">{blobs}</g>
<g fill="#d6b05c">{"".join(paths)}</g>
</svg>
'''
(ROOT / 'assets/art/vault.svg').write_text(svg)
print('ok', (HERE / 'vault-tile.png').stat().st_size, (ROOT / 'assets/art/vault.svg').stat().st_size)
