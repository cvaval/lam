#!/usr/bin/env python3
"""COLLATION DU CODE CIVIL — livrables du rapport (§ 8 du prompt d'audit). LECTURE SEULE.

Entrées : le dossier de travail de la collation (triangulation.json, lots/resultat-*.json lus sur l'image,
lots/corrections-*.json) et le fichier d'opérations assemblé (corrections.json, hors dépôt).
Sorties, dans docs/livraison-code-civil-mot-a-mot/ :
  pages.csv        article → index PDF, folio, verdict du tri, source du texte comparé
  ecarts.csv       un écart par ligne : nature, base, livre (extraits courts), décision
  operations.csv   les opérations de correction proposées (type, article, résumé)

⚠️ Le dépôt est PUBLIC : les extraits sont courts (≤ 120 caractères) ; aucune note de l'éditeur n'est
recopiée en entier, aucune image.

    python3 scripts/collationner-code-civil-livrables.py <dossier de travail> <corrections.json>
"""
import csv
import glob
import json
import os
import re
import sys

W, OPS = sys.argv[1], sys.argv[2]
OUT = os.path.join(os.path.dirname(__file__), '..', 'docs', 'livraison-code-civil-mot-a-mot')
os.makedirs(OUT, exist_ok=True)
court = lambda s, n=120: (re.sub(r'\s+', ' ', s or '').strip()[:n] + ('…' if len(re.sub(r'\s+', ' ', s or '').strip()) > n else ''))

R = json.load(open(os.path.join(W, 'triangulation.json')))
lus = {}
for f in sorted(glob.glob(os.path.join(W, 'lots', 'resultat-[1-6].json'))):
    for r in json.load(open(f)):
        lus[str(r['article'])] = r
controle = {str(r['article']): r for r in json.load(open(os.path.join(W, 'lots', 'resultat-7.json')))}

with open(os.path.join(OUT, 'pages.csv'), 'w', newline='', encoding='utf-8') as f:
    w = csv.writer(f)
    w.writerow(['article', 'index_pdf', 'folio', 'tri', 'texte_compare', 'lu_sur_image'])
    for n, r in sorted(R.items(), key=lambda x: int(x[0])):
        lu = 'oui' if n in lus else ('tirage de contrôle' if n in controle else 'non')
        w.writerow([n, r.get('page') or '', (r.get('page') or 1) - 1 if r.get('page') else '', r['verdict'], r['source_base'], lu])

DECISION = {
    'bruit-ocr': 'aucune — la base est conforme, seul l’OCR s’était trompé',
    'coquille-du-livre': 'aucune — coquille du livre, la base garde la forme correcte (décision du 18 oct.)',
}
with open(os.path.join(OUT, 'ecarts.csv'), 'w', newline='', encoding='utf-8') as f:
    w = csv.writer(f)
    w.writerow(['article', 'folio', 'nature', 'base', 'livre', 'base_conforme', 'decision', 'source'])
    for src, table in (('lecture', lus), ('tirage de contrôle', controle)):
        for n, r in sorted(table.items(), key=lambda x: int(x[0])):
            for e in r.get('ecarts', []):
                nat = e.get('nature')
                conf = e.get('base_conforme', e.get('conforme'))
                if nat in DECISION:
                    dec = DECISION[nat]
                elif nat == 'ponctuation' and (re.search(r'[.;:]-', e.get('livre_exact') or '') or (e.get('base') or '').startswith('Art.')):
                    dec = 'passe typographique (tiret du renvoi, forme de tête)'
                elif conf is False or src == 'tirage de contrôle':
                    dec = 'corrigé (voir operations.csv)'
                else:
                    dec = 'aucune'
                w.writerow([n, r.get('folio') or '', nat, court(e.get('base')), court(e.get('livre_exact')), conf, dec, src])

ops = json.load(open(OPS))['operations']
with open(os.path.join(OUT, 'operations.csv'), 'w', newline='', encoding='utf-8') as f:
    w = csv.writer(f)
    w.writerow(['type', 'cible', 'ancre', 'resume'])
    for o in ops:
        t = o['type']
        if t == 'remplacer':
            res = o.get('preuve') or f"« {court(o['avant'], 60)} » → « {court(o['apres'], 60)} »"
        elif t in ('retirer-ligne',):
            res = f"retrait : « {court(o['ligne'], 80)} » ({o.get('motif')})"
        elif t == 'renommer-intitule':
            res = f"libellé → « {court(o['label'], 100)} » ({o.get('preuve', '')})"
        elif t == 'retirer-intitule':
            res = 'intitulé nu en double, retiré de la table, du menu et du corps'
        elif t == 'ajouter-annotation':
            res = f"intrus déplacé vers {o['destination']}{' (déjà présent : seul le doublon du corps part)' if o.get('dejaPresente') else ''} : « {court(o['texte'], 70)} »"
        elif t == 'supprimer-commentaire':
            res = f"doublon de renvoi retiré de commentaires : « {court(o['texte'], 70)} »"
        else:
            res = ''
        w.writerow([t, o.get('cible', ''), o.get('ancre') or o.get('anchor') or o.get('cle') or '', court(res, 300)])
print('écrits :', ', '.join(sorted(os.listdir(OUT))))
