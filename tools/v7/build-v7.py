# v7: pack the Blender renders from tools/v7/r_v7.py into WebP atlases + JSON frame maps (public/assets/v7/<group>.webp/.json),
# downscaled to crisp ~2x game size, plus the full-frame roulette layers (rotor, bowl, grow-room backdrop + foreground).
# Usage: python3 tools/v7/build-v7.py [/tmp/v7]
import json, os, sys
import numpy as np
from PIL import Image
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')); OUT = os.path.join(ROOT, 'public', 'assets', 'v7'); SRC = sys.argv[1] if len(sys.argv) > 1 else '/tmp/v7'
os.makedirs(OUT, exist_ok=True)
def bbox(im, th=4): a = np.asarray(im)[..., 3]; ys, xs = np.where(a > th); return (int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1) if len(xs) else (0, 0, 1, 1)
def save(im, name, q=86):
    p = os.path.join(OUT, name); im.save(p, 'WEBP', quality=q, method=6, alpha_quality=90) if name.endswith('.webp') else im.save(p); print(name, im.size, os.path.getsize(p) // 1024, 'KB'); return p
def pack(items, maxw=1024, pad=2):
    items = sorted(items, key=lambda t: -t[1].height); x = y = sh = 0; pos = {}
    for n, im in items:
        if x + im.width + pad > maxw: x = 0; y += sh + pad; sh = 0
        pos[n] = (x, y); x += im.width + pad; sh = max(sh, im.height)
    at = Image.new('RGBA', (maxw, y + sh)); fr = {}
    for n, im in items: px, py = pos[n]; at.alpha_composite(im, (px, py)); fr[n] = [px, py, im.width, im.height]
    return at, fr
def load(group, name, size, crop=True):
    im = Image.open(os.path.join(SRC, group, name + '.png')).convert('RGBA')
    if crop: b = bbox(im); im = im.crop((max(0, b[0] - 1), max(0, b[1] - 1), min(im.width, b[2] + 1), min(im.height, b[3] + 1)))
    s = size / max(im.width, im.height)
    if s < 1: im = im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.LANCZOS)
    return (name, im)
def atlas(group, spec, maxw=1024):
    items = [load(group, n, sz) for n, sz in spec if os.path.exists(os.path.join(SRC, group, n + '.png'))]
    at, fr = pack(items, maxw); save(at, group + '.webp'); json.dump({'frames': fr}, open(os.path.join(OUT, group + '.json'), 'w'))
G = sys.argv[2:] or ['snacks', 'grow', 'sling', 'haze', 'ships', 'brick', 'wheel', 'room']
if 'snacks' in G: atlas('snacks', [(n, 128) for n in ['donut', 'cookie', 'pizza', 'brownie', 'mint']], 512)
if 'grow' in G: atlas('grow', [(n, 128) for n in ['aphid', 'mite', 'gnat', 'caterpillar', 'beetle']] + [(n, 150) for n in ['launcher', 'trap', 'mister', 'zapper', 'solar']] + [('plant', 220)], 1024)
if 'sling' in G: atlas('sling', [('ball', 64), ('bot', 128), ('fork', 200)] + [(f'{k}_{v}', 160) for k in ('wood', 'glass', 'stone') for v in ('sq', 'h', 'v')], 1024)
if 'haze' in G: atlas('haze', [(n, 128) for n in ['dart', 'fan', 'prism', 'frost']] + [(n, 112) for n in ['orb_white', 'orb_violet', 'orb_green', 'orb_gold', 'orb_dark']], 1024)
if 'ships' in G: atlas('ships', [('player', 150), ('drone_a', 112), ('drone_b', 112), ('drone_c', 124), ('boss', 300)] + [(n, 64) for n in ['pu_spread', 'pu_rapid', 'pu_shield', 'pu_life']], 1024)
if 'brick' in G: atlas('brick', [(f'b_{n}', 128) for n in ['red', 'orange', 'yellow', 'green', 'cyan', 'violet', 'steel', 'steel_cracked']] + [('paddle', 260), ('ball', 40)], 512)
if 'wheel' in G:
    for n, sz in [('rotor', 900), ('bowl', 1100)]:
        im = Image.open(os.path.join(SRC, 'wheel', n + '.png')).convert('RGBA'); im = im.resize((sz, sz), Image.LANCZOS); save(im, f'wheel-{n}.webp', 84)
    atlas('wheelparts', []) if False else None
    items = [load('wheel', 'turret', 200), load('wheel', 'ball', 40)]; at, fr = pack(items, 256); save(at, 'wheelparts.webp'); json.dump({'frames': fr}, open(os.path.join(OUT, 'wheelparts.json'), 'w'))
if 'room' in G:
    p = os.path.join(SRC, 'room', 'growroom.png')
    if os.path.exists(p): im = Image.open(p).convert('RGB').resize((720, 1280), Image.LANCZOS); save(im, 'growroom.webp', 80)
    p = os.path.join(SRC, 'room', 'growfg.png')
    if os.path.exists(p): im = Image.open(p).convert('RGBA').resize((720, 1280), Image.LANCZOS); save(im, 'growroom-fg.webp', 78)
