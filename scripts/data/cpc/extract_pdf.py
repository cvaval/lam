#!/usr/bin/env python3
"""
Linéarisation du CODE DE PROCÉDURE CIVILE imprimé (567 pages, couche texte OCR).

La page est composée sur DEUX COLONNES, précédées d'une bande étroite pour les notes de
marge (« Art 62 fr », « Ane art 72 » — l'OCR lit « Ane » pour « Anc »). L'ordre de lecture
n'est donc pas celui du flux : marge, colonne 1, puis colonne 2.

⚠️ NE PAS reconstruire l'ordre des mots à partir de leurs abscisses. La couche produite par
Acrobat Paper Capture place approximativement les mots courts : trier par x donne
« à copie un voisin » pour « copie à un voisin », et rejette « Article 69.- » après son
premier alinéa. On s'appuie donc sur la sortie `-layout`, qui respecte l'ordre de lecture,
et l'on découpe chaque ligne en COLONNES DE CARACTÈRES.

⚠️ La gouttière ne tombe pas à la même colonne d'une page à l'autre. On la localise page par
page, comme la plus large plage de caractères que presque aucune ligne n'occupe — « presque »
étant indispensable : un titre courant centré ou un filet la traverse et, exigeant le vide
absolu, on entrelacerait le texte des articles avec les attendus de jurisprudence.

Produit pdf_lignes.json : [{page, col, texte}] dans l'ordre de lecture.
    python3 scripts/data/cpc/extract_pdf.py
"""
import json
import os
import re
import subprocess

PDF = os.path.expanduser('~/Library/CloudStorage/Dropbox/Moniteur/Code_procedure_civile-pdf.pdf')
DIR = os.path.dirname(os.path.abspath(__file__))
TXT = f'{DIR}/.pdf_layout.txt'

# Titre courant, pagination, et la mention d'édition que la plateforme ne reproduit jamais
# (consigne expresse de la cliente : on publie le texte de loi, pas une édition commerciale).
APPARAT = re.compile(r'(Pierre Marie Michel|CODE DE PROC[ÉE]DURE CIVILE|P[ée]richole|'
                     r'^[-~_\s|]+$|^\W*\d{1,3}\W*$)', re.I)


def vallees(lignes, largeur):
    """Plages de colonnes que peu de lignes occupent → [(début, fin, largeur)]."""
    if not lignes:
        return []
    occ = [0] * (largeur + 1)
    for l in lignes:
        for i, c in enumerate(l[:largeur]):
            if c != ' ':
                occ[i] += 1
    seuil = max(1, len(lignes) // 14)
    out, deb = [], None
    for i in range(largeur + 1):
        if occ[i] <= seuil and deb is None:
            deb = i
        elif occ[i] > seuil and deb is not None:
            out.append((deb, i, i - deb))
            deb = None
    if deb is not None:
        out.append((deb, largeur + 1, largeur + 1 - deb))
    return out


def bornes(lignes):
    """(fin de marge, début de colonne 2) pour une page."""
    largeur = max((len(l) for l in lignes), default=0)
    if largeur < 40:
        return None, None
    v = vallees(lignes, largeur)
    # Marge : première vallée du premier quart, après du texte.
    marge = next((b for a, b, w in v if a > 2 and b < largeur * 0.28 and w >= 3), None)
    # Gouttière : la plus large vallée du tiers médian.
    med = [(w, a) for a, b, w in v if largeur * 0.32 < a < largeur * 0.74 and w >= 4]
    return marge, max(med)[1] if med else None


def main():
    if not os.path.exists(TXT):
        subprocess.run(['pdftotext', '-layout', PDF, TXT], check=True)
    pages = open(TXT, errors='replace').read().split('\f')

    sortie, sans_g = [], 0
    for n, page in enumerate(pages, 1):
        lignes = [l.rstrip() for l in page.split('\n')]
        utiles = [l for l in lignes if l.strip()]
        if len(utiles) < 6:
            continue
        marge, g = bornes(utiles)
        if g is None:
            sans_g += 1
        for l in lignes:
            if not l.strip():
                continue
            m = l[:marge] if marge else ''
            c1 = l[marge:g] if marge else l[:g]
            c2 = l[g:] if g else ''
            for col, txt in (('marge', m), ('1', c1), ('2', c2)):
                t = txt.strip()
                if t and not APPARAT.search(t):
                    sortie.append({'page': n, 'col': col, 'texte': t})

    # Ordre de lecture : marge et colonne 1 dans le fil de la page, colonne 2 ensuite.
    rang = {'marge': 0, '1': 0, '2': 1}
    ordonne = []
    for n in range(1, len(pages) + 1):
        bloc = [r for r in sortie if r['page'] == n]
        ordonne += [r for r in bloc if rang[r['col']] == 0]
        ordonne += [r for r in bloc if rang[r['col']] == 1]

    json.dump(ordonne, open(f'{DIR}/pdf_lignes.json', 'w'), ensure_ascii=False)
    par_col = {}
    for r in ordonne:
        par_col[r['col']] = par_col.get(r['col'], 0) + 1
    print(f'pages                : {len(pages)}')
    print(f'lignes               : {len(ordonne)}  {par_col}')
    print(f'pages sans gouttière : {sans_g}')
    print(f'\n→ {DIR}/pdf_lignes.json')


if __name__ == '__main__':
    main()
