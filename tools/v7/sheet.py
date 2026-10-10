# contact sheet of rendered PNGs (dev helper): python3 tools/v7/sheet.py out.png a.png b.png ...
import sys
from PIL import Image
out, files = sys.argv[1], sys.argv[2:]; ims = [Image.open(f).convert('RGBA') for f in files]; h = max(i.height for i in ims)
ims = [i.resize((int(i.width * min(1, 300 / h)), int(i.height * min(1, 300 / h)))) for i in ims]; h = max(i.height for i in ims)
W = sum(i.width for i in ims) + 6 * len(ims); c = Image.new('RGBA', (min(W, 1800), h * (W // 1800 + 1) + 10), (24, 18, 44, 255)); x = y = 0
for i in ims:
    if x + i.width > 1800: x = 0; y += h + 4
    c.alpha_composite(i, (x, y)); x += i.width + 6
c.save(out)
