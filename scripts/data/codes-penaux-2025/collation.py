"""Collation mot à mot des DEUX lectures du fac-similé — Opus 5.5 et Tesseract — page par page.

    python3 -I scripts/data/codes-penaux-2025/collation.py <code> <dossier OCR> [--json <sortie>]

Les deux témoins sont indépendants (un modèle de langue qui lit l'image, un moteur de reconnaissance de
caractères). Là où ils concordent, la leçon est sûre ; là où ils divergent, on tranche SUR L'IMAGE
(vignette.py). Ce script ne décide rien : il dresse la liste des lieux, classés :

- `trivial`   : même texte une fois neutralisés ce que Tesseract ne voit pas ou rend autrement sans que le
                sens change — apostrophe droite/courbe, guillemets, tirets, coupure de fin de ligne,
                « (l) » pour « (1) », espace avant la ponctuation ;
- `accent`    : mêmes lettres, accents différents (angle mort connu de Tesseract, et parfois d'Opus) ;
- `ponct`     : ponctuation seule ;
- `mot`       : tout le reste — une leçon à trancher.

La page de chaque lieu, son contexte et la boîte Tesseract (pour la vignette) sont gardés.
"""
import difflib
import json
import os
import re
import sys
import unicodedata

BALISE = re.compile(r'</?(?:answer|final_answer|response|transcript|invoke|output|text)(?:\s[^>]*)?>')
TETE = re.compile(r'(?:<+\s*|«\s*)?LE MONITEUR(?:\s*>+|\s*»)?|Spécial N°\s*44(?:-A)?\s*-\s*Mardi 24 Juin 2025')
TOK = re.compile(r"[^\W_]+|[^\w\s]", re.U)


def neutre(w):
    for a, b in (('’', "'"), ('‘', "'"), ('–', '-'), ('—', '-'), ('−', '-'), ('«', '"'), ('»', '"'), ('“', '"'), ('”', '"')):
        w = w.replace(a, b)
    return w


def fold(s):
    s = unicodedata.normalize('NFD', s)
    return ''.join(c for c in s if unicodedata.category(c) != 'Mn')


def texte_claude(t):
    t = BALISE.sub('', t)
    return '\n'.join(ln for ln in t.split('\n') if not TETE.search(ln) and not re.fullmatch(r'\s*\d{1,3}\s*', ln))


def texte_tesseract(t):
    lignes = [ln for ln in t.split('\n') if not TETE.search(ln) and not re.fullmatch(r'\s*\d{1,3}\s*', ln)]
    t = '\n'.join(lignes)
    t = re.sub(r'(\w)-\n\s*(\w)', r'\1\2', t)  # coupure de fin de ligne
    return t


# Les têtes « Article N.- », en gras dans une colonne à part, sont souvent lues par Tesseract comme un
# bloc séparé (« Article 8.- Article 9.- … » puis les textes) : on les retire des DEUX lectures. Elles sont
# contrôlées ailleurs (suite des numéros, parse.py) et, une à une, sur l'image quand la suite rompt.
TETE_ART = re.compile(r'Article\s*(?:1er|1\s*°\s*["”“]?|\d{1,4}(?:[.\-]\d{1,3})*)\s*\.?\s*-')
# Bruit de marge de Tesseract : une lettre isolée seule sur sa ligne.
MARGE = re.compile(r'^\s*[A-Za-z]\s*$', re.M)


# Les puces « 1°) », « 2°) »… sont, elles aussi, composées dans une colonne à part : retirées des deux
# lectures, leur suite est contrôlée article par article dans le corps (puces.py).
PUCE = re.compile(r'(?<!\S)\S{1,2}\s*[°º]\s*\)|(?<!\S)\d{1,2}o\s*\)')


def jetons(t):
    t = MARGE.sub('', PUCE.sub(' ', TETE_ART.sub(' ', t)))
    return [neutre(m.group(0)) for m in TOK.finditer(t)]


def classe(a, b):
    sa, sb = ' '.join(a), ' '.join(b)
    if sa.replace(' ', '') == sb.replace(' ', ''):
        return 'trivial'
    ca = re.sub(r'\(l\)', '(1)', sa.replace(' ', ''))
    cb = re.sub(r'\(l\)', '(1)', sb.replace(' ', ''))
    if ca == cb:
        return 'trivial'
    if fold(ca) == fold(cb):
        return 'accent'
    if re.sub(r'[^\w]', '', ca) == re.sub(r'[^\w]', '', cb):
        return 'ponct'
    return 'mot'


def main(code, dossier, sortie=None):
    from parse import CONFIG  # noqa: F401  (même dossier : vérifie que le code existe)
    a, b = {'cp': (1, 182), 'cpp': (1, 240)}[code]
    lieux = []
    for p in range(a, b + 1):
        c = jetons(texte_claude(open(os.path.join(dossier, f'p{p:03d}.claude.txt'), encoding='utf8').read()))
        t = jetons(texte_tesseract(open(os.path.join(dossier, f'p{p:03d}.tesseract.txt'), encoding='utf8').read()))
        sm = difflib.SequenceMatcher(None, c, t, autojunk=False)
        for op, i1, i2, j1, j2 in sm.get_opcodes():
            if op == 'equal':
                continue
            k = classe(c[i1:i2], t[j1:j2])
            lieux.append({
                'id': f'{code}-{p:03d}-{len(lieux):04d}',
                'page': p,
                'classe': k,
                'opus': ' '.join(c[i1:i2]),
                'tesseract': ' '.join(t[j1:j2]),
                'avant': ' '.join(c[max(0, i1 - 6):i1]),
                'apres': ' '.join(c[i2:i2 + 6]),
            })
    from collections import Counter
    n = Counter(x['classe'] for x in lieux)
    print(f'{code} : {len(lieux)} lieux — ' + ' · '.join(f'{k} {v}' for k, v in sorted(n.items())))
    if sortie:
        json.dump(lieux, open(sortie, 'w', encoding='utf8'), ensure_ascii=False, indent=1)


if __name__ == '__main__':
    args = sys.argv[1:]
    out = args[args.index('--json') + 1] if '--json' in args else None
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    main(args[0], args[1], out)
