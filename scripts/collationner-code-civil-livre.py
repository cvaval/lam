#!/usr/bin/env python3
"""COLLATION DU CODE CIVIL — phase 1 : le LIVRE, ligne de loi par ligne de loi. LECTURE SEULE.
Prompt : docs/prompt-audit-code-civil-mot-a-mot.md (§ 7, étapes 1-3).

Pour chaque page du Code (index 23-412) :
  1. la GÉOMÉTRIE vient de la couche texte du PDF (fiable pour la mise en page, pas pour les mots) :
     on y retient les lignes de LOI — corps 9,2-11,2 pt, non centrées (les intitulés le sont), têtes
     « Art. N » comprises, énumérations en retrait comprises (art. 452 : retrait ≈ 40 pt) ; notes
     (7,1-7,3), encadrés (≈ 8,2), gloses et titres courants sont exclus ;
  2. les MOTS viennent de Tesseract (`fra`) lisant l'image à 300 dpi sur laquelle tout ce qui n'est
     pas une ligne de loi a été BLANCHI : il ne peut ni mêler les colonnes de notes ni lire un encadré ;
  3. chaque mot reconnu est rendu à sa ligne de loi par recouvrement de boîtes.

Sortie : <dossier>/livre.json — une entrée par ligne : page, folio, boîte, corps, part d'italique,
texte Acrobat (témoin de structure), texte Tesseract (témoin de mots), retrait et marges.

    python3 scripts/collationner-code-civil-livre.py "<Code Civil.pdf>" <dossier de travail> [--pages 23-412]

⚠️ Aucune image n'est écrite dans le dépôt (§ 0 du prompt) : le dossier de travail doit être hors de
`lam-veritab/`.
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
P0, P1 = 23, 412
if '--pages' in sys.argv:
    P0, P1 = map(int, sys.argv[sys.argv.index('--pages') + 1].split('-'))
DPI = 300
K = DPI / 72
HEAD = re.compile(r'^[\W_]{0,3}A\s*r\s*[tlrfi1]\W{0,3}\s*(\S{1,12})', re.I)
ITAL = ('Italic', 'Oblique')


def lignes_de_loi(page):
    """Lignes de loi de la page (repère PDF), fusionnées par ligne de base."""
    brutes = []
    for b in page.get_text('dict')['blocks']:
        for l in b.get('lines', []):
            sp = [s for s in l['spans'] if s['text'].strip()]
            if not sp:
                continue
            tot = sum(len(s['text']) for s in sp)
            brutes.append({
                'x0': l['bbox'][0], 'y0': l['bbox'][1], 'x1': l['bbox'][2], 'y1': l['bbox'][3],
                'sz': sum(s['size'] * len(s['text']) for s in sp) / tot,
                'ital': sum(len(s['text']) for s in sp if any(k in s['font'] for k in ITAL)) / tot,
                'gras': sum(len(s['text']) for s in sp if 'Bold' in s['font']) / tot,
                'acrobat': ''.join(s['text'] for s in l['spans']).strip(),
                'spans': [(s['size'], s['font'], s['text']) for s in sp],
            })
    brutes.sort(key=lambda r: (round(r['y1']), r['x0']))
    fus = []
    for r in brutes:  # un renvoi en italique forme souvent une « ligne » séparée sur la même ligne de base
        f = fus[-1] if fus else None
        if f and abs(r['y1'] - f['y1']) < 3.5 and r['sz'] > 8.3 and f['sz'] > 8.3 and r['x0'] > f['x1'] - 5:
            n0, n1 = len(f['acrobat']), len(r['acrobat'])
            f['ital'] = (f['ital'] * n0 + r['ital'] * n1) / max(n0 + n1, 1)
            f['sz'] = (f['sz'] * n0 + r['sz'] * n1) / max(n0 + n1, 1)
            f['x1'] = max(f['x1'], r['x1'])
            f['y0'] = min(f['y0'], r['y0'])
            f['acrobat'] += ' ' + r['acrobat']
            f['spans'] += r['spans']
            continue
        fus.append(dict(r))
    larges = [r for r in fus if 9.2 <= r['sz'] <= 11.2 and len(r['acrobat']) > 40]
    xs = collections.Counter(round(r['x0']) for r in larges)
    cand = [k for k, v in xs.items() if v >= max(1, xs.most_common(1)[0][1] // 3)] if xs else []
    marge = (min(cand) if cand else 46) - 1.5
    droite = collections.Counter(round(r['x1']) for r in larges).most_common(1)[0][0] if larges else 366
    # ENCADRÉS (textes connexes : Constitution, loi de 1954…) : bornés par deux filets horizontaux longs.
    # Certains sont composés presque au corps de la loi — la taille ne suffit pas à les écarter.
    filets = sorted({round(dr['rect'].y0) for dr in page.get_drawings()
                     if dr['rect'].width > 200 and dr['rect'].height < 2.5 and 45 < dr['rect'].y0 < 575})
    def retraits_pres(y, dessous):
        zone = [r for r in fus if (y < r['y0'] < y + 30) if dessous] if dessous else [r for r in fus if y - 30 < r['y1'] < y]
        return [r['x0'] - marge for r in zone]
    zones = []
    i = 0
    while i < len(filets):
        if i + 1 < len(filets) and filets[i + 1] - filets[i] > 10:
            zones.append((filets[i], filets[i + 1]))
            i += 2
            continue
        y = filets[i]  # filet orphelin : encadré coupé par le saut de page
        if any(8 <= x <= 18 for x in retraits_pres(y, True)):
            zones.append((y, 600))
        elif any(8 <= x <= 18 for x in retraits_pres(y, False)):
            zones.append((40, y))
        i += 1
    folio = None
    out = []
    for r in fus:
        if any(a - 1 <= (r['y0'] + r['y1']) / 2 <= b + 1 for a, b in zones):
            continue
        t = r['acrobat']
        if r['y0'] > 570 and re.fullmatch(r'\d{1,3}', t):
            folio = int(t)
            continue
        if r['y0'] < 40 and r['sz'] < 7.5:
            continue  # titre courant
        # « Art. 19 » en gras 8,9-9,7 suivi d'« Abrogé par… » en italique 7,7 : la moyenne passe sous 8,3,
        # c'est le corps de la TÊTE qui compte.
        corps_tete = max((sz for sz, f, tx in r['spans'] if re.match(r'^\W{0,2}A\s*r', tx) or re.match(r'^\d', tx.strip())), default=0)
        tete = bool(HEAD.match(t)) and r['x0'] < marge + 8 and (r['sz'] > 8.3 or corps_tete > 8.5)
        retrait = r['x0'] - marge
        centre = retrait > 18 and abs(retrait - (droite - r['x1'])) < 14
        # Le corps se juge sur la partie ROMAINE : « mise en chiffres.- » (9,5) suivi d'un renvoi en petit
        # italique (8,2) donne une moyenne de 8,8 — la ligne est pourtant du texte de loi.
        # (moyenne pondérée de la partie romaine — son MAXIMUM laissait passer les encadrés grisés, dont un
        # mot sur dix sort à 9,4 pt)
        rom = [(sz, len(tx)) for sz, f, tx in r['spans'] if not any(k in f for k in ITAL)]
        romain_moy = sum(a * b for a, b in rom) / max(sum(b for _, b in rom), 1) if rom else 0
        # …et sur le PREMIER mot : une ligne de loi en italique dont le renvoi décroît de 10,4 à 7,2 pt
        # (« charges.- c. civ., 1277. », art. 1309) fait une moyenne de 9,1.
        premier = r['spans'][0][0] if r['spans'] else 0
        corps_loi = (9.2 <= r['sz'] <= 11.2 or 9.2 <= romain_moy <= 11.2
                     or (r['ital'] > 0.6 and 9.2 <= premier <= 11.2))
        # Encadré sans cadre vectoriel (le cadre est dans l'image numérisée, index 220, 317…) : texte en
        # retrait de 10-18 pt, corps < 9,2. La suite d'un item d'énumération est en retrait ≈ 21, au corps de la loi.
        if 9.5 <= retrait <= 18 and r['sz'] < 9.2 and not r['ital'] > 0.6:
            continue
        abroge_tete = tete and re.search('Abrog', t)  # « Art. 140 Abrogé par… » : mention en petit corps
        # ligne de renvoi seule (suite d'une liste « C. civ., … » passée à la ligne), en petit italique
        renvoi = (r['ital'] > 0.8 and 6.8 <= r['sz'] < 9.2 and retrait < 30 and out
                  and r['y0'] - out[-1]['y1'] < 6 and re.match(r'^\W{0,2}(C\.|c\.|e\.|Civ|civ|Const|\d|s\b|et s)', t))
        if not (corps_loi or abroge_tete or renvoi) or (centre and not tete) or retrait > 60:
            continue
        if t.isupper() and len(t) > 6 and not tete:
            continue  # intitulé en capitales
        if r['gras'] > 0.5 and not tete:
            continue  # intitulé en casse mixte (« Des successions déférées… ») : composé en gras
        # Part d'italique du TEXTE DE LOI seul : le renvoi de l'éditeur (« .- C. civ., … », petit italique en
        # fin de ligne) en est retiré — sinon toute ligne à renvoi passe pour « partiellement italique ».
        loi_spans = []
        for k, (sz_, f_, tx_) in enumerate(r['spans']):
            prec = ''.join(x[2] for x in r['spans'][:k]).rstrip()
            if re.match(r'^\s*(C\.|c\.|Civ|civ|e\.|Const)', tx_) and (prec.endswith('-') or prec.endswith('.') or not prec):
                break
            if any(kk in f_ for kk in ITAL) and sz_ < 9.0 and prec.endswith('-'):
                break
            loi_spans.append((sz_, f_, tx_))
        nl = sum(len(x[2].strip()) for x in loi_spans)
        ital_loi = (sum(len(x[2].strip()) for x in loi_spans if any(kk in x[1] for kk in ITAL)) / nl) if nl else 0
        mots_ital = [x[2].strip() for x in loi_spans if any(kk in x[1] for kk in ITAL) and x[2].strip()]
        out.append({**{k: r[k] for k in ('x0', 'y0', 'x1', 'y1', 'sz', 'ital', 'gras', 'acrobat')},
                    'ital_loi': round(ital_loi, 3), 'mots_ital': mots_ital[:12],
                    'tete': tete, 'retrait': round(retrait, 1), 'marge': round(marge, 1), 'droite': droite})
    return out, folio


def ocr_page(idx):
    doc = fitz.open(PDF)
    page = doc[idx - 1]
    lignes, folio = lignes_de_loi(page)
    if not lignes:
        return idx, folio, []
    pix = page.get_pixmap(matrix=fitz.Matrix(K, K), colorspace=fitz.csGRAY)
    img = Image.frombytes('L', (pix.width, pix.height), pix.samples)
    masque = Image.new('L', img.size, 255)
    for l in lignes:
        box = (max(0, int((l['x0'] - 2) * K)), max(0, int((l['y0'] - 1.5) * K)),
               min(img.width, int((l['x1'] + 2) * K)), min(img.height, int((l['y1'] + 1.5) * K)))
        masque.paste(img.crop(box), box[:2])
    with tempfile.TemporaryDirectory() as tmp:
        png = os.path.join(tmp, 'p.png')
        masque.save(png, dpi=(DPI, DPI))
        subprocess.run(['tesseract', png, os.path.join(tmp, 'o'), '-l', 'fra', '--psm', '4', 'hocr'],
                       check=True, capture_output=True)
        hocr = open(os.path.join(tmp, 'o.hocr'), encoding='utf-8').read()
    mots = []
    for w in ET.fromstring(hocr.encode('utf-8')).iter():
        if w.get('class') == 'ocrx_word' and (w.text or ''.join(w.itertext())).strip():
            m = re.search(r'bbox (\d+) (\d+) (\d+) (\d+)', w.get('title', ''))
            conf = re.search(r'x_wconf (\d+)', w.get('title', ''))
            x0, y0, x1, y1 = (int(v) / K for v in m.groups())
            mots.append({'x0': x0, 'y0': y0, 'x1': x1, 'y1': y1, 't': ''.join(w.itertext()).strip(),
                         'c': int(conf.group(1)) if conf else -1})
    for l in lignes:
        l['mots'] = []
    for w in mots:
        cy = (w['y0'] + w['y1']) / 2
        best = None
        for i, l in enumerate(lignes):
            if l['y0'] - 2 <= cy <= l['y1'] + 2 and l['x0'] - 4 <= (w['x0'] + w['x1']) / 2 <= l['x1'] + 4:
                d = abs(cy - (l['y0'] + l['y1']) / 2)
                if best is None or d < best[0]:
                    best = (d, i)
        if best:
            lignes[best[1]]['mots'].append(w)
    for l in lignes:
        l['mots'].sort(key=lambda w: w['x0'])
        l['tesseract'] = ' '.join(w['t'] for w in l['mots'])
        l['conf_min'] = min((w['c'] for w in l['mots']), default=-1)
        del l['mots']
        l['page'] = idx
        l['folio'] = folio
    return idx, folio, lignes


if __name__ == '__main__':
    os.makedirs(WORK, exist_ok=True)
    with multiprocessing.Pool(min(12, os.cpu_count() or 4)) as pool:
        res = sorted(pool.map(ocr_page, range(P0, P1 + 1)))
    lignes = [l for _, _, ls in res for l in ls]
    json.dump(lignes, open(os.path.join(WORK, 'livre.json'), 'w', encoding='utf-8'), ensure_ascii=False)
    folios = collections.Counter(idx - f for idx, f, _ in res if f)
    print(f'pages {P0}-{P1} : {len(lignes)} lignes de loi ; têtes {sum(1 for l in lignes if l["tete"])} ; '
          f'décalage index − folio : {dict(folios)}')
