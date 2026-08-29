#!/usr/bin/env python3
"""Appariement extraction .txt -> .docx d'origine, par CONTENU (jamais par nom).
Tolérance : variations de fin de fichier / lignes vides ; on compare la suite des
paragraphes non vides. Rapporte le ratio pour chaque appariement retenu."""
import hashlib, json, os, sys, zipfile, glob, difflib
from xml.etree import ElementTree as ET

W = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'

def paras(path):
    z = zipfile.ZipFile(path)
    root = ET.fromstring(z.read('word/document.xml'))
    out = []
    for p in root.iter(W + 'p'):
        buf = []
        for r in p.iter(W + 'r'):
            rpr = r.find(W + 'rPr')
            barre = False
            if rpr is not None:
                st = rpr.find(W + 'strike')
                if st is not None and st.get(W + 'val') not in ('false', '0'):
                    barre = True
            txt = []
            for n in r.iter():
                if n.tag == W + 't': txt.append(n.text or '')
                elif n.tag == W + 'tab': txt.append('\t')
                elif n.tag in (W + 'br', W + 'cr'): txt.append('\n')
            t = ''.join(txt)
            if t: buf.append('⟦BARRÉ⟧' + t + '⟦/BARRÉ⟧' if barre else t)
        out.append(''.join(buf))
    return out

def canon(lines):
    """suite des lignes non vides, espaces de bord ôtés — clé de contenu robuste"""
    return [l.strip() for l in lines if l.strip()]

def md5f(path):
    h = hashlib.md5()
    with open(path, 'rb') as f:
        for c in iter(lambda: f.read(1 << 20), b''):
            h.update(c)
    return h.hexdigest()

SRC = sys.argv[1]
DL = os.path.expanduser('~/Downloads')

txts = sorted(f for f in os.listdir(SRC) if f.endswith('.txt'))
docxs = [p for p in glob.glob(os.path.join(DL, '*.docx')) if not os.path.basename(p).startswith('~$')]

index = {}   # clé canonique -> [chemins]
canons = {}  # chemin -> canon
for p in docxs:
    try:
        c = canon(paras(p))
    except Exception:
        continue
    canons[p] = c
    index.setdefault(hashlib.md5('\n'.join(c).encode('utf-8')).hexdigest(), []).append(p)

res = {}
for t in txts:
    tp = os.path.join(SRC, t)
    raw = open(tp, encoding='utf-8').read()
    ct = canon(raw.split('\n'))
    key = hashlib.md5('\n'.join(ct).encode('utf-8')).hexdigest()
    cands = index.get(key, [])
    mode, ratio = 'exact-canon', 1.0
    if not cands:
        # repli : meilleur ratio parmi les docx de taille voisine
        best, bp = 0.0, None
        for p, c in canons.items():
            if not c or abs(len(c) - len(ct)) > max(30, 0.25 * len(ct)):
                continue
            r = difflib.SequenceMatcher(None, ct, c, autojunk=False).quick_ratio()
            if r > best:
                best, bp = r, p
        if bp is not None:
            best = difflib.SequenceMatcher(None, ct, canons[bp], autojunk=False).ratio()
        cands, mode, ratio = ([bp] if bp else []), 'meilleur-ratio', round(best, 6)
    res[t] = {
        'md5_txt_fichier': md5f(tp),
        'octets_txt': os.path.getsize(tp),
        'lignes_non_vides': len(ct),
        'mode': mode, 'ratio': ratio,
        'docx': [os.path.basename(p) for p in cands],
        'md5_docx': [md5f(p) for p in cands],
    }

print(json.dumps({'resultats': res, 'nb_docx': len(canons)}, ensure_ascii=False, indent=1))
