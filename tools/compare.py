"""Side-by-side comparisons: user's mockup screen (left) vs built page screenshot (right)."""
import os
from PIL import Image, ImageDraw, ImageFont
R = os.path.join(os.path.dirname(__file__), '..')
M = os.path.join(R, 'mockups'); S = os.path.join(R, 'screenshots'); O = os.path.join(S, 'compare')
os.makedirs(O, exist_ok=True)
A, B, C = 'mockup-1-5.png', 'mockup-5-10.png', 'mockup-11-16.png'
PAIRS = [
 ('01-splash', A, (5, 8, 216, 500), 'mobile-01-splash'),
 ('02-sign-in', A, (226, 8, 437, 500), 'mobile-02-signin'),
 ('03-sign-up', A, (447, 8, 658, 500), 'mobile-03-signup'),
 ('04-home', A, (668, 8, 1012, 500), 'mobile-04-home'),
 ('05-games-library', A, (1018, 8, 1250, 500), 'mobile-05-games'),
 ('06-game-detail', B, (6, 8, 247, 440), 'mobile-06-game-detail'),
 ('07-leaderboard', B, (259, 8, 498, 440), 'mobile-09-leaderboard'),
 ('08-giveaways', B, (512, 8, 745, 440), 'mobile-10-giveaways'),
 ('09-profile', B, (757, 8, 977, 440), 'mobile-12-profile'),
 ('10-host-a-game', B, (978, 8, 1250, 440), 'mobile-13-host'),
 ('11-booking-request', C, (6, 5, 247, 255), 'mobile-14-booking'),
 ('12-admin-dashboard', C, (248, 5, 528, 255), 'desktop-11-admin-dashboard'),
 ('13-admin-manage-giveaway', C, (532, 5, 722, 255), 'mobile-17-admin-manage-giveaway'),
 ('15-community', C, (836, 5, 931, 255), 'mobile-15-community'),
]
HT = 900
try: font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 22)
except Exception: font = ImageFont.load_default()
thumbs = []
for name, src, box, shot in PAIRS:
    p = os.path.join(S, shot + '.png')
    if not os.path.exists(p): print('missing', shot); continue
    mk = Image.open(os.path.join(M, src)).convert('RGB').crop(box)
    mk = mk.resize((round(mk.width * HT / mk.height), HT), Image.LANCZOS)
    bt = Image.open(p).convert('RGB')
    if shot.startswith('desktop'): bt = bt.crop((0, 0, bt.width, min(bt.height, 900)))
    bt = bt.resize((round(bt.width * HT / bt.height), HT), Image.LANCZOS)
    W = mk.width + bt.width + 60
    out = Image.new('RGB', (W, HT + 60), (14, 16, 34))
    d = ImageDraw.Draw(out)
    d.text((20, 16), f'MOCKUP  ({name})', fill=(200, 190, 255), font=font)
    d.text((mk.width + 40, 16), 'BUILT  (live screenshot)', fill=(120, 230, 255), font=font)
    out.paste(mk, (20, 50)); out.paste(bt, (mk.width + 40, 50))
    path = os.path.join(O, f'compare-{name}.png'); out.save(path, optimize=True); print('wrote', os.path.relpath(path, R))
    t = out.copy(); t.thumbnail((700, 330)); thumbs.append(t)
# overview sheet
cols = 3; tw = 700; th = 330
rows = (len(thumbs) + cols - 1) // cols
sheet = Image.new('RGB', (cols * (tw + 10), rows * (th + 10)), (8, 8, 20))
for i, t in enumerate(thumbs): sheet.paste(t, ((i % cols) * (tw + 10), (i // cols) * (th + 10)))
sheet.save(os.path.join(O, 'compare-overview.png'), optimize=True); print('wrote screenshots/compare/compare-overview.png')
