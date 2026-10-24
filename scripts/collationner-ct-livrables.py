#!/usr/bin/env python3
"""COLLATION DU CODE DU TRAVAIL — livrables du rapport (§ 8 du prompt d'audit). LECTURE SEULE.
Adapté de collationner-cpc-livrables.py.

Entrées : le dossier d'audit (travail/triangulation.json, lectures/resultat-*.json lus sur l'image, instantane/
corrections-ct.json). Sorties, dans docs/livraison-ct-mot-a-mot/ :
  pages.csv        article → pages PDF du livre, verdict du tri, lu sur l'image (et lot)
  ecarts.csv       un écart lu sur l'image par ligne : nature, base, livre (extraits courts)
  operations.csv   les opérations de correction (type, article, résumé)

⚠️ Le dépôt est PUBLIC : extraits courts (≤ 120 caractères), aucune note de l'éditeur recopiée, aucune image.

    /usr/bin/python3 scripts/collationner-ct-livrables.py <dossier audit-code-travail>
"""
import csv
import glob
import json
import os
import re
import sys

A = sys.argv[1]
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'docs', 'livraison-ct-mot-a-mot')
os.makedirs(OUT, exist_ok=True)
court = lambda s, n=120: (lambda t: t[:n] + ('…' if len(t) > n else ''))(re.sub(r'\s+', ' ', s or '').strip())
cle = lambda s: int(s) if s.isdigit() else 0

T = json.load(open(os.path.join(A, 'travail', 'triangulation.json')))
lus = {}
for f in sorted(glob.glob(os.path.join(A, 'lectures', 'resultat-*.json'))):
    lot = re.search(r'resultat-(\d+)', f).group(1)
    for r in json.load(open(f)):
        lus[str(r['article'])] = dict(r, lot=lot)

with open(os.path.join(OUT, 'pages.csv'), 'w', newline='', encoding='utf-8') as f:
    w = csv.writer(f)
    w.writerow(['article', 'pages_pdf', 'tri', 'lu_sur_image'])
    for n, r in sorted(T.items(), key=lambda x: cle(x[0])):
        w.writerow([n, ' '.join(map(str, r.get('pages', []))), r['verdict'],
                    ('tirage 5 %' if lus[n]['lot'] == '6' else f"lot {lus[n]['lot']}") if n in lus else 'non'])

with open(os.path.join(OUT, 'ecarts.csv'), 'w', newline='', encoding='utf-8') as f:
    w = csv.writer(f)
    w.writerow(['article', 'pages_pdf', 'nature', 'base', 'livre'])
    for n, r in sorted(lus.items(), key=lambda x: cle(x[0])):
        for d in r.get('differences', []):
            if isinstance(d, dict):
                w.writerow([n, ' '.join(map(str, r.get('pages_lues') or [])), d.get('nature'), court(d.get('base')), court(d.get('image'))])

ops = json.load(open(os.path.join(A, 'instantane', 'corrections-ct.json')))['operations']
with open(os.path.join(OUT, 'operations.csv'), 'w', newline='', encoding='utf-8') as f:
    w = csv.writer(f)
    w.writerow(['type', 'article', 'resume'])
    for o in ops:
        t = o['type']
        if t == 'remplacer':
            res = f"{o['nature']} : « {court(o['avant'], 60)} » → « {court(o['apres'], 60)} »"
        elif t == 'marqueurs':
            res = 'marqueurs du livre : ' + ' '.join(p['marqueur'] for p in o['points'])
        elif t == 'retablir':
            mk = [re.match(r'^(?:[a-z]\)|\d{1,2}°?\)|\d{1,2}\.|•)', l) for l in o['lignes']]
            res = f"{len(o['lignes'])} ligne(s) au découpage du livre" + (' ; marqueurs ' + ' '.join(m.group(0) for m in mk if m) if any(mk) else '')
        elif t == 'deplacer-commentaire':
            res = f"note de l'éditeur → annotations de {o.get('vers', o['ancre'])}"
        else:
            res = ''
        w.writerow([t, o.get('ancre', ''), court(res, 300)])
print('écrits :', ', '.join(sorted(os.listdir(OUT))))
