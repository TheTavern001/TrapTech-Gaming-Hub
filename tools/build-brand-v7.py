#!/usr/bin/env python3
"""V7 Trap Tech brand assets, cut from Reese's own art in brand-src/traptech-v7/.

Outputs (public/assets/brand/):
  tt-lockup-{300,600}.webp + tt-lockup-600.png   graffiti TRAP TECH / SOLUTIONS + gold crown
  tt-chrome-{280,560}.webp + tt-chrome-560.png   chrome TRAP TECH + green SOLUTIONS (horizontal)
  tt-mono-{40,80,192}.webp + tt-mono-192.png      chrome TT shield monogram with crown
  tt-badge-{128,256}.webp + tt-badge-256.png     round neon badge
  tt-horizontal-{180,360,920}.webp + tt-horizontal-920.png  monogram + chrome lockup in one row
  traptech-wordmark.png (= tt-horizontal-920.png; used by OG cards and game thumbnails)

Masks: brand-src/traptech-v7/masks/*-isnet.png were made once with
`rembg -m isnet-general-use` on the crops below; this script only needs numpy, opencv, Pillow
(+ imagequant for small PNGs if installed). Run: python3 tools/build-brand-v7.py
"""
import os, sys, numpy as np, cv2
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'brand-src/traptech-v7/'); OUT = os.path.join(ROOT, 'public/assets/brand/')
try:
    import imagequant
except Exception:
    imagequant = None
K = 1408/819

def f32(im): return np.asarray(im.convert('RGB')).astype(np.float32)/255
def ell(n): return cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (n, n))
def fill_holes(m):
    pad = cv2.copyMakeBorder(m.astype(np.uint8)*255, 1, 1, 1, 1, cv2.BORDER_CONSTANT, value=0)
    cv2.floodFill(pad, None, (0, 0), 128)
    return m | (pad[1:-1, 1:-1] == 0)
def blackkey(rgb, lo, hi):
    a = np.clip((rgb.max(axis=2)-lo)/(hi-lo), 0, 1); a = a*a*(3-2*a)
    return np.clip(rgb/np.maximum(a[..., None], 1e-3), 0, 1), a
def rgba(rgb, a):
    return Image.fromarray((np.dstack([np.clip(rgb, 0, 1), np.clip(a, 0, 1)])*255+.5).astype(np.uint8), 'RGBA')
def tidy(im, min_area=40, pad=6):
    """drop specks, crop to content + padding"""
    arr = np.asarray(im).copy(); a = arr[..., 3]
    n, lab, st, _ = cv2.connectedComponentsWithStats((a > 12).astype(np.uint8), 8)
    small = np.zeros(a.shape, bool)
    for i in range(1, n):
        if st[i, cv2.CC_STAT_AREA] < min_area: small |= lab == i
    arr[..., 3][small] = 0
    arr[..., 3][arr[..., 3] < 6] = 0
    ys, xs = np.where(arr[..., 3] > 0)
    x0, x1, y0, y1 = max(xs.min()-pad, 0), min(xs.max()+pad+1, a.shape[1]), max(ys.min()-pad, 0), min(ys.max()+pad+1, a.shape[0])
    return Image.fromarray(arr[y0:y1, x0:x1], 'RGBA')

def wordmark():
    c = Image.open(SRC+'wordmark-square.jpg').crop((60, 120, 1360, 1010)); rgb = f32(c)
    m = np.asarray(Image.open(SRC+'masks/wordmark-isnet.png').convert('L')).astype(np.float32)/255
    obj = m > 0.35
    n, lab, st, _ = cv2.connectedComponentsWithStats(obj.astype(np.uint8), 8)
    keep = np.zeros_like(obj)
    for i in range(1, n):
        if st[i, cv2.CC_STAT_AREA] > 400: keep |= lab == i
    keep = cv2.dilate(keep.astype(np.uint8), ell(15)) > 0
    _, a0 = blackkey(rgb, 0.05, 0.28); box = np.zeros_like(keep); box[15:300, 500:840] = True
    n2, lab2, st2, _ = cv2.connectedComponentsWithStats(((a0 > 0.35) & box).astype(np.uint8), 8)
    if n2 > 1:
        crown = fill_holes(lab2 == 1+np.argmax(st2[1:, cv2.CC_STAT_AREA]))
        keep |= cv2.dilate(crown.astype(np.uint8), ell(13)) > 0
    soft = cv2.GaussianBlur(keep.astype(np.float32), (0, 0), 4)
    col, a = blackkey(rgb, 0.05, 0.28)
    return tidy(rgba(col, a*soft), 300, 8)

def mono():
    f = Image.open(SRC+'flyer-tt-monogram.jpg')
    rgb = f32(f.crop((int(290*K), int(15*K), int(530*K), int(316*K))))
    m = np.asarray(Image.open(SRC+'masks/mono-isnet.png').convert('L')).astype(np.float32)/255
    obj = cv2.morphologyEx((m > 0.25).astype(np.uint8), cv2.MORPH_CLOSE, ell(7)) > 0
    n, lab, st, _ = cv2.connectedComponentsWithStats(obj.astype(np.uint8), 8)
    obj = fill_holes(lab == 1+np.argmax(st[1:, cv2.CC_STAT_AREA]))
    soft = cv2.GaussianBlur(obj.astype(np.float32), (0, 0), 1.2)
    inner = cv2.erode(obj.astype(np.uint8), ell(25)) > 0
    band = cv2.GaussianBlur((~inner).astype(np.float32), (0, 0), 3)
    _, ak = blackkey(rgb, 0.05, 0.22)
    return tidy(rgba(rgb, soft*(1-band+band*ak)), 60, 6)

def chrome():
    f = Image.open(SRC+'flyer-tt-monogram.jpg')
    rgb = f32(f.crop((int(160*K), int(300*K), int(662*K), int(405*K))))
    hsv = cv2.cvtColor((rgb*255).astype(np.uint8), cv2.COLOR_RGB2HSV).astype(np.float32)
    chrome_ = (rgb.mean(axis=2) > 0.42) & (hsv[..., 1]/255 < 0.35)
    green = (rgb[..., 1] > 0.35) & (rgb[..., 1] > rgb[..., 0]*1.6) & (rgb[..., 1] > rgb[..., 2]*1.4)
    obj = cv2.morphologyEx((chrome_ | green).astype(np.uint8), cv2.MORPH_CLOSE, ell(5)) > 0
    n, lab, st, _ = cv2.connectedComponentsWithStats(obj.astype(np.uint8), 8)
    keep = np.zeros_like(obj); W = obj.shape[1]
    for i in range(1, n):
        x, y, w, h, ar = st[i]
        if ar > 60 and h > 10 and x > 2 and x+w < W-2 and not (w < 8 and h > 40 and x > W-40): keep |= lab == i
    keep = cv2.morphologyEx(keep.astype(np.uint8), cv2.MORPH_CLOSE, ell(7)) > 0
    keep = cv2.dilate(fill_holes(keep).astype(np.uint8), ell(5)) > 0
    keep[:, W-20:] = False          # the flyer's light streak at the far right
    soft = cv2.GaussianBlur(keep.astype(np.float32), (0, 0), 1.0)
    inner = cv2.erode(keep.astype(np.uint8), ell(9)) > 0
    band = cv2.GaussianBlur((~inner).astype(np.float32), (0, 0), 2)
    _, ak = blackkey(rgb, 0.06, 0.25)
    return tidy(rgba(rgb, soft*(1-band+band*ak)), 120, 6)

def badge():
    im = Image.open(SRC+'badge-round.jpg'); rgb = f32(im)
    g = cv2.cvtColor((rgb*255).astype(np.uint8), cv2.COLOR_RGB2GRAY)
    s = 704/g.shape[1]; small = cv2.resize(g, (704, int(g.shape[0]*s)))
    c = cv2.HoughCircles(cv2.GaussianBlur(small, (5, 5), 1.5), cv2.HOUGH_GRADIENT, dp=1, minDist=200, param1=80, param2=40, minRadius=250, maxRadius=340)
    cx, cy, R = (c[0][0]/s) if c is not None else (711, 695, 602)
    yy, xx = np.mgrid[:rgb.shape[0], :rgb.shape[1]]; r = np.hypot(xx-cx, yy-cy)
    col, ak = blackkey(rgb, 0.09, 0.45)
    ring = R + 10; outer = R + 70
    fall = np.clip((outer-r)/(outer-ring), 0, 1); fall = fall*fall
    a = np.where(r <= ring, 1.0, ak*fall)
    col = np.where((r <= ring)[..., None], rgb, col)
    half = int(outer)+2
    box = (int(cx-half), int(cy-half), int(cx+half), int(cy+half))
    return rgba(col, a).crop(box)

def quant_png(im, path):
    if imagequant is not None:
        q = imagequant.quantize_pil_image(im, dithering_level=1.0, max_colors=256, min_quality=0, max_quality=95)
        q.save(path, optimize=True)
    else:
        im.save(path, optimize=True)

def export(name, im, sizes, by='w', png=None):
    out = {}; png = png or sizes[-1]
    for sz in sizes:
        w, h = im.size; f = sz/(w if by == 'w' else h)
        r = im.resize((max(1, round(w*f)), max(1, round(h*f))), Image.LANCZOS)
        p = f'{OUT}{name}-{sz}.webp'; r.save(p, 'WEBP', quality=72, method=6, alpha_quality=80); out[p] = r.size
        if sz == png:
            quant_png(r, f'{OUT}{name}-{sz}.png'); out[f'{OUT}{name}-{sz}.png'] = r.size
    return out

if __name__ == '__main__':
    W, M, C, B = wordmark(), mono(), chrome(), badge()
    # horizontal row: monogram + chrome lockup, monogram 1.25x the lockup height
    h = 300; mm = M.resize((round(M.width*h/M.height), h), Image.LANCZOS)
    ch = round(h*0.62); cc = C.resize((round(C.width*ch/C.height), ch), Image.LANCZOS)
    gap = 26; row = Image.new('RGBA', (mm.width+gap+cc.width, h), (0, 0, 0, 0))
    row.alpha_composite(mm, (0, 0)); row.alpha_composite(cc, (mm.width+gap, (h-ch)//2+8))
    res = {}
    res.update(export('tt-lockup', W, [300, 600]))
    res.update(export('tt-chrome', C, [280, 560]))
    res.update(export('tt-mono', M, [40, 80, 192], by='h', png=192))
    res.update(export('tt-badge', B, [128, 256]))
    res.update(export('tt-horizontal', row, [180, 360, 920], png=920))
    import shutil; shutil.copy(OUT+'tt-horizontal-920.png', OUT+'traptech-wordmark.png')
    # 512 monogram for the PWA/social use (PNG only)
    m5 = M.resize((round(M.width*512/M.height), 512), Image.LANCZOS); quant_png(m5, OUT+'tt-mono-512.png')
    for p, sz in sorted(res.items()): print(f'{os.path.basename(p):28s} {sz[0]}x{sz[1]}  {os.path.getsize(p)/1024:.1f} KB')
