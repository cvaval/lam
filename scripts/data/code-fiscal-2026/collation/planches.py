import json, sys, os, subprocess
from PIL import Image, ImageDraw, ImageFont
SP = sys.argv[1]
ids = set(sys.argv[2].split(',')) if len(sys.argv) > 2 and sys.argv[2] else None
L = json.load(open(f'{SP}/coll/lieux.json'))
PDF = os.path.expanduser('~/Library/CloudStorage/Dropbox/Moniteur/Code Fiscal_2026_small.pdf')
F = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Unicode.ttf' if os.path.exists('/System/Library/Fonts/Supplemental/Arial Unicode.ttf') else '/System/Library/Fonts/Supplemental/Arial.ttf', 26)
os.makedirs(f'{SP}/img/pages', exist_ok=True)
os.makedirs(f'{SP}/img/planches', exist_ok=True)
def page(p):
    f = f'{SP}/img/pages/hp-{p:03d}.png'
    if not os.path.exists(f):
        subprocess.run(['pdftoppm', '-f', str(p), '-l', str(p), '-r', '300', '-gray', '-png', '-singlefile', PDF, f[:-4]], check=True)
    return Image.open(f)
def rd(x, w):
    r = [d for d in x['lectures'] if d['w'] == w]
    return ' / '.join(' '.join(d['wb']) or '∅' for d in r) if r else '='
crops = []
for x in L:
    if ids and x['id'] not in ids:
        continue
    if not x['box'] or x['page'] < 1:
        continue
    im = page(x['page'])
    W, H = im.size
    b = x['box']
    x1, x2 = max(0, b[0] - 420), min(W, b[2] + 420)
    y1, y2 = max(0, b[1] - 75), min(H, b[3] + 75)
    if y2 - y1 > 520:
        y2 = y1 + 520
    c = im.crop((x1, y1, x2, y2)).convert('RGB')
    lab = [f"{x['id']} · p. {x['page']} · {x['ref']}",
           f"WORD : {x['word'][:95] or '∅'}",
           f"Opus : {rd(x, 'cf/ocr-opus')[:60]}   Haiku : {rd(x, 'cf/ocr')[:45]}   Tess : {rd(x, 'tesseract')[:30]}"]
    strip = Image.new('RGB', (max(c.width, 1300), 34 * len(lab) + 8), (255, 244, 200))
    d = ImageDraw.Draw(strip)
    for i, t in enumerate(lab):
        d.text((8, 4 + 34 * i), t, fill=(120, 0, 0) if i == 1 else (0, 0, 0), font=F)
    tile = Image.new('RGB', (strip.width, strip.height + c.height + 6), (255, 255, 255))
    tile.paste(strip, (0, 0))
    tile.paste(c, (0, strip.height + 3))
    d = ImageDraw.Draw(tile)
    # repère de la zone de divergence
    d.rectangle((b[0] - x1 - 6, strip.height + 3 + b[1] - y1 - 6, b[2] - x1 + 6, strip.height + 3 + b[3] - y1 + 6), outline=(220, 0, 0), width=3)
    crops.append((x['id'], tile))
per = int(os.environ.get('PER', '5'))
n = 0
for i in range(0, len(crops), per):
    grp = crops[i:i + per]
    w = max(t.width for _, t in grp)
    h = sum(t.height + 14 for _, t in grp)
    sheet = Image.new('RGB', (w, h), (90, 90, 90))
    y = 0
    for _, t in grp:
        sheet.paste(t, (0, y))
        y += t.height + 14
    n += 1
    name = f"{SP}/img/planches/{grp[0][0]}-{grp[-1][0]}.png"
    sheet.save(name)
print(n, 'planches')
