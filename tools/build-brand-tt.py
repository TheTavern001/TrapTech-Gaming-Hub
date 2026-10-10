# v7 logo (Reese, Oct 10): the clean v3 Trap Tech mark - geometric double-T monogram in white/silver, "TRAP TECH" + spaced
# light-cyan "SOLUTIONS" - rebuilt as crisp vector SVG (text converted to paths from the bundled Orbitron font), with a
# minimal line-art crown above the monogram. Writes public/assets/brand/tt-*.svg; tools/build-brand-tt.js rasterizes PNG/WebP.
import os
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
ROOT = os.path.join(os.path.dirname(__file__), '..'); OUT = os.path.join(ROOT, 'public', 'assets', 'brand')
FONT = TTFont(os.path.join(ROOT, 'public', 'fonts', 'orbitron-latin-600-normal.woff2'))
GS = FONT.getGlyphSet(); CMAP = FONT.getBestCmap(); UPM = FONT['head'].unitsPerEm; HM = FONT['hmtx']
def text_path(s, x, base, size, track=0.0):
    """SVG path data for s; returns (d, width)."""
    sc = size / UPM; pen = SVGPathPen(GS); cx = x
    for ch in s:
        g = CMAP.get(ord(ch)); adv = HM[g][0] * sc
        if ch != ' ': GS[g].draw(TransformPen(pen, (sc, 0, 0, -sc, cx, base)))
        cx += adv + track * size
    return pen.getCommands(), cx - x - track * size
SILVER = '<linearGradient id="tts" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".5" stop-color="#e6e9f5"/><stop offset=".62" stop-color="#b9c0da"/><stop offset="1" stop-color="#f3f5fc"/></linearGradient>'
CYAN = '#8be3ff'
# Monogram in a 100 x 120 box: crown 0-34, double T 38-118 (matches the v3 mark: wide cap, second tier with soft drops, 3 stems)
def mark(ox=0, oy=0, s=1.0):
    return f'''<g transform="translate({ox} {oy}) scale({s})">
  <g fill="none" stroke="url(#tts)" stroke-width="3.2" stroke-linejoin="round" stroke-linecap="round">
    <path d="M28 32 L24 12 L38 22 L50 6 L62 22 L76 12 L72 32 Z"/>
  </g>
  <path d="M30 32 H70" stroke="{CYAN}" stroke-width="1.6" stroke-linecap="round" opacity=".9"/>
  <circle cx="50" cy="6" r="2.6" fill="{CYAN}"/><circle cx="24" cy="12" r="2" fill="#fff"/><circle cx="76" cy="12" r="2" fill="#fff"/>
  <g fill="url(#tts)">
    <path d="M6 42 Q6 39 9 39 H91 Q94 39 94 42 L91 47 Q90 48.5 88 48.5 H12 Q10 48.5 9 47 Z"/>
    <path d="M18 52 H82 Q83.5 52 83 53.5 Q80 58 75 58.5 Q71 59 69 61 V58 H31 V61 Q29 59 25 58.5 Q20 58 17 53.5 Q16.5 52 18 52 Z"/>
    <path d="M33 58 H39.5 V106 L36.25 111 L33 106 Z"/>
    <path d="M46.5 58 H53.5 V113 L50 118 L46.5 113 Z"/>
    <path d="M60.5 58 H67 V106 L63.75 111 L60.5 106 Z"/>
  </g>
  <path d="M10 41 H90" stroke="#fff" stroke-width="1" stroke-linecap="round" opacity=".9"/>
</g>'''
def svg(w, h, body, extra=''):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w:.0f} {h:.0f}" width="{w:.0f}" height="{h:.0f}" role="img" aria-label="Trap Tech Solutions"><title>Trap Tech Solutions</title><defs>{SILVER}</defs>{extra}{body}</svg>\n'
def words(x, top, size1=44):
    d1, w1 = text_path('TRAP TECH', x, top + size1 * 0.78, size1, 0.06)
    size2 = size1 * 0.5; tr = (w1 - text_path('SOLUTIONS', 0, 0, size2)[1]) / (8 * size2)  # spread SOLUTIONS to the same width
    d2, w2 = text_path('SOLUTIONS', x, top + size1 * 0.78 + size2 * 1.75, size2, tr)
    return f'<path d="{d1}" fill="url(#tts)"/><path d="{d2}" fill="{CYAN}"/>', w1, size1 * 0.78 + size2 * 1.75
W = {}
# 1) mark (crowned TT)
W['mono'] = svg(100, 120, mark())
# 2) wordmark only (two lines)
b, w1, hh = words(4, 4); W['chrome'] = svg(w1 + 8, hh + 10, b)
# 3) horizontal: mark left, words right, vertically centred on the T
b, w1, hh = words(112, 44); W['horizontal'] = svg(112 + w1 + 6, 122, mark(2, 1) + b)
# 4) stacked lockup
b, w1, hh = words(0, 0); bw = w1; X = 6
b, w1, hh = words(X, 138); W['lockup'] = svg(bw + 2 * X, 138 + hh + 10, mark((bw + 2 * X) / 2 - 55, 4, 1.1) + b)
# 5) badge: mark on a dark disc with a thin cyan ring
W['badge'] = svg(256, 256, f'<circle cx="128" cy="128" r="124" fill="#11152e"/><circle cx="128" cy="128" r="119" fill="none" stroke="{CYAN}" stroke-width="2" opacity=".7"/>' + mark(68, 50, 1.2))
for k, s in W.items(): open(os.path.join(OUT, f'tt-{k}.svg'), 'w').write(s)
# favicon: the crowned mark on the hub's dark tile
open(os.path.join(OUT, 'tt-favicon.svg'), 'w').write(svg(128, 128, '<rect width="128" height="128" rx="26" fill="#11152e"/>' + mark(19, 6, 0.96)))
for k, s in W.items():
    import re; m = re.search(r'viewBox="0 0 (\d+) (\d+)"', s); print(k, m.group(1), m.group(2), len(s) // 1024, 'KB')
