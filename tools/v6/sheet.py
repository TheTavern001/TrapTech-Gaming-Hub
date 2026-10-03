import sys, glob, os
from PIL import Image
files = sorted(glob.glob(sys.argv[1])); out = sys.argv[2]; cell = int(sys.argv[3]) if len(sys.argv) > 3 else 160
cols = 8; rows = (len(files) + cols - 1) // cols
s = Image.new('RGBA', (cols * cell, rows * cell), (34, 22, 60, 255))
from PIL import ImageDraw
d = ImageDraw.Draw(s)
for i, f in enumerate(files):
    im = Image.open(f).convert('RGBA'); im.thumbnail((cell - 8, cell - 20)) if max(im.size) > cell - 8 else None
    if max(im.size) < cell // 2: k = (cell - 20) // max(im.size); im = im.resize((im.width * k, im.height * k))
    x, y = (i % cols) * cell, (i // cols) * cell; s.alpha_composite(im, (x + 4, y + 4)); d.text((x + 4, y + cell - 14), os.path.basename(f)[:22], fill='white')
s.save(out)
