import json, sys, os, subprocess
from PIL import Image, ImageDraw, ImageFont
SP = sys.argv[1]
J = json.load(open(f'{SP}/coll/angles.json'))
D = json.load(open(f'{SP}/coll/divs2.json')); A = D['A']
PDF = os.path.expanduser('~/Library/CloudStorage/Dropbox/Moniteur/Code Fiscal_2026_small.pdf')
F = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf', 22)
def page(p):
    f = f'{SP}/img/pages/hp-{p:03d}.png'
    if not os.path.exists(f):
        subprocess.run(['pdftoppm', '-f', str(p), '-l', str(p), '-r', '300', '-gray', '-png', '-singlefile', PDF, f[:-4]], check=True)
    return Image.open(f)
items = [('A', i, x) for i, x in enumerate(J['acc'])] + [('G', i, x) for i, x in enumerate(J['glue'])]
tiles = []
for kind, i, x in items:
    p, k, wa, wb, box, conf = x
    im = page(p)
    l, t, w, h = box
    c = im.crop((max(0, l - 260), t - 14, min(im.width, l + w + 260), t + h + 14)).convert('RGB')
    c = c.resize((int(c.width * 0.8), int(c.height * 0.8)))
    ctx = ' '.join(A[j][0] for j in range(max(0, k - 4), min(len(A), k + 5)))
    lab = f'{kind}{i:02d} p.{p}  W:{wa}  T:{wb}  | {ctx[:70]}'
    tl = Image.new('RGB', (max(c.width, 900), c.height + 28), 'white')
    ImageDraw.Draw(tl).text((4, 2), lab, fill=(150, 0, 0), font=F)
    tl.paste(c, (0, 28))
    tiles.append(tl)
per = 14
for n in range(0, len(tiles), per):
    g = tiles[n:n + per]
    s = Image.new('RGB', (max(t.width for t in g), sum(t.height + 6 for t in g)), (90, 90, 90))
    y = 0
    for t in g:
        s.paste(t, (0, y)); y += t.height + 6
    s.save(f'{SP}/img/angles-{n // per:02d}.png')
print(len(tiles), 'vignettes')
