"""Join the traced paint + ink layers into one drawn-looking, animatable SVG.

    python3 tools/art-src/assemble-layers.py [drawn|bold|fine|calm|possum-calm]

Reads  tools/art-src/layers/{paint,ink}-{tail,static,head,arm}.svg
Writes assets/art/cat-desk-drawn.svg

Each moving part is <g id="tail|static|head|arm"> holding a soft paint layer and a
crisp ink layer. The hand-drawn wobble and loose colour are baked in by
layers.py, so the file needs no filters.
"""
import re
import sys
from pathlib import Path

HERE = Path(__file__).parent
VARIANT = sys.argv[1] if len(sys.argv) > 1 else 'drawn'
SRC = HERE / ('layers' if VARIANT == 'drawn' else f'layers-{VARIANT}')
# The look chosen for the app (calm) goes straight to the file the app loads;
# other variants are for comparing.
OUT = HERE.parent.parent / 'assets' / 'art' / ('cat-writing.svg' if VARIANT == 'calm' else f'cat-desk-{VARIANT}.svg')
ORDER = ['tail', 'static', 'head', 'arm']
if VARIANT == 'possum-calm':
    # The possum (made by possum-calm.py) has two arms; same part names as
    # tools/possum-motion.html expects.
    OUT = HERE.parent.parent / 'assets' / 'art' / 'possum-writing.svg'
    ORDER = ['tail', 'static', 'head', 'writing-arm', 'resting-arm']
INK = '#211D18'
FUR = (SRC / 'fur.txt').read_text().strip()

DEFS = ''

# Eyelid positions: from layers.py when the drawing was bent, else the original spots.
LIDS = [tuple(l.split()) for l in (SRC / 'lids.txt').read_text().split('\n') if l.strip()] \
    if (SRC / 'lids.txt').exists() else [('423', '244', '21', '15'), ('508', '242', '29', '16')]
def lid(cx, cy, rx, ry):
    cx, cy, rx, ry = map(float, (cx, cy, rx, ry))
    shut = f'M {cx - rx * 0.9:.1f} {cy + 1:.1f} Q {cx:.1f} {cy + ry * 0.75:.1f} {cx + rx * 0.9:.1f} {cy + 1:.1f}'
    return (f'    <ellipse cx="{cx}" cy="{cy}" rx="{rx}" ry="{ry}"/>\n'
            f'    <path class="shut" d="{shut}" fill="none" stroke="{INK}" stroke-width="5" stroke-linecap="round"/>\n')


# Lids: fur-coloured covers for blinking, plus a closed-eye curve shown while napping.
EYELIDS = f'<g id="lids" display="none" fill="{FUR}">\n' + ''.join(lid(*l) for l in LIDS) + '  </g>'


def inner(path):
    body = re.search(r'<svg[^>]*>(.*)</svg>', path.read_text(encoding='iso-8859-1'), re.S).group(1)
    body = re.sub(r'<metadata>.*?</metadata>', '', body, flags=re.S)
    return re.sub(r'(\d+\.\d)\d+', r'\1', body.strip())  # one decimal is plenty at this size


groups = []
for name in ORDER:
    paint = inner(SRC / f'paint-{name}.svg')
    ink = inner(SRC / f'ink-{name}.svg')
    extra = '\n  ' + EYELIDS if name == 'head' else ''
    groups.append(
        f'<g id="{name}">\n'
        f'  <g class="paint">{paint}</g>\n'
        f'  <g class="ink" fill="{INK}">{ink}</g>{extra}\n'
        f'</g>'
    )

OUT.write_text('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">\n' + DEFS + '\n'
               + '\n'.join(groups) + '\n</svg>\n', encoding='utf-8')
print('wrote', OUT, f'{OUT.stat().st_size // 1024} KB')
