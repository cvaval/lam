#!/usr/bin/env python3
"""Construit l'annotationsJson (schéma AnnotatedText) du Code des Douanes à partir de son
bodyOriginal EXISTANT (jamais modifié — §02) + de son themeIndexJson.

- toc / navToc : en-têtes RÉELS (TITRE/CHAPITRE/Section) du corps des articles UNIQUEMENT
  (le sommaire annexé en fin de document — lignes à tabulations/numéros de page — est exclu ;
  les libellés du toc sont pris VERBATIM sur les lignes du corps → segmentAnnotated apparie).
- labels : « Article N » / « Article N bis » (ancres art-N via anchors.ts).
- indexEntries : INVERSION du themeIndexJson (thème → articles) = index thématique du menu latéral,
  comme l'index du Code civil. ctRefs = num du themeIndex (« 1 », « 1-bis »), aligné sur les ancres.

Entrées : scratch/cd_body.txt + scratch/cd_themeindex.json → OUT/annotations.json
Cohérent avec src/lib/doc/anchors.ts (rendu + index + renvois).
"""
import re, json, os
OUT = os.path.dirname(os.path.abspath(__file__))
SCRATCH = os.environ['SCRATCH']

body = open(os.path.join(SCRATCH, 'cd_body.txt')).read()
theme_index = json.load(open(os.path.join(SCRATCH, 'cd_themeindex.json')))
lines = body.split('\n')


def anchor_from_desig(desig):
    s = str(desig).lower().strip()
    s = re.sub(r'^premier\b', '1', s)
    s = re.sub(r'(\d)\s*(?:er|ère)(?=[\s.\-]|$)', r'\1', s)
    s = re.sub(r'(\d)\s*(bis|ter|quater)', r'\1-\2', s)
    s = re.sub(r'[.\s]+', '-', s)
    s = re.sub(r'-+', '-', s)
    return 'art-' + s.strip('-')


ART = re.compile(r'^Article\s+(\d{1,4}(?:\s*(?:er|ère))?(?:\s*(?:bis|ter|quater))?)', re.I)
HDR = re.compile(r'^(LIVRE|TITRE|CHAPITRE|Section|SECTION|SOUS-SECTION)\b')
KIND_LEVEL = {'titre': 1, 'chapitre': 3, 'section': 4, 'livre': 1, 'sous-section': 5}
KIND_RANK = {'livre': 0, 'titre': 1, 'chapitre': 2, 'section': 3, 'sous-section': 4}


def is_real_header(t):
    """En-tête RÉEL : pas une ligne de sommaire (tabulation ou renvoi de page « / NN »)."""
    if '\t' in t or re.search(r'/\s*\d', t):
        return False
    return bool(HDR.match(t.strip()))


def kind_of(t):
    m = HDR.match(t.strip())
    return m.group(1).lower() if m else None


# Borne : dernière tête d'article → tout en-tête au-delà appartient au sommaire annexé.
last_art_line = max((i for i, l in enumerate(lines) if ART.match(l.strip())), default=len(lines))

toc = []
labels = {}
sec_n = 0
seen_art = set()
gaps = []

for i, raw in enumerate(lines):
    t = raw.strip()
    if not t:
        continue
    m = ART.match(t)
    if m and i <= last_art_line:
        desig = re.sub(r'\s+', ' ', m.group(1)).strip()
        a = anchor_from_desig(desig)
        if a not in seen_art:
            seen_art.add(a)
            disp = re.sub(r'\s*(bis|ter|quater)', lambda mm: ' ' + mm.group(1).lower(), desig, flags=re.I)
            disp = re.sub(r'\s+', ' ', disp).strip()
            labels[a] = 'Article ' + disp
        continue
    if i <= last_art_line and is_real_header(raw):
        k = kind_of(t)
        sec_n += 1
        toc.append({'level': KIND_LEVEL.get(k, 5), 'label': re.sub(r'\s+', ' ', t).strip(), 'anchor': f'sec-{sec_n}', 'kind': k})

# navToc : arbre par rang (Titre > Chapitre > Section > Sous-section)
root = {'label': 'Code des Douanes d’Haïti', 'anchor': toc[0]['anchor'] if toc else 'sec-1', 'children': []}
stack = [(-1, root)]
for e in toc:
    rank = KIND_RANK.get(e['kind'], 4)
    while len(stack) > 1 and stack[-1][0] >= rank:
        stack.pop()
    node = {'label': e['label'], 'anchor': e['anchor']}
    stack[-1][1].setdefault('children', []).append(node)
    stack.append((rank, node))
navToc = [root]

# ── Corps affiché (copie annotée) : on RETIRE les deux tables terminales redondantes
#    (« TABLE ANALYTIQUE » + « TABLE DES MATIÈRES » alphabétique) — désormais dans le menu
#    latéral (Sommaire + Index) — en gardant les articles ET les signatures. L'original
#    LÉGISLATION reste, lui, intégral (§02). ──
trim_end = next((i for i, l in enumerate(lines) if l.strip().upper().startswith('TABLE ANALYTIQUE')), len(lines))
body_trimmed = '\n'.join(lines[:trim_end]).rstrip() + '\n'
open(os.path.join(OUT, 'body_trimmed.txt'), 'w').write(body_trimmed)

# indexEntries : (a) index alphabétique CURATÉ du document (« sujet · art. N-M »), plus riche ;
#    (b) complété par l'inversion du themeIndexJson (thèmes). Fusion, dédup par sujet folé.
tdm = next((i for i, l in enumerate(lines) if 'TABLE DES MATI' in l.upper()), len(lines))
alpha_start = next((i for i in range(tdm, len(lines)) if re.match(r'^[A-ZÀ-Ÿ]$', lines[i].strip())), len(lines))


def expand_refs(s):
    out = []
    for tok in re.findall(r'\d+\s*(?:[-–]\s*\d+)?(?:\s*(?:bis|ter))?', s):
        m = re.match(r'(\d+)\s*[-–]\s*(\d+)', tok)
        if m:
            a, b = int(m.group(1)), int(m.group(2))
            out += [str(x) for x in range(a, b + 1)] if a <= b <= a + 60 else [str(a)]
        else:
            out.append(re.sub(r'\s*(bis|ter)', r'-\1', tok.strip()))
    return out


subj = {}  # sujet -> set d'ancres-suffixes (num)
for l in lines[alpha_start:]:
    t = l.strip()
    m = re.match(r'^(.+?)\s*·\s*art\.\s*(.+)$', t)
    if not m:
        continue
    s = re.sub(r'\s+', ' ', m.group(1)).strip()
    if not s or len(s) < 2:
        continue
    for r in expand_refs(m.group(2)):
        subj.setdefault(s, set()).add(r)
for entry in theme_index:
    num = str(entry.get('num', '')).strip()
    if not num:
        continue
    for th in entry.get('themes', []) or []:
        subj.setdefault(th, set()).add(num)


def sort_num(n):
    m = re.match(r'(\d+)', n)
    return (int(m.group(1)) if m else 0, n)


index_entries = [
    {'subject': s, 'ctRefs': sorted(v, key=sort_num)}
    for s, v in sorted(subj.items(), key=lambda kv: kv[0].lower())
]

structure = {
    'title': 'Code des Douanes d’Haïti', 'annotationAuthor': '',
    'navToc': navToc, 'toc': toc, 'connexes': [], 'jurisprudence': {},
    'commentaires': {}, 'connexe': {}, 'indexEntries': index_entries,
    'oldVersions': {}, 'status': {}, 'labels': labels, 'crossRefs': [],
}
json.dump(structure, open(os.path.join(OUT, 'annotations.json'), 'w'), ensure_ascii=False)

from collections import Counter
print('dernière tête d’article : ligne', last_art_line)
print('toc          :', len(toc), '—', dict(Counter(e['kind'] for e in toc)))
print('articles     :', len(labels), '(ancres uniques)')
print('index (thèmes):', len(index_entries), '· ctRefs totaux:', sum(len(e['ctRefs']) for e in index_entries))
# vérif : chaque ctRef de l'index correspond-il à un article connu ?
known = set(labels.keys())
missing = set()
for e in index_entries:
    for n in e['ctRefs']:
        if anchor_from_desig(n) not in known:
            missing.add(n)
print('ctRefs sans article correspondant :', sorted(missing)[:15], f'({len(missing)})')
print('ex labels bis :', {k: labels[k] for k in list(labels) if '-bis' in k or '-ter' in k})
