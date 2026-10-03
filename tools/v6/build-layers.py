# v6 parallax + ambient layers (original procedural art, generated with PIL/numpy). Every layer tiles horizontally:
# shapes are drawn on a 3x-wide canvas with wrapped copies and blurred before cropping the middle tile, and noise
# is blurred with a periodic (FFT) gaussian, so column 0 continues column W-1 exactly.
import numpy as np, random, math, os, sys
from PIL import Image, ImageDraw, ImageFilter
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')); OUT = os.path.join(ROOT, 'public', 'assets', 'v6'); os.makedirs(OUT, exist_ok=True)
def pnoise(h, w, sigma, seed, sy=None):
    r = np.random.default_rng(seed).standard_normal((h, w)); fy = np.fft.fftfreq(h)[:, None]; fx = np.fft.fftfreq(w)[None, :]
    sy = sigma if sy is None else sy; g = np.exp(-2 * (math.pi ** 2) * ((fx * sigma) ** 2 + (fy * sy) ** 2))
    n = np.real(np.fft.ifft2(np.fft.fft2(r) * g)); n = (n - n.min()) / (n.max() - n.min() + 1e-9); return n
def fbm(h, w, seed, base=64, oct=4, sy=None):
    t = np.zeros((h, w)); a = 1; s = 0
    for o in range(oct): t += a * pnoise(h, w, base / 2 ** o, seed + o, None if sy is None else sy / 2 ** o); s += a; a *= 0.5
    return t / s
def save(im, name, q=82):
    p = os.path.join(OUT, name); im.save(p, 'WEBP', quality=q, method=6); print(name, im.size, os.path.getsize(p) // 1024, 'KB')
def seam(im):
    a = np.asarray(im.convert('RGBA')).astype(float); return float(np.abs(a[:, 0] - a[:, -1]).mean()), float(np.abs(a[:, 1] - a[:, 0]).mean())
class Wrap:
    """draw on a 3W canvas; every primitive is stamped at x-W, x, x+W; crop the middle third"""
    def __init__(s, W, H, mode='RGBA', bg=(0, 0, 0, 0)): s.W, s.H = W, H; s.im = Image.new(mode, (W * 3, H), bg); s.d = ImageDraw.Draw(s.im)
    def rect(s, x0, y0, x1, y1, fill): [s.d.rectangle([x0 + k * s.W + s.W, y0, x1 + k * s.W + s.W, y1], fill=fill) for k in (-1, 0, 1)]
    def ellipse(s, x0, y0, x1, y1, fill): [s.d.ellipse([x0 + k * s.W + s.W, y0, x1 + k * s.W + s.W, y1], fill=fill) for k in (-1, 0, 1)]
    def poly(s, pts, fill): [s.d.polygon([(x + k * s.W + s.W, y) for x, y in pts], fill=fill) for k in (-1, 0, 1)]
    def line(s, pts, fill, width=1): [s.d.line([(x + k * s.W + s.W, y) for x, y in pts], fill=fill, width=width) for k in (-1, 0, 1)]
    def crop(s, im=None): return (im or s.im).crop((s.W, 0, 2 * s.W, s.H))
def glow(im, r):  # additive bloom of a 3W RGBA image
    b = im.filter(ImageFilter.GaussianBlur(r)); return b
def sky(W=1024, H=768, seed=3):
    y = np.linspace(0, 1, H)[:, None]
    top = np.array([6, 5, 22]); mid = np.array([28, 12, 58]); hor = np.array([92, 30, 96]); low = np.array([150, 60, 110])
    c = np.where(y < 0.55, top + (mid - top) * (y / 0.55), np.where(y < 0.85, mid + (hor - mid) * ((y - 0.55) / 0.3), hor + (low - hor) * ((y - 0.85) / 0.15)))
    img = np.repeat(c[:, None, :], W, axis=1).reshape(H, W, 3).astype(float)
    cl = fbm(H, W, seed, 160, 5, 50); cl = np.clip((cl - 0.48) * 3.0, 0, 1) ** 1.4  # wispy clouds lit by the city from below
    lit = (0.25 + 0.75 * y) ; ccol = np.array([120, 70, 150])[None, None, :] * lit[..., None] + np.array([30, 20, 50])[None, None, :]
    img = img * (1 - cl[..., None] * 0.55) + ccol * cl[..., None] * 0.55
    rng = random.Random(seed); im = Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)).convert('RGBA'); wr = Wrap(W, H); wr.im.paste(im, (W, 0)); wr.im.paste(im, (0, 0)); wr.im.paste(im, (2 * W, 0))
    for i in range(260):
        x, yy = rng.random() * W, rng.random() ** 1.6 * H * 0.7; b = rng.random() ** 2; r = 0.4 + b * 0.9; a = int(70 + 185 * b)
        col = rng.choice([(255, 255, 255), (200, 220, 255), (255, 230, 200)]); wr.ellipse(x - r, yy - r, x + r, yy + r, col + (a,))
    out = wr.crop(); save(out.convert('RGB'), 'px-sky.webp', 78); return out
def window_grid(wr, x, top, w, base, rng, dens, cw=7, ch=10, warm=0.6, dim=1.0):
    cols = max(1, int((w - 6) // cw)); rows = max(1, int((base - top - 8) // ch)); floorlit = rng.random()
    for r in range(rows):
        rowon = rng.random() < 0.12
        for c in range(cols):
            if rowon or rng.random() < dens:
                col = (255, 196, 120) if rng.random() < warm else (150, 205, 255)
                if rng.random() < 0.08: col = (255, 120, 220)
                k = (0.55 + 0.45 * rng.random()) * dim; col = tuple(int(v * k) for v in col)
                wx = x + 4 + c * cw; wy = top + 6 + r * ch; wr.rect(wx, wy, wx + max(1, cw - 2.5), wy + max(1, ch - 3), col + (255,))
def skyline(name, W, H, seed, n_range, hmin, hmax, wmin, wmax, body, dens, haze, signs=0, blur=0, roofs=True, cw=7, ch=10):
    rng = random.Random(seed); wr = Wrap(W, H); em = Wrap(W, H)
    x = 0; blds = []
    while x < W:
        w = rng.uniform(wmin, wmax); h = rng.uniform(hmin, hmax) * (1.25 if rng.random() < 0.15 else 1); blds.append((x, w, min(H - 10, h))); x += w + rng.uniform(-6, 10)
    # shift so the tile wraps cleanly: last building may overhang past W -> wrapped copies cover x<0
    for (x, w, h) in blds:
        top = H - h; shade = rng.uniform(0.75, 1.15); col = tuple(int(c * shade) for c in body)
        wr.rect(x, top, x + w, H, col + (255,))
        if roofs and rng.random() < 0.45:  # setback / crown
            sw = w * rng.uniform(0.4, 0.7); sx = x + (w - sw) / 2; sh = rng.uniform(12, 40); wr.rect(sx, top - sh, sx + sw, top, col + (255,))
            if rng.random() < 0.6: wr.rect(sx + sw / 2 - 1.5, top - sh - rng.uniform(15, 50), sx + sw / 2 + 1.5, top - sh, col + (255,)); em.ellipse(sx + sw / 2 - 2.5, top - sh - 52, sx + sw / 2 + 2.5, top - sh - 47, (255, 40, 60, 255)) if rng.random() < 0.7 else None
        window_grid(em, x, top, w, H, rng, dens * rng.uniform(0.5, 1.4), cw, ch, warm=rng.uniform(0.3, 0.9))
        # rim light from the neon street: magenta on the left edge, cyan on the right
        em.rect(x, top, x + 1.5, H, (255, 60, 200, 110)); em.rect(x + w - 1.5, top, x + w, H, (60, 220, 255, 110))
        if signs and rng.random() < signs:
            sw = min(w - 8, rng.uniform(24, 60)); sh = rng.uniform(10, 26); sx = x + rng.uniform(4, max(5, w - sw - 4)); sy = top + rng.uniform(16, max(18, min(h - 40, 120)))
            col = rng.choice([(255, 40, 200), (40, 230, 255), (255, 170, 40), (170, 90, 255), (60, 255, 140)])
            wr.rect(sx - 2, sy - 2, sx + sw + 2, sy + sh + 2, (10, 8, 18, 255)); em.rect(sx, sy, sx + sw, sy + sh, col + (255,))
            for k in range(rng.randint(2, 4)):  # abstract glyph bars (no text)
                bx = sx + 4 + k * (sw - 8) / 4; em.rect(bx, sy + 3, bx + (sw - 8) / 6, sy + sh - 3, (255, 255, 255, 230))
            if rng.random() < 0.5:  # vertical blade sign
                vx = x + (2 if rng.random() < 0.5 else w - 12); em.rect(vx, sy + sh + 10, vx + 9, sy + sh + 10 + rng.uniform(40, 90), col + (255,))
    base = wr.im; e = em.im
    # haze: blend toward the horizon glow colour with height (far = more haze)
    a = np.asarray(base).astype(float); yy = np.linspace(0, 1, H)[:, None, None]
    hz = np.array(haze[:3])[None, None, :]; k = haze[3] * (0.35 + 0.65 * yy)
    a[..., :3] = a[..., :3] * (1 - k) + hz * k
    tex = np.tile(fbm(H, W, seed + 50, 30, 4, 90), (1, 3))[..., None]
    street = (yy ** 3) * np.array([70, 30, 60])[None, None, :]
    a[..., :3] = a[..., :3] * (0.75 + 0.5 * tex) + street * (a[..., 3:4] > 0)
    base = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), 'RGBA')
    e = e.filter(ImageFilter.GaussianBlur(0.5))
    g = glow(e, 6)
    comp = Image.alpha_composite(base, e); comp = Image.alpha_composite(comp, Image.fromarray((np.asarray(g).astype(float) * [1, 1, 1, 0.8]).astype(np.uint8), 'RGBA'))
    if blur: comp = comp.filter(ImageFilter.GaussianBlur(blur))
    out = Image.new('RGBA', (W, H)); out = Image.alpha_composite(out, comp.crop((W, 0, 2 * W, H)))
    save(out, name); print('  seam', seam(out)); return out
def near_lab(W=1600, H=540, seed=9):
    """glass-wall structure of the lab: steel columns, a top beam, hanging cables, a floor rail (alpha elsewhere)"""
    rng = random.Random(seed); wr = Wrap(W, H); em = Wrap(W, H)
    for i in range(4):
        x = i * 400 + 60; cw = 38
        for k in range(cw):  # cylindrical metal shading
            t = k / (cw - 1); s = 0.35 + 0.65 * math.sin(t * math.pi) ** 0.6; col = (int(40 * s + 10), int(42 * s + 10), int(66 * s + 14), 255)
            wr.rect(x + k, 0, x + k, H, col)
        wr.rect(x - 6, 0, x + cw + 6, 26, (24, 24, 44, 255)); wr.rect(x - 6, H - 30, x + cw + 6, H, (24, 24, 44, 255))
        for yb in range(40, H - 40, 46): wr.ellipse(x + 6, yb, x + 11, yb + 5, (90, 92, 120, 255)); wr.ellipse(x + cw - 11, yb, x + cw - 6, yb + 5, (90, 92, 120, 255))
        em.rect(x + cw / 2 - 1.5, 30, x + cw / 2 + 1.5, H - 34, (190, 80, 255, 255))
        # cable sag to the next column
        x2 = x + 400; sag = rng.uniform(40, 90); pts = [(x + cw / 2 + (x2 - x) * t, 14 + sag * math.sin(t * math.pi)) for t in [j / 30 for j in range(31)]]
        wr.line(pts, (16, 16, 26, 255), 4)
    wr.rect(0, 0, W, 10, (20, 20, 36, 255))
    g = glow(em.im, 5); comp = Image.alpha_composite(wr.im, em.im); comp = Image.alpha_composite(comp, g)
    out = comp.crop((W, 0, 2 * W, H)); save(out, 'px-near-lab.webp'); print('  seam', seam(out))
def near_roofs(W=1600, H=260, seed=21):
    rng = random.Random(seed); wr = Wrap(W, H); em = Wrap(W, H); x = 0
    while x < W:
        w = rng.uniform(120, 260); h = rng.uniform(60, 200); top = H - h; col = (10, 9, 20, 255); wr.rect(x, top, x + w, H, col)
        if rng.random() < 0.5:  # water tower
            tx = x + rng.uniform(10, w - 50); wr.rect(tx, top - 50, tx + 40, top - 18, col); wr.poly([(tx - 3, top - 50), (tx + 20, top - 66), (tx + 43, top - 50)], col)
            for k in (4, 34): wr.rect(tx + k, top - 18, tx + k + 3, top, col)
        if rng.random() < 0.6:  # AC units / railings
            for k in range(rng.randint(1, 3)): ax = x + rng.uniform(5, w - 30); wr.rect(ax, top - 14, ax + 26, top, (16, 15, 30, 255))
        em.rect(x, top, x + w, top + 2, (255, 70, 200, 160) if rng.random() < 0.5 else (60, 220, 255, 160))
        window_grid(em, x, top + 10, w, H, rng, 0.08, 6, 9, dim=0.7)
        x += w + rng.uniform(0, 24)
    g = glow(em.im, 4); comp = Image.alpha_composite(wr.im, em.im); comp = Image.alpha_composite(comp, g)
    out = comp.crop((W, 0, 2 * W, H)); save(out, 'px-near-roofs.webp'); print('  seam', seam(out))
def fog(W=512, H=512, seed=5, name='fx-fog.webp'):
    n = fbm(H, W, seed, 90, 5); a = np.clip((n - 0.35) * 2.2, 0, 1) ** 1.5 * 255
    im = np.zeros((H, W, 4), np.uint8); im[..., :3] = 255; im[..., 3] = a.astype(np.uint8)
    out = Image.fromarray(im, 'RGBA'); save(out, name, 70); print('  seam', seam(out))
def clouds_top(W=512, H=512, seed=8):  # Drift Rush: soft cloud shadows seen from above (periodic both ways)
    n = fbm(H, W, seed, 110, 4); a = np.clip((n - 0.5) * 2.6, 0, 1) ** 1.2 * 150
    im = np.zeros((H, W, 4), np.uint8); im[..., 0] = 4; im[..., 1] = 3; im[..., 2] = 14; im[..., 3] = a.astype(np.uint8)
    out = Image.fromarray(im, 'RGBA'); save(out, 'dr-clouds.webp', 70); print('  seam', seam(out))
def tower(W=148, H=512, seed=31):
    """Sky Hopper tower facade: glass curtain wall, tiles vertically (rows divide H)"""
    rng = random.Random(seed); x = np.linspace(0, 1, W)[None, :]
    shade = 0.35 + 0.9 * np.exp(-((x - 0.32) ** 2) / 0.02) * 0.6 + 0.25 * x  # cylindrical-ish reflection band
    a = np.zeros((H, W, 3)); a[...] = np.array([18, 22, 52])[None, None, :] * shade[..., None]
    refl = np.tile(fbm(64, W, seed, 18, 3), (H // 64, 1)) if False else None
    im = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)).convert('RGBA'); d = ImageDraw.Draw(im)
    cw, ch = 14, 16
    for r in range(H // ch):
        for c in range(1, W // cw - 1):
            x0 = c * cw + 2; y0 = r * ch + 3
            if rng.random() < 0.22:
                col = (255, 200, 130) if rng.random() < 0.6 else (150, 210, 255); k = 0.5 + 0.5 * rng.random(); d.rectangle((x0, y0, x0 + cw - 5, y0 + ch - 7), fill=tuple(int(v * k) for v in col) + (255,))
    for r in range(H // ch): d.line((0, r * ch, W, r * ch), fill=(60, 64, 96, 255), width=1)
    for c in range(W // cw + 1): d.line((c * cw, 0, c * cw, H), fill=(44, 48, 80, 255), width=1)
    for xx, col in [(0, (70, 74, 110)), (1, (110, 116, 160)), (2, (60, 64, 96)), (W - 3, (40, 42, 70)), (W - 2, (30, 32, 52)), (W - 1, (20, 20, 36))]: d.line((xx, 0, xx, H), fill=col + (255,))
    im = im.filter(ImageFilter.GaussianBlur(0.4)); save(im.convert('RGB'), 'sh-tower.webp', 82)
ALL = {'sky': sky, 'far': lambda: skyline('px-far.webp', 1600, 360, 11, None, 70, 300, 30, 80, (34, 26, 78), 0.10, (110, 50, 130, 0.55), signs=0, blur=0.7, cw=3, ch=5),
       'mid': lambda: skyline('px-mid.webp', 1600, 460, 12, None, 150, 430, 70, 150, (14, 11, 34), 0.22, (60, 25, 80, 0.3), signs=0.55, cw=5, ch=7),
       'lab': near_lab, 'roofs': near_roofs, 'fog': fog, 'clouds': clouds_top, 'tower': tower}
if __name__ == '__main__':
    for k in (sys.argv[1:] or list(ALL)): ALL[k]()
