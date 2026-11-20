"""Join the traced parts into one layered SVG the app can animate.

    python3 tools/art-src/assemble.py

Reads  tools/art-src/parts/{tail,static,head,arm}.svg
Writes assets/art/cat-desk.svg with <g id="tail|static|head|arm">. The tail sits
under the still layer so it slides behind the stool when it moves.
"""
import re
from pathlib import Path

HERE = Path(__file__).parent
OUT = HERE.parent.parent / 'assets' / 'art' / 'cat-desk.svg'
ORDER = ['tail', 'static', 'head', 'arm']

# Eyelids for blinking, in the same pixel space as the trace.
EYELIDS = '''<g id="lids" display="none" fill="#C38534" stroke="#211D18" stroke-width="3">
    <ellipse cx="423" cy="244" rx="21" ry="15"/>
    <ellipse cx="508" cy="242" rx="29" ry="16"/>
  </g>'''


def inner(svg_text):
    body = re.search(r'<svg[^>]*>(.*)</svg>', svg_text, re.S).group(1)
    body = re.sub(r'<metadata>.*?</metadata>', '', body, flags=re.S)
    return body.strip()


groups = []
for name in ORDER:
    content = inner((HERE / 'parts' / f'{name}.svg').read_text(encoding='iso-8859-1'))
    if name == 'head':
        content += '\n  ' + EYELIDS
    groups.append(f'<g id="{name}">\n  {content}\n</g>')

OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">\n' + '\n'.join(groups) + '\n</svg>\n',
    encoding='utf-8',
)
print('wrote', OUT, f'{OUT.stat().st_size // 1024} KB')
