"""Assemble traced Productive Possum parts into one animatable SVG."""
import re
from pathlib import Path

HERE = Path(__file__).parent
SRC = HERE / "possum-layers"
OUT = HERE.parent.parent / "assets" / "art" / "possum-writing.svg"
ORDER = ["tail", "static", "head", "writing-arm", "resting-arm"]


def inner(path):
    text = path.read_text(encoding="iso-8859-1")
    body = re.search(r"<svg[^>]*>(.*)</svg>", text, re.S).group(1)
    body = re.sub(r"<metadata>.*?</metadata>", "", body, flags=re.S)
    return body.strip()


# Paper-coloured eyelids cover the bead eyes; the curves are used for sleep.
LIDS = """<g id="lids" display="none" fill="#E2D1BC">
  <ellipse cx="370" cy="260" rx="15" ry="18"/>
  <ellipse cx="455" cy="257" rx="17" ry="19"/>
  <g class="shut" fill="none" stroke="#211D18" stroke-width="5" stroke-linecap="round">
    <path d="M357 261 Q370 272 383 261"/>
    <path d="M440 258 Q455 270 470 258"/>
  </g>
</g>"""

groups = []
for name in ORDER:
    content = inner(SRC / f"{name}.svg")
    extra = "\n  " + LIDS if name == "head" else ""
    groups.append(f'<g id="{name}">\n  {content}{extra}\n</g>')

OUT.write_text(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">\n'
    + "\n".join(groups)
    + "\n</svg>\n",
    encoding="utf-8",
)
print("wrote", OUT, f"{OUT.stat().st_size // 1024} KB")
