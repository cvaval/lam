#!/usr/bin/env python3
"""Extrait les articles des 3 textes dépourvus d'index → articles.json (pour l'indexation IA)."""
import json, os, re, zipfile, html

SRC = os.path.expanduser('~/Downloads')
DIR = os.path.dirname(os.path.abspath(__file__))

TEXTES = [
    ('decret-2015-signature', 'Décret du 9 décembre 2015 sur la signature électronique',
     'Decret_signature_electronique_09-12-2015.docx'),
    ('decret-2016-administration', 'Décret du 6 janvier 2016 sur l’administration électronique',
     'Decret_administration_electronique_06-01-2016.docx'),
    ('loi-2017-echanges', 'Loi du 14 février 2017 sur les échanges électroniques',
     'Moniteur_Special_12_2017_Echanges_Electroniques.docx'),
]
# Tête d'article : « Article 1er.- », « Article 12.- », « Article 9-1.- »
TETE = re.compile(r'^Article\s+(\d{1,3}(?:er)?(?:-\d{1,2})?)\s*\.-\s*(.*)$')
# Bornes structurelles : un en-tête ne fait jamais partie du texte d'un article.
BORNE = re.compile(r'^(TITRE|CHAPITRE|Section|Donné|Par\s*:|Extrait du journal)', re.I)


def paragraphes(path):
    x = zipfile.ZipFile(path).read('word/document.xml').decode('utf8')
    x = re.sub(r'<w:tab/>', ' ', x)
    x = re.sub(r'</w:p>', '\n', x)
    x = re.sub(r'<[^>]+>', '', x)
    return [re.sub(r'[ \t]+', ' ', p.strip()) for p in html.unescape(x).split('\n') if p.strip()]


out = {}
for slug, titre, fichier in TEXTES:
    ps = paragraphes(f'{SRC}/{fichier}')
    arts, cur = [], None
    for p in ps:
        m = TETE.match(p)
        if m:
            num = m.group(1).replace('er', '') if m.group(1).endswith('er') else m.group(1)
            cur = {'num': num, 'text': m.group(2)}
            arts.append(cur)
            continue
        if BORNE.match(p):
            cur = None
            continue
        if cur:
            cur['text'] += ' ' + p
    out[slug] = {'titre': titre, 'articles': arts}
    nums = [a['num'] for a in arts]
    print(f'{slug:30} {len(arts):3} articles · {nums[0]} → {nums[-1]}'
          + (f" · décimaux : {[n for n in nums if '-' in n]}" if any('-' in n for n in nums) else ''))
    court = [a['num'] for a in arts if len(a['text']) < 60]
    if court:
        print(f'{"":30} ⚠ articles au texte très court : {court}')

json.dump(out, open(f'{DIR}/articles.json', 'w'), ensure_ascii=False, indent=1)
print(f'\n→ {DIR}/articles.json')
