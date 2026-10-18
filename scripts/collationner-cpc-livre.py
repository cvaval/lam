#!/usr/bin/env python3
"""COLLATION DU CODE DE PROCÉDURE CIVILE — phase 1 : le LIVRE, ligne de loi par ligne de loi. LECTURE SEULE.
Prompt : docs/prompt-audit-code-procedure-civile-mot-a-mot.md (§ 7, étapes 1-3).

Le fac-similé (éd. 2013, 567 p.) compose chaque page sur DEUX COLONNES, chacune précédée d'une bande de
NOTES DE MARGE (« Art 62 fr », « Anc art 72 »). La couche texte (Acrobat Paper Capture) sépare bien les strates :
  - loi : Times romain 10-12,8 pt ; têtes « Article N.- » en Times gras ;
  - jurisprudence : Helvetica oblique ≈ 10 pt, parfois Times italique 11 ;
  - intitulés : Times gras (« Titre II.- … »), « LIVRE … » en Times italique ≈ 13 ;
  - notes de bas de page de l'éditeur : Times romain ≈ 7,9 ; titres courants, folios : Helvetica 7-8.
Pour chaque page du Code (index 17-284) :
  1. la GÉOMÉTRIE vient de la couche texte (fiable pour la mise en page, pas pour les mots) ; les colonnes se
     localisent PAGE PAR PAGE (le scan bouge) ;
  2. les MOTS viennent de Tesseract (`fra`), colonne par colonne, sur l'image à 300 dpi où tout ce qui n'est
     pas une ligne de loi a été BLANCHI : il ne peut lire ni la jurisprudence ni les notes de marge ;
  3. chaque mot est rendu à sa ligne de loi par recouvrement de boîtes.
Les intitulés et les notes de marge sont relevés à part (texte Acrobat) pour les contrôles des § 6.3-6.4.

Sortie : <dossier>/livre.json — {lignes: [...], intitules: [...], marges: [...]}.

    python3 scripts/collationner-cpc-livre.py "<Code_procedure_civile-pdf.pdf>" <dossier> [--pages 17-284]

⚠️ Aucune image n'est écrite dans le dépôt (§ 0) : le dossier de travail est hors de `lam-veritab/`.
"""
import collections
import json
import multiprocessing
import os
import re
import subprocess
import sys
import tempfile
import xml.etree.ElementTree as ET

import fitz
from PIL import Image

PDF, WORK = sys.argv[1], sys.argv[2]
P0, P1 = 17, 284
if '--pages' in sys.argv:
    P0, P1 = map(int, sys.argv[sys.argv.index('--pages') + 1].split('-'))
DPI = 300
K = DPI / 72
ITAL = ('Italic', 'Oblique')
MARGE = re.compile(r'^\W{0,2}(?:Art\.?\s*\d|A[nm][ce]\.?\s*art|Abr\b|Conc|Mod\b|Cf\.)', re.I)
# Tête : « Article » (A capital) + numéro (1er, 957-1…) + « .- », ou la marque de modification « (L. 12 sept 1966) ».
# La graisse ne sert pas : la couche OCR la perd sur deux têtes sur trois.
TETE = re.compile(r'^\W{0,2}Ar\s*t\s*[il1]\s*c\s*[l1I]\s*e\s*(?:[lI1]\s*er|[\dIlO][\dSOolI]{0,3})(?:\s*[-.]\s*\d{1,2})?\s*(?:\(|[.,:]?\s*[-–—])')
MARGE_SEULE = re.compile(r'^\W{0,2}(?:Art\.?\s*\d{1,4}\s*(?:fr|[a-z]{1,3})?|A[nm][ce]\.?\s*art\.?\s*[\dSOolI]{1,4}|Abr\b.{0,30})\W{0,2}$', re.I)


def spans_lignes(page):
    out = []
    for b in page.get_text('dict')['blocks']:
        for l in b.get('lines', []):
            sp0 = [s for s in l['spans'] if s['text'].strip()]
            if not sp0:
                continue
            # La couche range parfois la note de marge et la tête dans UNE ligne (« Ane art 22 Article 18 (Mod. … ») :
            # on coupe au fragment qui commence par « Article », s'il est séparé du précédent par la bande blanche.
            morceaux, cour = [], []
            for s in sp0:
                if cour and re.match(r'^\W{0,2}Article\b', s['text'].lstrip()) and s['bbox'][0] - cour[-1]['bbox'][2] > 4:
                    morceaux.append(cour)
                    cour = []
                cour.append(s)
            morceaux.append(cour)
            for sp in morceaux:
                out.append(_ligne(sp))
    return out


def _ligne(sp):
    tot = sum(len(s['text']) for s in sp)
    bx = [s['bbox'] for s in sp]
    return {
        'x0': min(x[0] for x in bx), 'y0': min(x[1] for x in bx), 'x1': max(x[2] for x in bx), 'y1': max(x[3] for x in bx),
        'sz': sum(s['size'] * len(s['text']) for s in sp) / tot,
        'ital': sum(len(s['text']) for s in sp if any(k in s['font'] for k in ITAL)) / tot,
        'gras': sum(len(s['text']) for s in sp if 'Bold' in s['font']) / tot,
        'times': sum(len(s['text']) for s in sp if s['font'].startswith('Times')) / tot,
        'acrobat': ''.join(s['text'] for s in sp).strip(),
    }


def classer(page):
    """Lignes de loi, intitulés et notes de marge de la page, par colonne, dans l'ordre de lecture."""
    W = page.rect.width
    brutes = spans_lignes(page)
    for r in brutes:
        r['col'] = 0 if (r['x0'] + r['x1']) / 2 < W / 2 else 1
        # La note de marge de la colonne DROITE est composée juste après la fin des lignes de gauche (x ≈ 285-340) :
        # son centre tombe à gauche du milieu de page, elle appartient pourtant à la colonne droite.
        if MARGE_SEULE.match(r['acrobat']) and r['x0'] > W / 2 - 70:
            r['col'] = 1
    # Bord gauche de la LOI dans chaque colonne — calculé AVANT toute fusion : le mode des débuts des lignes
    # romaines longues (une ligne fondue avec sa note de marge commencerait dans la marge).
    bord = {}
    for c in (0, 1):
        xs = collections.Counter(round(r['x0']) for r in brutes if r['col'] == c and r['times'] > 0.6 and r['ital'] < 0.2
                                 and 10 <= r['sz'] <= 12.8 and len(r['acrobat']) > 25 and not MARGE.match(r['acrobat']))
        if xs:
            top = xs.most_common(1)[0][1]
            bord[c] = min(k for k, v in xs.items() if v >= max(1, top // 3))
    # Fusion sur la ligne de base, DANS une colonne (une ligne Acrobat se coupe parfois en deux morceaux).
    # ⚠️ Une note de marge ne se fond JAMAIS à la loi qu'elle borde (« D. 22 déc 1858 fr, art 17 » sur trois lignes
    # absorbait la tête de l'art. 19), et une tête « Article N.- » commence toujours une ligne.
    # Lignes de base : on groupe les fragments à ± 3,5 pt, puis on les range par abscisse (une tête en gras a souvent
    # sa ligne de base 1-2 pt plus bas que la suite de la ligne : le tri par y la rejetait après son texte).
    brutes.sort(key=lambda r: (r['col'], r['y1']))
    groupes = []
    for r in brutes:
        g = groupes[-1] if groupes else None
        if g and g[0]['col'] == r['col'] and abs(r['y1'] - g[0]['y1']) < 3.5:
            g.append(r)
        else:
            groupes.append([r])
    brutes = [r for g in groupes for r in sorted(g, key=lambda x: x['x0'])]
    fus = []
    for r in brutes:
        f = fus[-1] if fus else None
        b = bord.get(r['col'])
        en_marge = lambda x: b is not None and x['x1'] < b - 3
        ecart_max = 30 if TETE.match(f['acrobat'] if f else '') else 12  # après « Article 342.- », l'espace est large
        if (f and f['col'] == r['col'] and abs(r['y1'] - f['y1']) < 3.5 and f['x1'] - 5 < r['x0'] < f['x1'] + ecart_max
                and abs(r['sz'] - f['sz']) < 2.5 and not (MARGE.match(f['acrobat']) and len(f['acrobat']) < 22)
                and not en_marge(f) and not TETE.match(r['acrobat']) and not MARGE_SEULE.match(r['acrobat'])):
            n0, n1 = len(f['acrobat']), len(r['acrobat'])
            for k in ('ital', 'gras', 'times', 'sz'):
                f[k] = (f[k] * n0 + r[k] * n1) / max(n0 + n1, 1)
            f['x1'] = max(f['x1'], r['x1'])
            f['y0'] = min(f['y0'], r['y0'])
            f['acrobat'] += ' ' + r['acrobat']
            continue
        fus.append(dict(r))
    lignes, intitules, marges = [], [], []
    for r in fus:
        t = r['acrobat']
        c = r['col']
        if r['y0'] < 50 and r['sz'] < 9:
            continue  # titre courant
        if r['y0'] > 760 and re.fullmatch(r'\W*\d{1,3}\W*', t):
            continue  # folio
        b = bord.get(c)
        if b is None:
            continue
        # Note de marge fondue au début d'une ligne de loi, dans UN fragment de la couche (« Ane art 22 Article 18
        # (Mod. … », « Ane art 368 avant le commencement de la plai- ») : on les sépare au texte.
        # L'OCR écorche la note (« !\\.ne art 192 », « ~c art 175 », « ne art 194 ») : on se fie à « art N » en tête
        # d'une ligne qui COMMENCE dans la bande de marge.
        mm = re.match(r'^(.{0,8}?(?:A[nm][ce]\.?\s*|\b)art\.?\s*[\dSOolI$]{1,4}(?:\s*fr)?[,.;]?)\s+(\S.*)$', t, re.I)  # « Ancart353 mé… »
        if mm and r['x0'] < b - 8:
            marges.append({**{k: round(r[k], 1) for k in ('x0', 'y0', 'x1', 'y1')}, 'col': c, 'acrobat': mm.group(1)})
            r = dict(r, acrobat=mm.group(2), x0=float(b))
            t = r['acrobat']
        if r['x1'] < b - 3 and len(t) < 40 and r['sz'] >= 9:
            marges.append({**{k: round(r[k], 1) for k in ('x0', 'y0', 'x1', 'y1')}, 'col': c, 'acrobat': t})
            continue
        if r['ital'] > 0.5:
            # « LIVRE II » et son titre (« Des tribunaux civils ») : italique ≥ 12 pt ; la jurisprudence ≈ 10-11.
            if r['sz'] > 11.8 and r['y0'] > 50:
                intitules.append({**{k: round(r[k], 1) for k in ('x0', 'y0', 'x1', 'y1', 'sz')}, 'col': c, 'acrobat': t})
            continue  # jurisprudence
        if not (9.6 <= r['sz'] <= 13.2):
            continue  # notes de bas de page (≈ 7,9), titres courants
        if r['x0'] < b - 8:
            continue
        # Têtes et intitulés sont en Times gras OU en Helvetica gras selon les pages (OCR) : on juge la graisse.
        if MARGE_SEULE.match(t) and len(t) < 30:
            marges.append({**{k: round(r[k], 1) for k in ('x0', 'y0', 'x1', 'y1')}, 'col': c, 'acrobat': t})
            continue
        tete = bool(TETE.match(t))
        # Intitulé que l'OCR n'a pas mis en gras (« Titre IX.- Des demandes incidentes… », « Section II.- … »).
        if not tete and re.match(r'^\W{0,2}(?:Titre|TITRE|Section|SECTION|Chapitre|CHAPITRE|LIVRE|Livre)\s+(?:[IVXL]{1,6}|Premier|Première|\d{1,2})\b', t):
            intitules.append({**{k: round(r[k], 1) for k in ('x0', 'y0', 'x1', 'y1', 'sz')}, 'col': c, 'acrobat': t})
            continue
        # Référence d'arrêt composée en romain (« Cass. 2ème sect., 25 juil 1967 - Paul Bouquet… ») : appareil.
        if not tete and re.match(r'^\W{0,2}Cass\b', t):
            continue
        if r['gras'] > 0.5 and not tete:
            intitules.append({**{k: round(r[k], 1) for k in ('x0', 'y0', 'x1', 'y1', 'sz')}, 'col': c, 'acrobat': t})
            continue
        lignes.append({**{k: round(r[k], 2) for k in ('x0', 'y0', 'x1', 'y1', 'sz', 'gras')}, 'col': c, 'acrobat': t,
                       'tete': tete, 'retrait': round(r['x0'] - b, 1), 'bord': b})
    # Bord droit de chaque colonne (ligne justifiée), pour juger une ligne « courte ».
    for c in (0, 1):
        x1s = collections.Counter(round(l['x1']) for l in lignes if l['col'] == c)
        d = x1s.most_common(1)[0][0] if x1s else None
        for l in lignes:
            if l['col'] == c:
                l['droite'] = d
    key = lambda r: (r['col'], r['y0'])
    return sorted(lignes, key=key), sorted(intitules, key=key), sorted(marges, key=key)


def ocr_page(idx):
    doc = fitz.open(PDF)
    page = doc[idx - 1]
    lignes, intitules, marges = classer(page)
    for x in intitules + marges:
        x['page'] = idx
    if not lignes:
        return idx, [], intitules, marges
    pix = page.get_pixmap(matrix=fitz.Matrix(K, K), colorspace=fitz.csGRAY)
    img = Image.frombytes('L', (pix.width, pix.height), pix.samples)
    for l in lignes:
        l['mots'] = []
    for c in (0, 1):
        lc = [l for l in lignes if l['col'] == c]
        if not lc:
            continue
        X0 = max(0, int((min(l['x0'] for l in lc) - 3) * K))
        X1 = min(img.width, int((max(l['x1'] for l in lc) + 3) * K))
        Y0 = max(0, int((min(l['y0'] for l in lc) - 3) * K))
        Y1 = min(img.height, int((max(l['y1'] for l in lc) + 3) * K))
        masque = Image.new('L', (X1 - X0, Y1 - Y0), 255)
        for l in lc:
            box = (max(0, int((l['x0'] - 2) * K)), max(0, int((l['y0'] - 1.5) * K)),
                   min(img.width, int((l['x1'] + 2) * K)), min(img.height, int((l['y1'] + 1.5) * K)))
            masque.paste(img.crop(box), (box[0] - X0, box[1] - Y0))
        with tempfile.TemporaryDirectory() as tmp:
            png = os.path.join(tmp, 'p.png')
            masque.save(png, dpi=(DPI, DPI))
            subprocess.run(['tesseract', png, os.path.join(tmp, 'o'), '-l', 'fra', '--psm', '4', 'hocr'],
                           check=True, capture_output=True)
            hocr = open(os.path.join(tmp, 'o.hocr'), encoding='utf-8').read()
        for w in ET.fromstring(hocr.encode('utf-8')).iter():
            if w.get('class') != 'ocrx_word' or not ''.join(w.itertext()).strip():
                continue
            m = re.search(r'bbox (\d+) (\d+) (\d+) (\d+)', w.get('title', ''))
            conf = re.search(r'x_wconf (\d+)', w.get('title', ''))
            x0, y0, x1, y1 = int(m.group(1)) + X0, int(m.group(2)) + Y0, int(m.group(3)) + X0, int(m.group(4)) + Y0
            x0, y0, x1, y1 = x0 / K, y0 / K, x1 / K, y1 / K
            cy, cx = (y0 + y1) / 2, (x0 + x1) / 2
            best = None
            for i, l in enumerate(lc):
                if l['y0'] - 2 <= cy <= l['y1'] + 2 and l['x0'] - 4 <= cx <= l['x1'] + 4:
                    dd = abs(cy - (l['y0'] + l['y1']) / 2)
                    if best is None or dd < best[0]:
                        best = (dd, i)
            if best:
                lc[best[1]]['mots'].append({'x0': x0, 't': ''.join(w.itertext()).strip(), 'c': int(conf.group(1)) if conf else -1})
    for l in lignes:
        l['mots'].sort(key=lambda w: w['x0'])
        l['tesseract'] = ' '.join(w['t'] for w in l['mots'])
        l['conf_min'] = min((w['c'] for w in l['mots']), default=-1)
        del l['mots']
        l['page'] = idx
    return idx, lignes, intitules, marges


if __name__ == '__main__':
    os.makedirs(WORK, exist_ok=True)
    with multiprocessing.Pool(min(10, os.cpu_count() or 4)) as pool:
        res = sorted(pool.map(ocr_page, range(P0, P1 + 1)), key=lambda r: r[0])
    out = {'lignes': [l for _, ls, _, _ in res for l in ls],
           'intitules': [x for _, _, xs, _ in res for x in xs],
           'marges': [x for _, _, _, xs in res for x in xs]}
    json.dump(out, open(os.path.join(WORK, 'livre.json'), 'w', encoding='utf-8'), ensure_ascii=False)
    print(f"pages {P0}-{P1} : {len(out['lignes'])} lignes de loi ; têtes {sum(1 for l in out['lignes'] if l['tete'])} ; "
          f"intitulés {len(out['intitules'])} ; notes de marge {len(out['marges'])}")
