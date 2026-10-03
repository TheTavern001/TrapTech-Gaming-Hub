# v6: pack Blender renders into WebP atlases + JSON frame maps, cut real citrus photo discs, make the Memory Match card back.
import json, os, glob, math, random, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')); OUT = os.path.join(ROOT, 'public', 'assets', 'v6'); SRC = os.path.join(ROOT, 'assets-src', 'v6')
def bbox(im, th=6): a = np.asarray(im)[..., 3]; ys, xs = np.where(a > th); return (int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1) if len(xs) else (0, 0, 1, 1)
def save(im, name, q=86):
    p = os.path.join(OUT, name); im.save(p, 'WEBP', quality=q, method=6, alpha_quality=90); print(name, im.size, os.path.getsize(p) // 1024, 'KB'); return p
def pack(items, maxw=1024, pad=2):
    """shelf packer: items = [(name, img)] -> atlas, {name: [x,y,w,h]}"""
    items = sorted(items, key=lambda t: -t[1].height); x = y = sh = 0; pos = {}
    for n, im in items:
        if x + im.width + pad > maxw: x = 0; y += sh + pad; sh = 0
        pos[n] = (x, y); x += im.width + pad; sh = max(sh, im.height)
    H = y + sh; at = Image.new('RGBA', (maxw, H))
    fr = {}
    for n, im in items: px, py = pos[n]; at.alpha_composite(im, (px, py)); fr[n] = [px, py, im.width, im.height]
    return at, fr
def astro():
    anims = {'run': 8, 'fly': 6, 'hit': 6, 'idle': 6}; frames = []
    for a, n in anims.items():
        for i in range(n): frames.append((f'{a}_{i}', Image.open(f'/tmp/astro/{a}_{i}.png').convert('RGBA')))
    bx = [bbox(im) for _, im in frames]; x0 = min(b[0] for b in bx); y0 = min(b[1] for b in bx); x1 = max(b[2] for b in bx); y1 = max(b[3] for b in bx)
    W0, H0 = frames[0][1].size; cw, ch = x1 - x0 + 2, y1 - y0 + 2
    # the art is 2x the in-game size; keep 2x for retina phones
    cols = 8; rows = math.ceil(len(frames) / cols); at = Image.new('RGBA', (cols * cw, rows * ch)); fr = {}
    for k, (n, im) in enumerate(frames):
        c = im.crop((x0 - 1, y0 - 1, x1 + 1, y1 + 1)); px, py = (k % cols) * cw, (k // cols) * ch; at.alpha_composite(c, (px, py)); fr[n] = [px, py, cw, ch]
    # anchor: where the original frame centre (the body centre the game positions) lands inside the cell
    meta = {'frames': fr, 'anims': anims, 'cell': [cw, ch], 'anchor': [(W0 / 2 - (x0 - 1)) / cw, (H0 * 0.52 - (y0 - 1)) / ch], 'src': [W0, H0]}
    save(at, 'astro.webp'); json.dump(meta, open(os.path.join(OUT, 'astro.json'), 'w'))
def crop_all(paths, scale=1.0):
    out = []
    for p in paths:
        im = Image.open(p).convert('RGBA'); b = bbox(im, 3); im = im.crop((max(0, b[0] - 1), max(0, b[1] - 1), min(im.width, b[2] + 1), min(im.height, b[3] + 1)))
        if scale != 1: im = im.resize((max(1, round(im.width * scale)), max(1, round(im.height * scale))), Image.LANCZOS)
        out.append((os.path.splitext(os.path.basename(p))[0], im))
    return out
def coins_uniform():
    # coin spin frames must share one cell so the coin does not jitter
    fs = [Image.open(f'/tmp/props/coin_{i}.png').convert('RGBA') for i in range(8)]; return [(f'coin_{i}', im.crop((2, 2, 94, 94))) for i, im in enumerate(fs)]
def props():
    ps = [p for p in glob.glob('/tmp/props/*.png') if not os.path.basename(p).startswith('coin_')]
    items = crop_all(ps) + coins_uniform()
    at, fr = pack(items, 1024); save(at, 'props.webp'); json.dump({'frames': fr}, open(os.path.join(OUT, 'props.json'), 'w'))
def drift():
    items = crop_all(['/tmp/cars/car_sedan.png', '/tmp/cars/cone.png', '/tmp/cars/tires.png', '/tmp/cars/nitro.png', '/tmp/cars/lamp.png'])
    # cars render facing -Y in Blender = down on screen? normalise so the nose points up
    fixed = []
    for n, im in items:
        fixed.append((n, im.rotate(180) if n.startswith('car_') else im))
    at, fr = pack(fixed, 512); save(at, 'drift.webp'); json.dump({'frames': fr}, open(os.path.join(OUT, 'drift.json'), 'w'))
def citrus():
    src = Image.open(os.path.join(SRC, 'c_citrus_ss.jpg')).convert('RGB')
    spots = {'lime': (500, 378, 142), 'lemon': (740, 140, 138), 'grapefruit': (812, 500, 138), 'orange': (394, 102, 100)}
    for n, (cx, cy, r) in spots.items():
        c = src.crop((cx - r, cy - r, cx + r, cy + r)).resize((192, 192), Image.LANCZOS).convert('RGBA')
        m = Image.new('L', (192 * 4, 192 * 4), 0); ImageDraw.Draw(m).ellipse((6, 6, 192 * 4 - 6, 192 * 4 - 6), fill=255); m = m.resize((192, 192), Image.LANCZOS)
        c.putalpha(m)
        # subtle glossy highlight so the photo reads as a wet slice under club lights
        hl = Image.new('RGBA', (192, 192)); d = ImageDraw.Draw(hl); d.ellipse((30, 18, 120, 70), fill=(255, 255, 255, 50)); hl = hl.filter(ImageFilter.GaussianBlur(10))
        c = Image.alpha_composite(c, Image.composite(hl, Image.new('RGBA', (192, 192)), m))
        save(c, f'tt-{n}.webp', 84)
def card_back(W=384, H=384, seed=4):
    rng = np.random.default_rng(seed); n = rng.standard_normal((H, W)); 
    from PIL import ImageFilter as F
    nimg = Image.fromarray(((n - n.min()) / (n.max() - n.min()) * 255).astype(np.uint8)).filter(F.GaussianBlur(1.2))
    v = np.asarray(nimg).astype(float) / 255
    yy, xx = np.mgrid[0:H, 0:W]; rad = np.hypot(xx - W / 2, yy - H / 2) / (W / 2)
    base = np.array([58, 12, 84]) * (1.15 - 0.45 * rad[..., None]) * (0.85 + 0.3 * v[..., None])
    im = Image.fromarray(np.clip(base, 0, 255).astype(np.uint8)).convert('RGBA'); d = ImageDraw.Draw(im)
    # gold-foil border with bevel (two-tone) and a diamond lattice
    def gold(t): return (int(170 + 85 * t), int(120 + 80 * t), int(40 + 50 * t), 255)
    for k, t in [(10, 0.35), (13, 1.0), (16, 0.6)]: d.rounded_rectangle((k, k, W - k, H - k), 22, outline=gold(t), width=3)
    for i in range(-H, W, 32):
        d.line((i, 30, i + (H - 60), H - 30), fill=(212, 160, 70, 60), width=1); d.line((i + (H - 60), 30, i, H - 30), fill=(212, 160, 70, 60), width=1)
    m = Image.new('L', (W, H), 0); ImageDraw.Draw(m).rounded_rectangle((26, 26, W - 26, H - 26), 14, fill=255); lat = im.copy(); im = Image.composite(lat, Image.fromarray(np.clip(base, 0, 255).astype(np.uint8)).convert('RGBA'), m)
    d = ImageDraw.Draw(im)
    for k, t in [(10, 0.35), (13, 1.0), (16, 0.6)]: d.rounded_rectangle((k, k, W - k, H - k), 22, outline=gold(t), width=3)
    # emblem: gold medallion with embossed TT
    cx, cy, R = W / 2, H / 2, 74
    for r, t in [(R + 6, 0.3), (R, 1.0), (R - 8, 0.55)]: d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=gold(t))
    d.ellipse((cx - R + 14, cy - R + 14, cx + R - 14, cy + R - 14), fill=(46, 8, 66, 255))
    try: f = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 64)
    except Exception: f = ImageFont.load_default()
    for off, col in [((2, 3), (20, 4, 30, 255)), ((0, 0), gold(1.0))]: d.text((cx + off[0], cy + off[1]), 'TT', font=f, fill=col, anchor='mm')
    # foil sheen
    sh = Image.new('RGBA', (W, H)); ds = ImageDraw.Draw(sh); ds.polygon([(0, H * 0.3), (W * 0.3, 0), (W * 0.5, 0), (0, H * 0.5)], fill=(255, 255, 255, 34)); sh = sh.filter(ImageFilter.GaussianBlur(18))
    im = Image.alpha_composite(im, sh); save(im.convert('RGB'), 'mm-back.webp', 84)
if __name__ == '__main__':
    for f in (sys.argv[1:] or ['astro', 'props', 'drift', 'citrus', 'card_back']): globals()[f]()
