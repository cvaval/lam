"""Vignettes de collation : la zone du fac-similé où Tesseract a lu une suite de mots.

    python3 -I scripts/data/codes-penaux-2025/vignette.py <pdf> <dossier OCR> <sortie.png> <page>:<mots>[;<page>:<mots>…]

Exemple : « 102:Article 562 » découpe, page 102, les lignes où se lisent « Article » puis « 562 ». Les boîtes
viennent de `pNNN.tesseract.tsv` (même passe que la lecture). Plusieurs lieux s'empilent dans une même image,
chacun sous son étiquette. Sert à TRANCHER À L'ŒIL : rien n'est décidé ici.
"""
import os
import subprocess
import sys
import unicodedata

from PIL import Image, ImageDraw, ImageFont


def fold(s):
    s = unicodedata.normalize('NFD', s.replace('’', "'"))
    return ''.join(c for c in s if unicodedata.category(c) != 'Mn').lower().strip('.,;:-–()«»"\'')


def boites(dossier, p):
    out = []
    for ln in open(os.path.join(dossier, f'p{p:03d}.tesseract.tsv'), encoding='utf8').read().split('\n')[1:]:
        f = ln.split('\t')
        if len(f) == 12 and f[11].strip():
            out.append((f[11], int(f[6]), int(f[7]), int(f[8]), int(f[9])))
    return out


def page(pdf, p, cache):
    f = os.path.join(cache, f'p{p:03d}.png')
    if not os.path.exists(f):
        subprocess.run(['pdftoppm', '-f', str(p), '-l', str(p), '-r', '300', '-gray', '-png', '-singlefile', pdf, f[:-4]], check=True)
    return Image.open(f)


def main(pdf, dossier, sortie, lieux):
    cache = os.path.join(os.path.dirname(os.path.abspath(sortie)), '_pages')
    os.makedirs(cache, exist_ok=True)
    police = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf', 28)
    vignettes = []
    for lieu in lieux.split(';'):
        p, mots = lieu.split(':', 1)
        p = int(p)
        cle = [fold(m) for m in mots.split()]
        bx = boites(dossier, p)
        im = page(pdf, p, cache)
        W, H = im.size
        trouves = []
        for i in range(len(bx) - len(cle) + 1):
            if all(fold(bx[i + j][0]).startswith(cle[j]) for j in range(len(cle))):
                trouves.append(bx[i:i + len(cle)])
        if not trouves:
            trouves = [None]
        for t in trouves:
            if t is None:
                crop = im.crop((0, 0, W, min(H, 600)))
                titre = f'p. {p} — « {mots} » NON LOCALISÉ (haut de page)'
            else:
                x1 = max(0, min(b[1] for b in t) - 120)
                y1 = max(0, min(b[2] for b in t) - 60)
                y2 = min(H, max(b[2] + b[4] for b in t) + 90)
                crop = im.crop((x1, y1, min(W, x1 + 2200), y2))
                titre = f'p. {p} — « {mots} »'
            v = Image.new('L', (crop.width, crop.height + 44), 255)
            ImageDraw.Draw(v).text((8, 6), titre, fill=0, font=police)
            v.paste(crop, (0, 44))
            vignettes.append(v)
    W = max(v.width for v in vignettes)
    H = sum(v.height + 12 for v in vignettes)
    planche = Image.new('L', (W, H), 255)
    y = 0
    for v in vignettes:
        planche.paste(v, (0, y))
        y += v.height + 12
    planche.save(sortie)
    print(f'{sortie} : {len(vignettes)} vignette(s)')


if __name__ == '__main__':
    main(*sys.argv[1:5])
