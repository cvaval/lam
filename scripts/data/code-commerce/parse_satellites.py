#!/usr/bin/env python3
"""Parser générique des 93 textes satellites de l'édition Vandal → parsed-satellites/<id>.json.

Pour chaque texte (CSV = source de vérité des titres) :
  - ligne 1 = intitulé (le CSV fait foi) ; ligne 2 éventuelle « Mon No 82 du 18 octobre 1979 »
    → moniteurRef normalisé + date de publication ;
  - têtes d'articles « Art N.- » / « Article N.- » (+ « (Abrogé) », citations modificatrices) ;
  - en-têtes TITRE/CHAPITRE/SECTION/§ → toc sec-N (sommaire latéral si ≥ 2 en-têtes) ;
  - désignation (« Décret du 10 octobre 1979 ») extraite du titre → Document.number
    (résolution des renvois « par désignation »).

Exclusions (décision cliente du 20 juil. 2026 — Code douanier plus récent déjà en ligne) :
  I-C-2, I-I, I-M, I-N, V-A-3, V-B-2, V-D-2, V-G.

Sortie par texte : { id, partie, rubrique, title, number, moniteurRef, publicationDate,
                     body, structure(AnnotatedText)|null, stats, anomalies }
"""
import csv, html, re, json, os, zipfile, unicodedata
from collections import Counter

OUT = os.path.dirname(os.path.abspath(__file__))
PARSED = os.path.join(OUT, 'parsed-satellites')
ROOT = '/Users/cvaval/Downloads/Officiel_Code-de-Commerce_Vandal_legislations-separees'

EXCLUDED = {'I-C-2', 'I-I', 'I-M', 'I-N', 'V-A-3', 'V-B-2', 'V-D-2', 'V-G'}

ENT = [('&amp;', '&'), ('&lt;', '<'), ('&gt;', '>'), ('&#x2019;', '’'), ('&#x2018;', '‘'),
       ('&#x2013;', '–'), ('&#x2014;', '—'), ('&#xa0;', ' '), ('&quot;', '"'), ('&apos;', "'")]


def clean(t):
    t = html.unescape(html.unescape(t))
    return re.sub(r'\s+', ' ', t).strip()


def paras(path):
    z = zipfile.ZipFile(path)
    xml = z.read('word/document.xml').decode('utf-8', 'replace')
    out = []
    for p in re.findall(r'<w:p\b[^>]*>.*?</w:p>', xml, re.S):
        body = re.sub(r'<w:pPr>.*?</w:pPr>', '', p, flags=re.S)
        body = re.sub(r'<w:tab\b[^>]*>', '<w:t> </w:t>', body)
        txt = clean(''.join(re.findall(r'<w:t(?:\s[^>]*)?>(.*?)</w:t>', body, re.S)))
        if txt:
            out.append(txt)
    return out


def fold(s):
    s = unicodedata.normalize('NFD', s.lower())
    return ''.join(c for c in s if unicodedata.category(c) != 'Mn')


def anchor_from_desig(desig):
    s = str(desig).lower().strip()
    s = re.sub(r'^premier\b', '1', s)
    s = re.sub(r'(\d)\s*(?:er|ère)(?=[\s.\-]|$)', r'\1', s)
    s = re.sub(r'(\d)\s*(bis|ter|quater)', r'\1-\2', s)
    s = re.sub(r'[.\s]+', '-', s)
    s = re.sub(r'-+', '-', s)
    return 'art-' + s.strip('-')


ART_HEAD = re.compile(
    r'^Art(?:icle)?\s+(premier|\d{1,4}(?:\s*(?:er|ère))?(?:\s*(?:bis|ter|quater))?(?:-\d+)?)'
    r'[\s.]*(\([^)]{1,60}\))?[\s.:]*[-–—·]\s*(.*)$', re.I)
ORD = r'PREMIER|PREMIÈRE|PREMIERE|DEUXI[ÈE]ME|SECOND|TROISI[ÈE]ME|QUATRI[ÈE]ME|CINQUI[ÈE]ME|SIXI[ÈE]ME|SEPTI[ÈE]ME|HUITI[ÈE]ME|NEUVI[ÈE]ME|DIXI[ÈE]ME'
STRUCT = re.compile(rf'^\s*(TITRE|CHAPITRE|SECTION|LIVRE|ANNEXE)\s+({ORD}|[IVXLC]+|\d+)?\b', re.I)
PARA_HDR = re.compile(r'^§\s*\d')
MON = re.compile(r'^Mon\.?\s*(?:No|N[ºo°])?\s*([\dA-Z\-]+(?:\s*(?:et|&)\s*[\dA-Z\-]+)?)\s+du\s+(1er|\d{1,2})\s+(\S+)\s+(\d{4})', re.I)
DESIG_TITLE = re.compile(
    r'\b(Loi|Décret-loi|Décret|Arrêté(?:\s+présidentiel)?|Règlements?|Convention|Arrangement|Accord|Protocole|Règles)\b'
    r'(?:\s+du\s+Gouvernement\s+Militaire)?(?:\s+en\s+date)?(?:\s+du\s+|\s+des\s+)?(1er|\d{1,2})?\s*(\S+)?\s*(\d{4})?', re.I)

MONTH_N = {m: i + 1 for i, m in enumerate(
    ['janvier', 'fevrier', 'mars', 'avril', 'mai', 'juin', 'juillet', 'aout', 'septembre', 'octobre', 'novembre', 'decembre'])}
ABBR = {'jan': 1, 'fev': 2, 'avr': 4, 'juil': 7, 'sept': 9, 'oct': 10, 'nov': 11, 'dec': 12}


def month_num(m):
    if not m:
        return None
    m = fold(m).rstrip('.')
    return MONTH_N.get(m) or ABBR.get(m)


def parse_one(path, meta):
    P = paras(path)
    anomalies = []
    toc, body, labels, status = [], [], {}, {}
    seen = set()
    sec_n = 0
    i = 0
    # 1) titre (ligne 1) — le CSV fait foi ; signale un écart important
    # (même préfixe « N°) » retiré des deux côtés avant comparaison)
    line0 = re.sub(r'^\d+°?\)\s*', '', P[0]) if P else ''
    if P and fold(line0)[:40] != fold(meta['title'])[:40]:
        anomalies.append(f'titre docx ≠ CSV : « {line0[:70]} »')
    if P:
        i = 1
    # 2) référence Moniteur (ligne 2)
    moniteur, pubdate = None, None
    if i < len(P):
        m = MON.match(P[i])
        if m:
            num = m.group(1)
            day = 1 if m.group(2) == '1er' else int(m.group(2))
            mo = month_num(m.group(3))
            moniteur = f'Le Moniteur n° {num} du {m.group(2)} {m.group(3)} {m.group(4)}'
            if mo:
                pubdate = f'{m.group(4)}-{mo:02d}-{day:02d}'
            i += 1
    # 3) corps
    while i < len(P):
        t = P[i]
        # Convention maritime : « Règle N » seule sur sa ligne → article « Règle N » (ancre art-N)
        rg = re.match(r'^R[èe]gle\s+(\d{1,3})\s*$', t, re.I)
        if rg:
            anchor = f'art-{rg.group(1)}'
            if anchor not in seen:
                seen.add(anchor)
                labels[anchor] = f'Règle {rg.group(1)}'
            body.append(f'Article {rg.group(1)}.- (Règle {rg.group(1)})')
            i += 1
            continue
        m = ART_HEAD.match(t)
        if m:
            desig = m.group(1)
            anchor = anchor_from_desig(desig)
            if anchor in seen:
                anomalies.append(f'article en double : {anchor}')
            else:
                seen.add(anchor)
                disp = '1er' if desig.lower() == 'premier' else re.sub(r'\s+', ' ', desig).strip()
                labels[anchor] = f'Article {disp}'
                paren = m.group(2) or ''
                rest = m.group(3) or ''
                if re.search(r'abrogé', paren, re.I) or re.match(r'^\(?\s*(anciennement\s+\d+\s*,\s*)?abrogé', rest, re.I):
                    status[anchor] = 'abrogé'
                elif re.match(r'^\(\s*(L|D|Loi|Décret|Decret|Arr)', paren):
                    status[anchor] = 'modifié'
            # normalise la tête en « Article N.- … » (lecteur AnnotatedText)
            head = f'Article {labels.get(anchor, desig).replace("Article ", "")}{" " + (m.group(2) or "") if m.group(2) else ""}.- {m.group(3) or ""}'.rstrip()
            body.append(clean(head))
            i += 1
            continue
        sm = STRUCT.match(t)
        if (sm or PARA_HDR.match(t)) and len(t) < 120:
            sec_n += 1
            label = clean(t)
            # description sur la ligne suivante (courte, sans ponctuation finale)
            if i + 1 < len(P) and len(P[i + 1]) < 100 and not ART_HEAD.match(P[i + 1]) and not STRUCT.match(P[i + 1]) \
               and not P[i + 1].rstrip().endswith(('.', ';', ':')):
                label = clean(f'{t} — {P[i + 1]}')
                i += 1
            toc.append({'level': 3 if (sm and sm.group(1).upper() in ('TITRE', 'LIVRE', 'ANNEXE')) else 4,
                        'label': label, 'anchor': f'sec-{sec_n}', 'kind': (sm.group(1).lower() if sm else 'para')})
            body.append(label)
            i += 1
            continue
        body.append(t)
        i += 1

    structure = None
    if labels:
        navToc = [{'label': meta['title'][:80], 'anchor': toc[0]['anchor'] if toc else 'sec-1',
                   'children': [{'label': e['label'], 'anchor': e['anchor']} for e in toc]}] if toc else []
        structure = {
            'title': meta['title'], 'annotationAuthor': 'Édition Vandal',
            'navToc': navToc, 'toc': toc, 'connexes': [], 'jurisprudence': {},
            'commentaires': {}, 'connexe': {}, 'indexEntries': [],
            'oldVersions': {}, 'status': status, 'labels': labels, 'crossRefs': [],
        }
    else:
        anomalies.append('aucun article détecté (texte rendu sans ancres — convention/règlement ?)')

    # désignation → Document.number (« Décret du 10 octobre 1979 »)
    dm = DESIG_TITLE.search(meta['title'])
    number = None
    if dm:
        parts = [dm.group(1)]
        if dm.group(2) and dm.group(3) and dm.group(4):
            parts += ['du' if dm.group(2) else '', f'{dm.group(2)} {dm.group(3)} {dm.group(4)}']
        number = clean(' '.join(x for x in parts if x))
    return {
        'id': meta['id'], 'partie': meta['partie'], 'rubrique': meta['rubrique'],
        'title': meta['title'], 'number': number, 'moniteurRef': moniteur, 'publicationDate': pubdate,
        'body': '\n'.join(body), 'structure': structure,
        'stats': {'paras': len(P), 'articles': len(labels), 'toc': len(toc), 'statuts': len(status)},
        'anomalies': anomalies,
    }


rows = list(csv.DictReader(open(os.path.join(ROOT, 'Officiel_Inventaire_repertoire.csv'), encoding='utf-8')))
files = {}
for d in os.listdir(ROOT):
    dp = os.path.join(ROOT, d)
    if os.path.isdir(dp):
        for f in os.listdir(dp):
            if f.endswith('.docx'):
                files[f.split('_')[0]] = os.path.join(dp, f)

os.makedirs(PARSED, exist_ok=True)
report = Counter()
anom_total = []
for r in rows:
    rid = r['id']
    if rid == '0':
        continue
    if rid in EXCLUDED:
        report['exclus'] += 1
        continue
    meta = {'id': rid, 'partie': r['partie'], 'rubrique': r['rubrique'],
            'title': clean(re.sub(r'^\d+°?\)\s*', '', r['intitulé (source Vandal)']))}
    res = parse_one(files[rid], meta)
    json.dump(res, open(os.path.join(PARSED, f'{rid}.json'), 'w'), ensure_ascii=False, indent=1)
    report[f'partie {r["partie"]}'] += 1
    report['articles'] += res['stats']['articles']
    for a in res['anomalies']:
        anom_total.append(f'{rid}: {a}')

print(dict(report))
print(f'\nanomalies ({len(anom_total)}) :')
for a in anom_total:
    print(' ·', a)
