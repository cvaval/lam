"""Planches de collation : chaque lieu de divergence (collation.py) découpé sur le fac-similé, en légende les
deux lectures. On TRANCHE À L'ŒIL, planche par planche ; rien n'est décidé ici.

    python3 -E scripts/data/codes-penaux-2025/planches.py <pdf> <dossier OCR> <lieux.json> <dossier sortie> <ids|classe> [par_planche]

Le lieu est retrouvé dans les boîtes de Tesseract (`pNNN.tesseract.tsv`) par son contexte : derniers mots avant,
leçon de Tesseract, premiers mots après — la fenêtre de mots qui en reprend le plus. La vignette prend toute la
largeur de la colonne, sur la hauteur des lignes concernées.
"""
import json
import os
import re
import subprocess
import sys
import unicodedata

from PIL import Image, ImageDraw, ImageFont


def fold(s):
    s = unicodedata.normalize('NFD', s.replace('’', "'"))
    return re.sub(r'[^0-9a-z]', '', ''.join(c for c in s if unicodedata.category(c) != 'Mn').lower())


def mots(s):
    return [m for m in (fold(w) for w in re.split(r"[\s']+", s)) if m]


def tsv(dossier, p):
    out = []
    for ln in open(os.path.join(dossier, f'p{p:03d}.tesseract.tsv'), encoding='utf8').read().split('\n')[1:]:
        f = ln.split('\t')
        if len(f) == 12 and f[11].strip():
            for w in re.split(r"[’']", f[11]):
                if fold(w):
                    out.append((fold(w), int(f[6]), int(f[7]), int(f[8]), int(f[9])))
    return out


def localiser(bx, x):
    av, le, ap = mots(x['avant'])[-3:], mots(x['tesseract']) or mots(x['opus']), mots(x['apres'])[:3]
    cible = av + le + ap
    if not cible:
        return None
    meilleur, pos = 0, None
    for i in range(0, max(1, len(bx) - len(cible) + 1)):
        s = sum(1 for j, w in enumerate(cible) if i + j < len(bx) and (bx[i + j][0] == w or (len(w) > 3 and bx[i + j][0].startswith(w[:4]))))
        if s > meilleur:
            meilleur, pos = s, i
    if pos is None or meilleur < max(2, len(cible) // 2):
        return None
    zone = bx[pos:pos + len(cible)]
    # la leçon elle-même (ou, si Tesseract n'a rien lu, la jointure entre l'avant et l'après)
    a = pos + len(av)
    coeur = bx[a:a + len(le)] if le else bx[max(pos, a - 1):a + 1]
    coeur = coeur or zone
    return (min(b[2] for b in zone), max(b[2] + b[4] for b in zone),
            (min(b[1] for b in coeur), min(b[2] for b in coeur), max(b[1] + b[3] for b in coeur), max(b[2] + b[4] for b in coeur)))


def main(pdf, dossier, flieux, sortie, quoi, par=8):
    par = int(par)
    L = json.load(open(flieux, encoding='utf8'))
    ids = set(quoi.split(',')) if ',' in quoi or quoi.startswith(('cp-', 'cpp-')) else None
    choix = [x for x in L if (x['id'] in ids if ids else x['classe'] == quoi)]
    os.makedirs(sortie, exist_ok=True)
    cache = os.path.join(sortie, '_pages')
    os.makedirs(cache, exist_ok=True)
    police = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf', 30)
    vignettes = []
    perdus = []
    for x in choix:
        p = x['page']
        f = os.path.join(cache, f'p{p:03d}.png')
        if not os.path.exists(f):
            subprocess.run(['pdftoppm', '-f', str(p), '-l', str(p), '-r', '200', '-gray', '-png', '-singlefile', pdf, f[:-4]], check=True)
        im = Image.open(f)
        z = localiser(tsv(dossier, p), x)
        if z is None:
            perdus.append(x['id'])
            continue
        k = 200 / 300  # boîtes TSV à 300 ppp, image à 200
        y1, y2 = max(0, int(z[0] * k) - 30), min(im.height, int(z[1] * k) + 30)
        crop = im.convert('RGB').crop((0, y1, im.width, y2))
        bx1, by1, bx2, by2 = (int(c * k) for c in z[2])
        ImageDraw.Draw(crop).rectangle((bx1 - 8, by1 - y1 - 6, bx2 + 8, by2 - y1 + 6), outline=(220, 0, 0), width=3)
        v = Image.new('RGB', (im.width, crop.height + 46), (255, 255, 255))
        ImageDraw.Draw(v).text((10, 6), f"{x['id']} · Opus [{x['opus']}] · Tesseract [{x['tesseract']}]", fill=0, font=police)
        v.paste(crop, (0, 46))
        vignettes.append(v)
    n = 0
    for i in range(0, len(vignettes), par):
        lot = vignettes[i:i + par]
        planche = Image.new('RGB', (max(v.width for v in lot), sum(v.height + 10 for v in lot)), (255, 255, 255))
        y = 0
        for v in lot:
            planche.paste(v, (0, y))
            y += v.height + 10
        n += 1
        planche.save(os.path.join(sortie, f'planche-{n:02d}.png'))
    print(f'{len(choix)} lieux, {len(vignettes)} vignettes en {n} planche(s) ; non localisés : {perdus or "aucun"}')


if __name__ == '__main__':
    main(*sys.argv[1:])
