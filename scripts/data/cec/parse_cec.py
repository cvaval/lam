#!/usr/bin/env python3
"""
LOI DU 10 JUILLET 2002 SUR LES COOPÉRATIVES D'ÉPARGNE ET DE CRÉDIT.

Le Moniteur n° 54 du mercredi 10 juillet 2002 (numéro extraordinaire). 151 articles.

C'est le fondement légal des dix normes CEC de la BRH déjà publiées : sans elle, un lecteur
qui consulte la norme sur la capitalisation ne peut pas remonter au texte qui l'autorise.

⚠️ L'en-tête d'article est SEUL sur sa ligne — « Article 1 » — et son texte suit au
paragraphe d'après, sans ponctuation de liaison. On les réunit en « Article 1er.- La présente
loi… », forme que tout le corpus emploie et que le lecteur annoté sait défaire.

⚠️ Les divisions se donnent sur DEUX lignes (« TITRE I » puis « DISPOSITIONS PRELIMINAIRES »)
ou d'un seul tenant (« SECTION 1. DISPOSITIONS GÉNÉRALES »).

⚠️ Anomalies du texte PUBLIÉ, relevées par le sommaire fourni et conservées telles quelles :
le Titre II passe du Chapitre III au Chapitre V — il n'y a pas de Chapitre IV — et le
Titre IV porte DEUX Chapitre II. Y toucher serait réécrire le Journal Officiel.

Produit bodyOriginal.txt · structure.json · rubriques.json · index.json
    python3 scripts/data/cec/parse_cec.py
"""
import html
import json
import os
import re
import zipfile

SRC = os.path.expanduser('~/Downloads')
DIR = os.path.dirname(os.path.abspath(__file__))

TETE = re.compile(r'^Article\s+(\d{1,3})\s*(?:\.\-)?\s*(.*)$')
DESIGNATION = re.compile(r'^(TITRE|CHAPITRE|SECTION|SOUS-SECTION)\s+([IVXLC]+|\d+)\s*\.?\s*$', re.I)
DIVISION_PLEINE = re.compile(r'^(TITRE|CHAPITRE|SECTION|SOUS-SECTION)\s+([IVXLC]+|\d+)\s*[.:—–-]\s*\S', re.I)
NIVEAU = {'TITRE': 1, 'CHAPITRE': 2, 'SECTION': 3, 'SOUS-SECTION': 4}
# Apparat du fascicule : bandeau, colophon des Presses Nationales, dépôt légal.
APPARAT = re.compile(r'^(No\.\s*\d+\s*—\s*PORT-AU-PRINCE|Presses Nationales|Dépôt Légal|'
                     r'Le Moniteur\b.*Journal Officiel)', re.I)


def paragraphes(nom):
    x = zipfile.ZipFile(f'{SRC}/{nom}').read('word/document.xml').decode('utf8')
    x = re.sub(r'<w:tab/>', ' ', x)
    x = re.sub(r'</w:p>', '\n', x)
    x = re.sub(r'<[^>]+>', '', x)
    return [re.sub(r'[ \t]+', ' ', p.strip()).replace("'", '’')
            for p in html.unescape(x).split('\n') if p.strip()]


def corps():
    ps = paragraphes('Loi_CEC_10_juillet_2002_collationne_1.docx')
    lignes, toc, labels = [], [], {}
    saut = False
    attente = None          # numéro d'article dont on attend le texte
    for k, p in enumerate(ps):
        if saut:
            saut = False
            continue
        if APPARAT.match(p):
            continue
        m = DESIGNATION.match(p)
        if m and len(p) < 40:
            legende = ps[k + 1] if k + 1 < len(ps) else ''
            if legende and legende == legende.upper() and not TETE.match(legende) and len(legende) < 160:
                p, saut = f'{p.rstrip(" .")} — {legende}', True
            toc.append({'level': NIVEAU[m.group(1).upper()], 'label': p,
                        'anchor': f'sec-{len(toc) + 1}', 'kind': m.group(1).lower()})
            lignes.append(p)
            continue
        if DIVISION_PLEINE.match(p) and len(p) < 200:
            toc.append({'level': NIVEAU[DIVISION_PLEINE.match(p).group(1).upper()], 'label': p,
                        'anchor': f'sec-{len(toc) + 1}', 'kind': DIVISION_PLEINE.match(p).group(1).lower()})
            lignes.append(p)
            continue
        t = TETE.match(p)
        if t:
            num, reste = t.group(1), t.group(2).strip()
            lib = 'Article 1er' if num == '1' else f'Article {num}'
            if f'art-{num}' in labels:
                raise SystemExit(f'✗ article {num} en double (¶{k})')
            labels[f'art-{num}'] = lib
            if reste:
                lignes.append(f'{lib}.- {reste}')
            else:
                attente = lib   # le texte est au paragraphe suivant
            continue
        if attente:
            lignes.append(f'{attente}.- {p}')
            attente = None
            continue
        # Bloc de signature : le fascicule met la qualité sur une ligne et le nom sur la
        # suivante, précédé de deux points (« Le Ministre de l'Economie et des Finances » /
        # « : Faubert GUSTAVE »). Les laisser séparés donne une colonne de noms orphelins.
        if p.startswith(':') and lignes:
            lignes[-1] = f'{lignes[-1]} {p}'
            continue
        # Reste de pagination : une lettre ou un chiffre isolé, sans portée.
        if len(p) <= 2 and not p[0].islower():
            continue
        lignes.append(p)
    return lignes, toc, labels


def rubriques():
    """Sommaire analytique → {numéro d'article: rubrique}."""
    ps = paragraphes('Loi_CEC_2002_Sommaire.docx')
    out = {}
    for p in ps:
        m = re.match(r'^Art\.?\s*(\d{1,3})\s*\.?\s*[—–-]\s*(.+)$', p)
        if m:
            out[m.group(1)] = m.group(2).strip()
    return out


def index(valides):
    """Index alphabétique → {sujet: [numéros]}. Sous-entrées repérées par un tiret initial."""
    ps = paragraphes('Loi_CEC_2002_Index_alphabetique.docx')
    out, vedette = {}, None
    for p in ps:
        if len(p) <= 2 or p.startswith('Les chiffres renvoient'):
            continue
        sous = bool(re.match(r'^[—–-]\s+', p))
        ligne = re.sub(r'^[—–-]\s+', '', p).strip()
        m = re.search(r',\s*((?:\d{1,3})(?:\s*,\s*\d{1,3})*)\s*$', ligne)
        sujet = (ligne[: m.start()] if m else ligne).strip(' ,;:')
        nums = [n for n in re.findall(r'\d{1,3}', m.group(1))] if m else []
        nums = [n for n in nums if n in valides]
        if sous:
            if not nums or not vedette:
                continue
            out.setdefault(f'{vedette} — {sujet}' if sujet else vedette, set()).update(nums)
        else:
            if sujet:
                vedette = sujet
            if nums and vedette:
                out.setdefault(vedette, set()).update(nums)
    return {k: sorted(v, key=int) for k, v in out.items()}


def main():
    lignes, toc, labels = corps()
    rub = rubriques()
    valides = {k.replace('art-', '') for k in labels}
    idx = index(valides)

    nums = sorted(int(n) for n in valides)
    manq = [n for n in range(1, max(nums) + 1) if n not in nums]
    if manq:
        raise SystemExit(f'✗ articles manquants : {manq}')
    sans_rub = [n for n in valides if n not in rub]
    body = '\n'.join(lignes).strip() + '\n'
    open(f'{DIR}/bodyOriginal.txt', 'w').write(body)
    json.dump({'toc': toc, 'labels': labels}, open(f'{DIR}/structure.json', 'w'), ensure_ascii=False, indent=1)
    json.dump(rub, open(f'{DIR}/rubriques.json', 'w'), ensure_ascii=False, indent=1)
    json.dump(idx, open(f'{DIR}/index.json', 'w'), ensure_ascii=False, indent=1)

    refs = sum(len(v) for v in idx.values())
    couv = {n for v in idx.values() for n in v}
    print(f'articles            : {len(labels)} (1 → {max(nums)})  ✓ série complète')
    print(f'divisions           : {len(toc)}')
    print(f'rubriques (sommaire): {len(rub)}/{len(labels)}' + (f'  ⚠ sans rubrique : {sorted(sans_rub, key=int)[:8]}' if sans_rub else '  ✓'))
    print(f'index               : {len(idx)} entrées · {refs} renvois · {len(couv)}/{len(labels)} articles couverts')
    print(f'corps               : {len(body)} car., {len(lignes)} lignes')
    print(f'\n→ {DIR}/bodyOriginal.txt · structure.json · rubriques.json · index.json')


if __name__ == '__main__':
    main()
