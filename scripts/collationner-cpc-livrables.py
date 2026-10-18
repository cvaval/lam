#!/usr/bin/env python3
"""COLLATION DU CPC — livrables du rapport (§ 8 du prompt d'audit). LECTURE SEULE.

Entrées : le dossier de travail (prod/triangulation.json, lots/resultat-*.json lus sur l'image) et le fichier
d'opérations assemblé (corrections.json, hors dépôt). Sorties, dans docs/livraison-cpc-mot-a-mot/ :
  pages.csv        article → page du livre, verdict du tri, lu sur l'image
  ecarts.csv       un écart par ligne : nature, base, livre (extraits courts), décision
  operations.csv   les opérations de correction (type, article, résumé)

⚠️ Le dépôt est PUBLIC : extraits courts (≤ 120 caractères), aucune note de l'éditeur recopiée, aucune image.

    python3 scripts/collationner-cpc-livrables.py <dossier de travail> <corrections.json>
"""
import csv
import glob
import json
import os
import re
import sys

W, OPS = sys.argv[1], sys.argv[2]
OUT = os.path.join(os.path.dirname(__file__), '..', 'docs', 'livraison-cpc-mot-a-mot')
os.makedirs(OUT, exist_ok=True)
court = lambda s, n=120: (lambda t: t[:n] + ('…' if len(t) > n else ''))(re.sub(r'\s+', ' ', s or '').strip())
key = lambda s: tuple(map(int, s.split('-')))

R = json.load(open(os.path.join(W, 'prod', 'triangulation.json')))
lus = {}
for f in sorted(glob.glob(os.path.join(W, 'lots', 'resultat-*.json'))):
    for r in json.load(open(f)):
        lus[str(r['article'])] = r

with open(os.path.join(OUT, 'pages.csv'), 'w', newline='', encoding='utf-8') as f:
    w = csv.writer(f)
    w.writerow(['article', 'page', 'tri', 'lu_sur_image'])
    for n, r in sorted(R.items(), key=lambda x: key(x[0])):
        w.writerow([n, r.get('page') or '', r['verdict'], 'oui' if n in lus else 'non'])

with open(os.path.join(OUT, 'ecarts.csv'), 'w', newline='', encoding='utf-8') as f:
    w = csv.writer(f)
    w.writerow(['article', 'pages', 'nature', 'base', 'livre', 'decision', 'note'])
    for n, r in sorted(lus.items(), key=lambda x: key(x[0])):
        for e in r.get('ecarts', []):
            w.writerow([n, ' '.join(map(str, r.get('pages', []))), e.get('nature'), court(e.get('base')), court(e.get('livre')),
                        e.get('decision'), court(e.get('note'), 200)])

ops = json.load(open(OPS))['operations']
with open(os.path.join(OUT, 'operations.csv'), 'w', newline='', encoding='utf-8') as f:
    w = csv.writer(f)
    w.writerow(['type', 'article', 'resume'])
    for o in ops:
        t = o['type']
        if t == 'remplacer':
            res = f"{o['nature']} : « {court(o['avant'], 60)} » → « {court(o['apres'], 60)} »"
        elif t == 'promouvoir-intitule':
            res = f"intitulé de la table : « {court(o['label'], 100)} »"
        elif t == 'ancienne-numerotation':
            res = f"ancienne numérotation → {', '.join(o['numeros']) or 'aucune'} ({o.get('preuve', '')})"
        elif t == 'deplacer-commentaire':
            res = f"note de l'éditeur → annotations de {o.get('vers', o['ancre'])}"
        elif t == 'retirer-ligne':
            res = f"retrait : « {court(o['ligne'], 60)} » ({o['motif']})"
        elif t == 'reclef-commentaires':
            res = 'anciennes numérotations rangées sous la clé que le lecteur lit'
        elif t == 'actes-lies':
            res = 'actes liés : ' + ' · '.join(o['table'])
        else:
            res = ''
        w.writerow([t, o.get('ancre', ''), court(res, 300)])
print('écrits :', ', '.join(sorted(os.listdir(OUT))))
