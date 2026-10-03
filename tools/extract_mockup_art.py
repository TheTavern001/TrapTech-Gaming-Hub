"""Extract and upscale the user's own art from the mockup PNGs.
Excludes third-party marks (Jetpack Joyride poster/character, High Times logo).
Upscaling: OpenCV dnn_superres EDSR x4 (model: Saafke/EDSR_Tensorflow), then light unsharp mask.
"""
import cv2, numpy as np, os, sys
from PIL import Image, ImageFilter
M = os.path.join(os.path.dirname(__file__), '..', 'mockups')
OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'assets')
sr = cv2.dnn_superres.DnnSuperResImpl_create()
sr.readModel('/tmp/EDSR_x4.pb'); sr.setModel('edsr', 4)
A, B, C = 'mockup-1-5.png', 'mockup-5-10.png', 'mockup-11-16.png'
# name, src, box(x0,y0,x1,y1), keyout(bg removal), max_width
CROPS = [
 ('brand/logo-stacked', A, (18, 82, 212, 274), True, 640),
 ('brand/logo-mark', A, (58, 82, 162, 171), True, 400),
 ('brand/logo-horizontal', C, (995, 11, 1203, 64), True, 820),
 ('brand/traptech', C, (1041, 209, 1158, 227), True, 460),
 ('brand/traptech-stacked', A, (72, 452, 158, 480), True, 340),
 ('brand/hero-banner', A, (673, 55, 1007, 155), False, 1336),
 ('cards/drift-rush', A, (1138, 125, 1235, 179), False, 388),
 ('cards/plinko', A, (1031, 209, 1130, 258), False, 396),
 ('cards/spin-to-win', A, (1138, 209, 1235, 258), False, 388),
 ('cards/memory-match', A, (1031, 289, 1130, 337), False, 396),
 ('cards/high-score', A, (1138, 289, 1235, 322), False, 388),
 ('cards/blazed-roulette', A, (1033, 386, 1131, 417), False, 392),
 ('cards/terp-tapper', A, (1138, 386, 1235, 415), False, 388),
 ('cards/drift-rush-tall', A, (765, 181, 839, 258), False, 296),
 ('cards/plinko-tall', A, (845, 181, 920, 258), False, 300),
 ('cards/spin-to-win-tall', A, (927, 181, 1000, 258), False, 292),
 ('giveaways/store-credit-art', B, (628, 113, 735, 194), False, 428),
 ('giveaways/ps5-bundle-art', B, (646, 251, 735, 315), False, 412),
 ('avatars/hooded', B, (768, 61, 832, 122), False, 256),
 ('avatars/act-1', B, (780, 295, 807, 322), False, 108),
 ('avatars/act-2', B, (780, 331, 807, 358), False, 108),
 ('avatars/act-3', B, (780, 362, 807, 389), False, 108),
 ('badges/rising-star', B, (779, 204, 817, 242), False, 152),
 ('badges/top-10', B, (824, 204, 863, 242), False, 156),
 ('badges/game-master', B, (870, 204, 911, 242), False, 164),
 ('badges/lucky', B, (921, 204, 959, 242), False, 152),
 ('packages/basic', B, (1009, 171, 1054, 214), True, 180),
 ('packages/premium', B, (1097, 171, 1134, 214), True, 148),
 ('packages/elite', B, (1178, 171, 1222, 214), True, 176),
]
def keyout(img):
    a = np.asarray(img.convert('RGB')).astype(np.float32)
    lum = a.max(axis=2)
    alpha = np.clip((lum - 38) / 70.0, 0, 1) * 255
    rgba = np.dstack([a, alpha]).astype(np.uint8)
    return Image.fromarray(rgba, 'RGBA')
only = sys.argv[1:]
for name, src, box, ko, maxw in CROPS:
    if only and name not in only: continue
    im = Image.open(os.path.join(M, src)).convert('RGB').crop(box)
    bgr = cv2.cvtColor(np.asarray(im), cv2.COLOR_RGB2BGR)
    up = sr.upsample(bgr)
    pil = Image.fromarray(cv2.cvtColor(up, cv2.COLOR_BGR2RGB))
    pil = pil.filter(ImageFilter.UnsharpMask(radius=2, percent=60, threshold=2))
    if pil.width > maxw: pil = pil.resize((maxw, round(pil.height * maxw / pil.width)), Image.LANCZOS)
    if ko: pil = keyout(pil)
    path = os.path.join(OUT, name)
    pil.save(path + '.webp', 'WEBP', quality=88, method=6)
    pil.save(path + '.png', optimize=True)
    print(name, pil.size)
