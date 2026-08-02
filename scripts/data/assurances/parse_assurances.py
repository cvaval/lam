#!/usr/bin/env python3
"""
LE CONTRÔLE DES COMPAGNIES D'ASSURANCE — les deux textes qui le régissent.

  · LOI DU 13 JUILLET 1956 organisant le contrôle des Compagnies d'Assurances en Haïti
    (Moniteur n° 90 du jeudi 23 août 1956) — 23 articles ;
  · DÉCRET DU 20 MARS 1981 modifiant ses articles 1, 3, 4, 5, 16 et 17
    (Moniteur n° 26 du 30 mars 1981) — 6 articles.

Ces deux textes figuraient déjà sur la plateforme, mais d'après l'édition Vandal du Code de
commerce : la loi y était donnée en 22 articles, et le décret réduit à un EXTRAIT de deux
articles, l'édition le disant elle-même. Les voici d'après le Journal Officiel.

⚠️ Le décret CITE entre guillemets les articles qu'il réécrit — « Article 1er.— Les
Compagnies d'Assurance ne pourront fonctionner… ». Ces lignes ne sont PAS des têtes
d'article du décret : les prendre pour telles lui en ferait compter le double et brouillerait
ses ancres. Le guillemet ouvrant est conservé, comme au Journal Officiel, et sert de garde.

⚠️ La ponctuation de tête est le TIRET CADRATIN : « Article 2.— », non « Article 2.- ».

Le décret porte un barème de cautionnement par tranche de primes, dont le fascicule met la
valeur sur une ligne séparée ; on la réunit à son libellé.

Produit textes.json : [{source, titre, moniteur, date, corps, toc, labels, notes}].
    python3 scripts/data/assurances/parse_assurances.py
"""
import html
import json
import os
import re
import zipfile

SRC = os.path.expanduser('~/Downloads')
DIR = os.path.dirname(os.path.abspath(__file__))

# Tête d'article : tiret cadratin, et JAMAIS précédée d'un guillemet ouvrant (citation).
TETE = re.compile(r'^Article\s+(\d{1,3})(?:er)?\s*\.\s*[—–-]\s*(.*)$')
NOTE = re.compile(r'^\[\s*Note éditoriale')
# Méthode du transcripteur : elle décrit la reconstitution, ce n'est pas le texte de loi.
METHODE = re.compile(r'^Reconstitution textuelle')
MASTHEAD = re.compile(r'^Le Moniteur\s*—\s*Journal Officiel')
MONTANT = re.compile(r'^G\.\s*[\d. ]+$')

FICHIERS = [
    ('1956-No90_02_Loi_Controle_Compagnies_Assurances.docx', 'CC_VANDAL_IV-D-1',
     'Loi du 13 juillet 1956 organisant le contrôle des Compagnies d’Assurances en Haïti',
     'Le Moniteur n° 90 du jeudi 23 août 1956', '1956-07-13', 23),
    ('1981-No26_01_Decret_Modification_Loi_Assurances_1956.docx', 'CC_VANDAL_IV-D-2',
     'Décret du 20 mars 1981 modifiant les articles 1, 3, 4, 5, 16 et 17 de la Loi du '
     '13 juillet 1956 sur les Compagnies d’Assurance',
     'Le Moniteur n° 26 du 30 mars 1981', '1981-03-20', 6),
]


def paragraphes(nom):
    x = zipfile.ZipFile(f'{SRC}/{nom}').read('word/document.xml').decode('utf8')
    x = re.sub(r'<w:tab/>', ' ', x)
    x = re.sub(r'</w:p>', '\n', x)
    x = re.sub(r'<[^>]+>', '', x)
    return [re.sub(r'[ \t]+', ' ', p.strip()).replace("'", '’')
            for p in html.unescape(x).split('\n') if p.strip()]


def decouper(ps):
    lignes, labels, notes = [], {}, {}
    dernier = None
    for p in ps:
        if MASTHEAD.match(p) or METHODE.match(p):
            continue
        if NOTE.match(p):
            # Note du transcripteur sur une anomalie de l'imprimé : elle éclaire l'article
            # qu'elle suit, mais n'appartient pas au texte de loi.
            notes.setdefault(dernier or 'doc', []).append(p.strip('[]').strip())
            continue
        if MONTANT.match(p) and lignes:
            lignes[-1] = f'{lignes[-1]} {p}'
            continue
        t = TETE.match(p)
        if t:
            num, reste = t.group(1), t.group(2)
            lib = 'Article 1er' if num == '1' else f'Article {num}'
            if f'art-{num}' in labels:
                raise SystemExit(f'✗ article {num} en double — « {p[:70]} »')
            labels[f'art-{num}'] = lib
            dernier = f'art-{num}'
            lignes.append(f'{lib}.- {reste}'.rstrip())
            continue
        lignes.append(p)
    return lignes, labels, notes


def main():
    sortie = []
    for fichier, source, titre, moniteur, date, attendu in FICHIERS:
        lignes, labels, notes = decouper(paragraphes(fichier))
        nums = sorted(int(k.replace('art-', '')) for k in labels)
        manq = [n for n in range(1, max(nums) + 1) if n not in nums]
        if manq:
            raise SystemExit(f'✗ {fichier} : articles manquants {manq}')
        if len(nums) != attendu:
            raise SystemExit(f'✗ {fichier} : {len(nums)} articles, {attendu} attendus')
        sortie.append({'source': source, 'titre': titre, 'moniteur': moniteur, 'date': date,
                       'corps': '\n'.join(lignes).strip(), 'labels': labels, 'notes': notes})
        cites = sum(1 for l in lignes if l.startswith('«'))
        print(f'{titre[:66]:68}')
        print(f'   {len(nums):2} articles (1 → {max(nums)}) ✓ · {len(lignes):3} lignes · '
              f'{cites} article(s) cité(s) entre guillemets · {sum(len(v) for v in notes.values())} note(s) éditoriale(s)')

    json.dump(sortie, open(f'{DIR}/textes.json', 'w'), ensure_ascii=False, indent=1)
    print(f'\n→ {DIR}/textes.json')


if __name__ == '__main__':
    main()
