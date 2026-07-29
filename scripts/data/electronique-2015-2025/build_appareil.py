#!/usr/bin/env python3
"""
Assemble l'APPAREIL ÉDITORIAL des 5 textes « électronique » → appareil.json.

Origine des pièces :
  · sommaire   — de la CLIENTE pour la loi de 2017 (signature), la loi de 2017 (échanges)
                 et le décret de 2025 ; À GÉNÉRER pour les décrets de 2015 et 2016 (aucun
                 sommaire n'avait été fourni) — cf. _gen-rubriques-electronique.ts ;
  · index      — de la CLIENTE pour la loi de 2017 (signature) et le décret de 2025 ;
                 GÉNÉRÉ et relu pour les décrets de 2015, 2016 et la loi sur les échanges.

⚠️ L'index du décret de 2025 renvoie aux articles de la LOI DE 2017 TELLE QU'AMENDÉE (son
nota le dit), et cite aussi des articles du CODE CIVIL (« Acte authentique, art. 2 (C. civ.,
art. 1102) »). Les renvois « C. civ. » sont ÉCARTÉS de l'index de la loi : ce sont des
renvois externes, ils deviendraient des liens faux vers les articles 1102 de la loi.

    python3 scripts/data/electronique-2015-2025/build_appareil.py
"""
import html
import json
import os
import re
import zipfile

SRC = os.path.expanduser('~/Downloads')
DIR = os.path.dirname(os.path.abspath(__file__))


def paragraphes(nom):
    x = zipfile.ZipFile(f'{SRC}/{nom}').read('word/document.xml').decode('utf8')
    x = re.sub(r'<w:tab/>', '\t', x)
    x = re.sub(r'</w:p>', '\n', x)
    x = re.sub(r'<[^>]+>', '', x)
    return [p.strip().replace("'", '’') for p in html.unescape(x).split('\n') if p.strip()]


def index_client_tabule(nom, valides):
    """Index « sujet <TAB> art. N ; art. M » (loi de 2017 signature)."""
    out = {}
    for p in paragraphes(nom):
        if '\t' not in p:
            continue
        suj, _, refs = p.partition('\t')
        # « art. 2 (C. civ. 1102) » → on ne retient que le renvoi À LA LOI
        refs = re.sub(r'\(C\.\s*civ\.[^)]*\)', '', refs)
        nums = [n for n in re.findall(r'art\.\s*(\d{1,2}(?:\.\d{1,2})?)', refs) if n in valides]
        if nums:
            out.setdefault(suj.strip(), set()).update(nums)
    return out


def index_client_virgule(nom, valides):
    """Index « Sujet, art. 6 ; 7 ; 15 a) » (décret de 2025 → articles de la loi amendée)."""
    out = {}
    for p in paragraphes(nom):
        if p.startswith(('INDEX', 'Les renvois')) or len(p) <= 2:
            continue
        m = re.match(r'^(.+?),\s*(art\..*)$', p)
        if not m:
            continue
        suj, refs = m.group(1).strip(), m.group(2)
        refs = re.sub(r'\(C\.\s*civ\.[^)]*\)', '', refs)
        refs = re.sub(r'Décret,\s*art\.\s*\d+', '', refs)  # renvois au décret lui-même
        nums = [n for n in re.findall(r'(?:art\.\s*)?(\d{1,2}(?:\.\d{1,2})?)\b', refs) if n in valides]
        if nums:
            out.setdefault(suj, set()).update(nums)
    return out


def sommaire_client(nom, motif):
    """Rubriques « Article N.- <rubrique> » ou « Art. N. — <rubrique> »."""
    out = {}
    for p in paragraphes(nom):
        m = motif.match(p)
        if m:
            num = m.group(1).replace('er', '') if m.group(1).endswith('er') else m.group(1)
            rub = re.sub(r'\s*\d*$', '', m.group(2)).strip(' .')
            if rub:
                out[num] = rub
    return out


def main():
    textes = json.load(open(f'{DIR}/textes.json'))
    app = {}

    # ── Loi de 2017 (signature), CONSOLIDÉE ──
    valides17 = {a['num'] for a in textes['loi-2017-signature']['consolide']}
    idx17 = index_client_tabule('Loi_2017_Signature_Electronique_Sommaire_Index.docx', valides17)
    idx25 = index_client_virgule('03_Index_alphabetique_Decret_Signature_Electronique_2025.docx', valides17)
    for s, r in idx25.items():                       # l'index de 2025 COMPLÈTE celui de 2017
        idx17.setdefault(s, set()).update(r)
    som17 = sommaire_client('Loi_2017_Signature_Electronique_Sommaire_Index.docx',
                            re.compile(r'^Article\s+(\d{1,2}(?:\.\d{1,2})?)\.-\s*(.+)$'))
    som25 = sommaire_client('02_Sommaire_analytique_Decret_Signature_Electronique_2025.docx',
                            re.compile(r'^Article\s+(\d{1,2}(?:\.\d{1,2})?)\s*\((?:nouveau|modifié)\)\s*—\s*(.+)$'))
    som17.update(som25)                              # les rubriques de 2025 priment (articles amendés)
    app['loi-2017-signature'] = {'index': idx17, 'sommaire': som17}

    # ── Décret de 2025 (3 articles propres) ──
    valides25 = {a['num'] for a in textes['decret-2025-signature']['articles']}
    som = sommaire_client('02_Sommaire_analytique_Decret_Signature_Electronique_2025.docx',
                          re.compile(r'^Article\s+(\d{1,2}(?:er)?)\.-\s*(.+)$'))
    app['decret-2025-signature'] = {
        'index': {'Amendement de la loi du 14 février 2017': {'1', '2'},
                  'Abrogation des dispositions contraires': {'3'}},
        'sommaire': {n: r for n, r in som.items() if n in valides25},
    }

    # ── Loi de 2017 (échanges) : index généré + sommaire client ──
    somE = sommaire_client('Loi_2017_Echanges_Electroniques_Sommaire.docx',
                           re.compile(r'^Article\s+(\d{1,2}(?:-\d)?)\.-\s*(.+)$'))
    app['loi-2017-echanges'] = {
        'index': {k: set(v) for k, v in json.load(open(f'{DIR}/index-loi-2017-echanges.json')).items()},
        'sommaire': somE,
    }

    # ── Décrets de 2015 et 2016 : index généré ; rubriques générées (rubriques.json) ──
    rub = json.load(open(f'{DIR}/rubriques.json')) if os.path.exists(f'{DIR}/rubriques.json') else {}
    for slug, f in [('decret-2015-signature', 'index-decret-2015-signature.json'),
                    ('decret-2016-administration', 'index-decret-2016-administration.json')]:
        app[slug] = {'index': {k: set(v) for k, v in json.load(open(f'{DIR}/{f}')).items()},
                     'sommaire': rub.get(slug, {})}

    # ── Contrôles ──
    print(f'{"texte":30} {"art.":>5} {"index":>6} {"rubriques":>10}  renvois morts')
    for slug, a in app.items():
        arts = textes[slug].get('consolide') or textes[slug]['articles']
        valides = {x['num'] for x in arts}
        morts = sorted({r for refs in a['index'].values() for r in refs if r not in valides})
        manque = [x['num'] for x in arts if x['num'] not in a['sommaire']]
        print(f'  {slug:28} {len(arts):5} {len(a["index"]):6} {len(a["sommaire"]):5}/{len(arts):<4} '
              f'{morts if morts else "0 ✓"}'
              + (f'  ⚠ rubriques manquantes : {len(manque)}' if manque else ''))

    json.dump({k: {'index': {s: sorted(r) for s, r in v['index'].items()}, 'sommaire': v['sommaire']}
               for k, v in app.items()}, open(f'{DIR}/appareil.json', 'w'), ensure_ascii=False, indent=1)
    print(f'\n→ {DIR}/appareil.json')


if __name__ == '__main__':
    main()
