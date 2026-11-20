"""Make mac/AppIcon.icns: the possum's head on parchment, in an ochre and red frame.

    python3 mac/scripts/make_icon.py

Renders assets/art/possum-writing.svg with Quick Look (qlmanage), crops the head,
and builds every size macOS wants with iconutil.
"""
import shutil
import subprocess
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
SVG = ROOT / 'assets/art/possum-writing.svg'
OUT = HERE.parent / 'AppIcon.icns'

with tempfile.TemporaryDirectory() as tmp:
    tmp = Path(tmp)
    subprocess.run(['qlmanage', '-t', '-s', '1024', '-o', str(tmp), str(SVG)], check=True, capture_output=True)
    art = Image.open(tmp / f'{SVG.name}.png').convert('RGBA')
    # Quick Look paints a white ground; lift it out so the parchment shows.
    px = art.load()
    for y in range(art.height):
        for x in range(art.width):
            r, g, b, a = px[x, y]
            if r > 247 and g > 247 and b > 247:
                px[x, y] = (0, 0, 0, 0)
    # Lift out the quill and the writing paw, which sit just left of the snout.
    lift = ImageDraw.Draw(art)
    lift.rectangle((0, 0, 330, 480), fill=(0, 0, 0, 0))
    lift.rectangle((0, 415, 362, art.height), fill=(0, 0, 0, 0))
    lift.rectangle((325, 322, 350, 342), fill=(0, 0, 0, 0))   # a stray ink fleck by the snout
    # A square around the face: centred between the eyes and the snout, ears to chin.
    cx, cy, half = 445, 245, 210
    head = art.crop((cx - half, cy - half, cx + half, cy + half))

    S = 1024
    icon = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(icon)
    pad, radius = 100, 185                       # macOS icon grid: art inside ~824px
    box = (pad, pad, S - pad, S - pad)
    d.rounded_rectangle(box, radius, fill=(28, 25, 19, 255))                       # ink edge
    d.rounded_rectangle((pad + 10, pad + 10, S - pad - 10, S - pad - 10), radius - 10, fill=(224, 176, 64, 255))   # ochre band
    d.rounded_rectangle((pad + 36, pad + 36, S - pad - 36, S - pad - 36), radius - 34, fill=(168, 67, 46, 255))    # red rule
    d.rounded_rectangle((pad + 44, pad + 44, S - pad - 44, S - pad - 44), radius - 40, fill=(241, 225, 200, 255))  # parchment
    # The face fills the page, centred; the fur runs off the frame, clipped to it.
    inner = (pad + 44, pad + 44, S - pad - 44, S - pad - 44)
    w = inner[2] - inner[0]
    face = head.resize((w, w), Image.LANCZOS)
    layer = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    layer.alpha_composite(face, (inner[0], inner[1]))
    mask = Image.new('L', (S, S), 0)
    ImageDraw.Draw(mask).rounded_rectangle(inner, radius - 40, fill=255)
    clipped = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    clipped.paste(layer, (0, 0), Image.composite(layer.getchannel('A'), Image.new('L', (S, S), 0), mask))
    icon.alpha_composite(clipped)

    sets = tmp / 'AppIcon.iconset'
    sets.mkdir()
    for size in (16, 32, 128, 256, 512):
        for scale in (1, 2):
            px_size = size * scale
            name = f'icon_{size}x{size}{"@2x" if scale == 2 else ""}.png'
            icon.resize((px_size, px_size), Image.LANCZOS).save(sets / name)
    subprocess.run(['iconutil', '-c', 'icns', str(sets), '-o', str(OUT)], check=True)
    icon.save(HERE.parent / 'AppIcon-preview.png')
print('wrote', OUT)
