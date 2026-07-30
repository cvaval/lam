#!/usr/bin/env python3
"""
Index alphabétique du Code de procédure civile → index.json.

⚠️ Format INÉDIT : l'index n'est pas tabulé. Les renvois sont rédigés en toutes lettres et
sont de quatre natures, qu'il faut distinguer sous peine de fabriquer des liens faux :

  · au CODE          « article 86 du Code », « articles 618 à 660 du Code »   → RETENU
  · à un texte annexé « décret du 4 avril 1974 (Appendice IV.9) »             → ignoré (lot 2)
  · à la jurisprudence « jurisprudence n° 18 (Nullités) »                     → ignoré (lot 3)
  · à une autre vedette « voir Nullités »                                     → ignoré

Un « article 86 » qui n'est pas suivi de « du Code » n'est PAS un renvoi au Code : il peut
désigner l'article d'un texte annexé. On n'accepte donc que la forme explicite.

    python3 scripts/data/cpc/parse_index.py
"""
import html
import json
import os
import re
import zipfile

SRC = os.path.expanduser('~/Downloads/CPC_cumule_index_alphabetique_1.docx')
DIR = os.path.dirname(os.path.abspath(__file__))

# « article 86 du Code » · « articles 618 à 660 du Code » · « articles 860 et 861 du Code »
RENVOI = re.compile(
    r'articles?\s+((?:\d{1,4}(?:-\d{1,2})?)(?:\s*(?:,|et|à|a)\s*\d{1,4}(?:-\d{1,2})?)*)\s+du\s+Code',
    re.I)
PLAGE = re.compile(r'(\d{1,4}(?:-\d{1,2})?)\s*(?:à|a)\s*(\d{1,4}(?:-\d{1,2})?)', re.I)
# Lignes d'apparat du document, hors index
APPARAT = re.compile(r'^(CODE DE|Édition|INDEX|Code, Appendice|Document source|Établi le|'
                     r'NOTE LIMINAIRE|Concordance|ÉTAT STATISTIQUE|Vedettes|Sous-entrées|•)', re.I)


def paragraphes():
    x = zipfile.ZipFile(SRC).read('word/document.xml').decode('utf8')
    x = re.sub(r'<w:tab/>', ' ', x)
    x = re.sub(r'</w:p>', '\n', x)
    x = re.sub(r'<[^>]+>', '', x)
    return [re.sub(r'[ \t]+', ' ', p.strip()).replace("'", '’')
            for p in html.unescape(x).split('\n') if p.strip()]


def numeros(txt, valides):
    """Numéros d'article du Code cités dans un renvoi, plages développées."""
    out = []
    for m in RENVOI.finditer(txt):
        bloc = m.group(1)
        p = PLAGE.search(bloc)
        if p:
            a, b = p.group(1), p.group(2)
            if a.isdigit() and b.isdigit():
                out.extend(str(n) for n in range(int(a), int(b) + 1))
                continue
        out.extend(re.findall(r'\d{1,4}(?:-\d{1,2})?', bloc))
    return [n for n in dict.fromkeys(out) if n in valides]


def main():
    struct = json.load(open(f'{DIR}/structure.json'))
    valides = {k.replace('art-', '') for k in struct['labels']}
    ps = paragraphes()

    index, vedette = {}, None
    n_lignes = n_sous = 0
    for p in ps:
        if APPARAT.match(p) or len(p) < 3:
            continue
        # Une vedette n'a pas de renvoi sur sa propre ligne ; une sous-entrée en a un.
        nums = numeros(p, valides)
        # Sujet : ce qui précède le premier renvoi
        m = RENVOI.search(p)
        sujet = (p[: m.start()] if m else p).strip(' ,;:.—–-')
        if not nums:
            # ligne sans renvoi au Code : vedette d'accroche (ou renvoi hors Code)
            if len(p) < 90 and not re.search(r'\bvoir\b', p, re.I):
                vedette = p.strip(' ,;:.')
            continue
        n_lignes += 1
        if sujet and vedette and sujet != vedette:
            libelle = f'{vedette} — {sujet}'
            n_sous += 1
        else:
            libelle = sujet or vedette or ''
        if not libelle:
            continue
        index.setdefault(libelle, set()).update(nums)

    def cle(n):
        a, _, b = n.partition('-')
        return (int(a), int(b) if b else 0)

    sortie = {s: sorted(v, key=cle) for s, v in sorted(index.items(), key=lambda kv: kv[0].lower())}
    json.dump(sortie, open(f'{DIR}/index.json', 'w'), ensure_ascii=False, indent=1)

    refs = sum(len(v) for v in sortie.values())
    couv = {n for v in sortie.values() for n in v}
    morts = [n for v in sortie.values() for n in v if n not in valides]
    print(f'entrées d’index    : {len(sortie)}')
    print(f'renvois au Code    : {refs} · {len(couv)}/{len(valides)} articles couverts')
    print(f'renvois morts      : {len(morts)} {"✓" if not morts else morts[:8]}')
    print(f'dont sous-entrées  : {n_sous}')
    print(f'\n→ {DIR}/index.json')


if __name__ == '__main__':
    main()
