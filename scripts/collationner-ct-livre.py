#!/usr/bin/env python3
"""COLLATION DU CODE DU TRAVAIL — phase 1 : le LIVRE, ligne de loi par ligne de loi. LECTURE SEULE.
Prompt : docs/prompt-audit-code-du-travail-mot-a-mot.md (§ 3, § 7 étape 1). Adapté de collationner-cpc-livre.py.

Le fac-similé (J.-F. Salès, 1992, 462 p.) compose chaque page sur UNE colonne, sans notes de marge. La couche texte
(Acrobat Paper Capture) sépare les strates par la police et le corps :
  - loi : Times romain 11,6-12,5 pt ; têtes « Article N. » en Times gras (graisse souvent perdue) ;
  - arrêts : intitulé « 3. Arrêt du … » en Times ≈ 10,3 ; extrait en Helvetica oblique ≈ 7,9 ;
  - intitulés : Helvetica gras 13-16 (« Chapitre VI », « Du préavis ou délai congé », « TITRE I ») ;
  - titres courants (« Code du Travail annoté », « Me. Jean-Frédéric Salès ») en Helvetica oblique ≈ 9,5, folio en pied ;
  - filets décoratifs que l'OCR lit comme des chaînes de 4-6 pt.
Un ALINÉA se repère au RETRAIT de sa première ligne (x + 18-22 pt), pas à l'interligne ; un point d'énumération
(« a) », « 1°) », « • ») a son marqueur à ≈ + 20 et sa suite en retrait suspendu (≈ + 36).

Pour chaque page :
  1. la GÉOMÉTRIE vient de la couche texte ; le bord gauche de la loi se mesure PAGE PAR PAGE (pages paires et impaires
     n'ont pas la même marge) ;
  2. les MOTS viennent de Tesseract (`fra`) sur l'image à 300 dpi où tout ce qui n'est pas une ligne de loi a été
     BLANCHI ;
  3. chaque mot est rendu à sa ligne par recouvrement de boîtes.

Sortie : <dossier>/livre.json — {lignes: [...], intitules: [...]} ; chaque ligne porte `page` (index PDF) et `passage`
(1 ; 2 pour le second scan des folios 213-258, PDF 274-319, § 3).

    /usr/bin/python3 scripts/collationner-ct-livre.py "<code_du_travail.pdf>" <dossier> [--pages 18-237] [--passage2 274-281]

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
P0, P1 = 18, 237
if '--pages' in sys.argv:
    P0, P1 = map(int, sys.argv[sys.argv.index('--pages') + 1].split('-'))
Q0, Q1 = None, None
if '--passage2' in sys.argv:
    Q0, Q1 = map(int, sys.argv[sys.argv.index('--passage2') + 1].split('-'))
DPI = 300
K = DPI / 72
ITAL = ('Italic', 'Oblique')
# Tête : « Article » + numéro + point (« Article 44. »). La graisse ne sert pas : la couche la perd souvent.
TETE = re.compile(r'^\W{0,2}Ar\s*t\s*[il1]\s*c\s*[l1I]\s*e\s*(?:[lI1]\s*er|[\dIlO][\dSOolI]{0,3})\s*[.,:]')
INTITULE = re.compile(r'^\W{0,2}(?:Titre|TITRE|Section|SECTION|Chapitre|CHAPITRE|LOI\s+No|Loi\s+No|ANNEXE)\b')


def spans_lignes(page):
    out = []
    for b in page.get_text('dict')['blocks']:
        for l in b.get('lines', []):
            sp = [s for s in l['spans'] if s['text'].strip()]
            if sp:
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
    """Lignes de loi et intitulés de la page, dans l'ordre de lecture."""
    H = page.rect.height
    brutes = [r for r in spans_lignes(page) if r['sz'] >= 7.0]  # filets décoratifs (4-6 pt)
    # Bord gauche de la LOI : le mode des débuts de lignes romaines longues (les lignes de suite d'un alinéa).
    # ⚠️ Sur une page faite d'énumérations (art. 30, 31, 93…), les lignes longues commencent presque toutes au marqueur
    # « a) » : leur mode n'est PAS la marge. La marge est l'abscisse la plus à gauche que portent au moins deux lignes.
    xs = collections.Counter(round(r['x0']) for r in brutes if r['times'] > 0.6 and r['ital'] < 0.2
                             and 11.0 <= r['sz'] <= 13.4 and len(r['acrobat']) >= 5)
    bord = None
    if xs:
        tri = sorted(xs)
        bord = next((k for k in tri if sum(v for x, v in xs.items() if abs(x - k) <= 2) >= 2), tri[0])
    # Fusion sur la ligne de base : une ligne Acrobat se coupe parfois en morceaux (tête en gras + suite en romain).
    brutes.sort(key=lambda r: r['y1'])
    groupes = []
    for r in brutes:
        g = groupes[-1] if groupes else None
        if g and abs(r['y1'] - g[0]['y1']) < 3.5:
            g.append(r)
        else:
            groupes.append([r])
    fus = []
    for g in groupes:
        g.sort(key=lambda x: x['x0'])
        f = dict(g[0])
        for r in g[1:]:
            if r['x0'] > f['x1'] + 40 or abs(r['sz'] - f['sz']) > 3.5:
                fus.append(f)
                f = dict(r)
                continue
            n0, n1 = len(f['acrobat']), len(r['acrobat'])
            for k in ('ital', 'gras', 'times', 'sz'):
                f[k] = (f[k] * n0 + r[k] * n1) / max(n0 + n1, 1)
            f['x1'] = max(f['x1'], r['x1'])
            f['y0'] = min(f['y0'], r['y0'])
            f['acrobat'] += ' ' + r['acrobat']
        fus.append(f)
    lignes, intitules = [], []
    for r in fus:
        t = r['acrobat']
        if r['y0'] < 70 and r['ital'] > 0.5:
            continue  # titre courant
        if r['y0'] > H - 55:
            continue  # pied de page : folio, rubrique
        # Extrait d'arrêt (Helvetica oblique ≈ 7,9) et rubrique « Jurisprudence » : écartés. ⚠️ Le Times ITALIQUE au corps
        # de la loi est du texte du Code : mentions d'abrogation « (Abrogé par le Décret du 7 novembre 1985… », citation
        # du décret du 23 mai 1989 à l'art. 110 — les écarter faisait perdre les têtes des art. 109 à 111.
        if r['ital'] > 0.5 and (r['sz'] < 10.8 or r['times'] < 0.5):
            continue
        tete = bool(TETE.match(t))
        if not tete and (INTITULE.match(t) or (r['gras'] > 0.5 and r['times'] < 0.5 and r['sz'] >= 12.0)):
            intitules.append({**{k: round(r[k], 1) for k in ('x0', 'y0', 'x1', 'y1', 'sz')}, 'acrobat': t})
            continue
        if not tete and not (11.0 <= r['sz'] <= 13.6):
            continue  # intitulés d'arrêts (≈ 10,3), notes
        if not tete and r['times'] < 0.3 and r['gras'] > 0.5:
            intitules.append({**{k: round(r[k], 1) for k in ('x0', 'y0', 'x1', 'y1', 'sz')}, 'acrobat': t})
            continue
        if bord is None:
            continue
        lignes.append({**{k: round(r[k], 2) for k in ('x0', 'y0', 'x1', 'y1', 'sz', 'gras')}, 'acrobat': t,
                       'tete': tete, 'retrait': round(r['x0'] - bord, 1), 'bord': bord})
    # Bord droit (ligne justifiée), pour juger une ligne « courte ».
    x1s = collections.Counter(round(l['x1']) for l in lignes)
    d = x1s.most_common(1)[0][0] if x1s else None
    for l in lignes:
        l['droite'] = d
    return sorted(lignes, key=lambda r: r['y0']), sorted(intitules, key=lambda r: r['y0'])


def sans_couche(page, img):
    """Page SANS couche texte (PDF 121 et 181, images seules) : Tesseract lit la page entière ; la HAUTEUR de ligne
    (`x_size`) sépare la loi (≈ 45-52 px à 300 dpi, corps 12) des extraits d'arrêts (≈ 33) et du titre courant (≈ 36).
    Pas de second témoin sur ces pages : tout écart y est « à regarder »."""
    with tempfile.TemporaryDirectory() as tmp:
        png = os.path.join(tmp, 'p.png')
        img.save(png, dpi=(DPI, DPI))
        subprocess.run(['tesseract', png, os.path.join(tmp, 'o'), '-l', 'fra', '--psm', '4', 'hocr'], check=True, capture_output=True)
        hocr = open(os.path.join(tmp, 'o.hocr'), encoding='utf-8').read()
    H = page.rect.height
    brutes = []
    for e in ET.fromstring(hocr.encode('utf-8')).iter():
        if e.get('class') not in ('ocr_line', 'ocr_textfloat', 'ocr_header', 'ocr_caption'):
            continue
        t = ' '.join(''.join(w.itertext()).strip() for w in e.iter() if w.get('class') == 'ocrx_word').strip()
        ti = e.get('title', '')
        bb = [int(v) / K for v in re.search(r'bbox (\d+) (\d+) (\d+) (\d+)', ti).groups()]
        xs = re.search(r'x_size ([\d.]+)', ti)
        if t and xs and float(xs.group(1)) >= 43 and 70 <= bb[1] <= H - 55:
            brutes.append({'x0': bb[0], 'y0': bb[1], 'x1': bb[2], 'y1': bb[3], 't': t})
    xs_ = collections.Counter(round(r['x0']) for r in brutes if len(r['t']) > 30)
    if not xs_:
        return [], []
    top = xs_.most_common(1)[0][1]
    bord = min(k for k, v in xs_.items() if v >= max(1, top // 3))
    lignes, intitules = [], []
    for i, r in enumerate(brutes):
        nxt = brutes[i + 1]['t'] if i + 1 < len(brutes) else ''
        tete = bool(TETE.match(r['t']))
        if not tete and (INTITULE.match(r['t']) or (len(r['t']) < 50 and not re.search(r'[.;:,]$', r['t']) and TETE.match(nxt) and r['x0'] - bord > 12)):
            intitules.append({'x0': r['x0'], 'y0': r['y0'], 'x1': r['x1'], 'y1': r['y1'], 'sz': 12.0, 'acrobat': r['t']})
            continue
        lignes.append({'x0': r['x0'], 'y0': r['y0'], 'x1': r['x1'], 'y1': r['y1'], 'sz': 12.0, 'gras': 0.0, 'acrobat': '',
                       'tesseract': r['t'], 'conf_min': -1, 'tete': tete, 'retrait': round(r['x0'] - bord, 1), 'bord': bord,
                       'sans_couche': True})
    d = collections.Counter(round(l['x1']) for l in lignes).most_common(1)[0][0] if lignes else None
    for l in lignes:
        l['droite'] = d
    return lignes, intitules


def ocr_page(arg):
    idx, passage = arg
    doc = fitz.open(PDF)
    page = doc[idx - 1]
    if len(page.get_text('text').strip()) < 50:
        pix = page.get_pixmap(matrix=fitz.Matrix(K, K), colorspace=fitz.csGRAY)
        lignes, intitules = sans_couche(page, Image.frombytes('L', (pix.width, pix.height), pix.samples))
        for x in lignes + intitules:
            x['page'], x['passage'] = idx, passage
        return idx, lignes, intitules
    lignes, intitules = classer(page)
    for x in intitules:
        x['page'], x['passage'] = idx, passage
    if not lignes:
        return idx, [], intitules
    pix = page.get_pixmap(matrix=fitz.Matrix(K, K), colorspace=fitz.csGRAY)
    img = Image.frombytes('L', (pix.width, pix.height), pix.samples)
    for l in lignes:
        l['mots'] = []
    X0 = max(0, int((min(l['x0'] for l in lignes) - 3) * K))
    X1 = min(img.width, int((max(l['x1'] for l in lignes) + 3) * K))
    Y0 = max(0, int((min(l['y0'] for l in lignes) - 3) * K))
    Y1 = min(img.height, int((max(l['y1'] for l in lignes) + 3) * K))
    masque = Image.new('L', (X1 - X0, Y1 - Y0), 255)
    for l in lignes:
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
        for i, l in enumerate(lignes):
            if l['y0'] - 2 <= cy <= l['y1'] + 2 and l['x0'] - 6 <= cx <= l['x1'] + 6:
                dd = abs(cy - (l['y0'] + l['y1']) / 2)
                if best is None or dd < best[0]:
                    best = (dd, i)
        if best:
            lignes[best[1]]['mots'].append({'x0': x0, 't': ''.join(w.itertext()).strip(), 'c': int(conf.group(1)) if conf else -1})
    for l in lignes:
        l['mots'].sort(key=lambda w: w['x0'])
        l['tesseract'] = ' '.join(w['t'] for w in l['mots'])
        l['conf_min'] = min((w['c'] for w in l['mots']), default=-1)
        del l['mots']
        l['page'], l['passage'] = idx, passage
    return idx, lignes, intitules


if __name__ == '__main__':
    os.makedirs(WORK, exist_ok=True)
    taches = [(i, 1) for i in range(P0, P1 + 1)] + ([(i, 2) for i in range(Q0, Q1 + 1)] if Q0 else [])
    with multiprocessing.Pool(min(10, os.cpu_count() or 4)) as pool:
        res = sorted(pool.map(ocr_page, taches), key=lambda r: r[0])
    out = {'lignes': [l for _, ls, _ in res for l in ls], 'intitules': [x for _, _, xs in res for x in xs]}
    json.dump(out, open(os.path.join(WORK, 'livre.json'), 'w', encoding='utf-8'), ensure_ascii=False)
    p1 = [l for l in out['lignes'] if l['passage'] == 1]
    print(f"pages {P0}-{P1}{f' + {Q0}-{Q1} (2e passage)' if Q0 else ''} : {len(p1)} lignes de loi (1er passage) ; "
          f"têtes {sum(1 for l in p1 if l['tete'])} ; intitulés {sum(1 for x in out['intitules'] if x['passage'] == 1)}")
