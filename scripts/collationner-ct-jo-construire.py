#!/usr/bin/env python3
"""COLLATION DU CODE DU TRAVAIL CONTRE LE J.O. n° 18-A — opérations « reecrire » pour corriger-ct-mot-a-mot.tsx.
N'applique que les leçons du J.O. confirmées (transcription + Tesseract identiques, ou lues sur l'image :
lot-jo-K.json / resultat-jo-K.json) ; garde la base pour les coquilles du J.O., les césures de la transcription,
les intitulés et notes, et les art. 109-111 (rédaction postérieure, version en vigueur). Voir la livraison, § 9.

    /usr/bin/python3 scripts/collationner-ct-jo-construire.py <dossier jo> <sortie.json>
"""
import difflib, glob, json, re, sys, unicodedata, collections
D, OUT = sys.argv[1], sys.argv[2]
N = lambda s: re.sub(r'\s+', ' ', s).strip()
B = open(D + '/base.txt', encoding='utf8').read().split('\n')
ann = json.load(open(D + '/ann.json'))
table = [N(t['label']) for t in ann['toc']]
annexe = N(next(t['label'] for t in ann['toc'] if t['kind'] == 'connexe'))
P = json.load(open(D + '/jo-paras.json'))
MARQ = re.compile(r'^(?:[a-z]\s?\)|\d{1,2}\s?°?\s?\)|\d{1,2}\.|•|–|-)\s+')
TOKRE = re.compile(r"[0-9A-Za-zÀ-ÖØ-öø-ÿŒœ]+|[^\s0-9A-Za-zÀ-ÖØ-öø-ÿŒœ]")

# lignes d'article de la base, comme corriger-ct-mot-a-mot.tsx (intitulés de table hors article, têtes en séquence)
art, ptr, n, cur = {'preambule': []}, 0, 0, 'preambule'
for i, l in enumerate(B):
    s = N(l)
    if s and ptr < len(table) and s == table[ptr]:
        ptr += 1
        if s == annexe:
            break
        cur = None if cur != 'preambule' else 'preambule'
        continue
    m = re.match(r'^Article\s+(\d{1,3})\.', s)
    if m and int(m.group(1)) == n + 1:
        n += 1; cur = str(n); art[cur] = []
    if cur and l.strip():
        art[cur].append(i)

def jtok(lines):
    out = []
    for li in lines:
        l = B[li]
        m = MARQ.match(l)
        off = m.end() if m else 0
        for t in TOKRE.finditer(l[off:]):
            v = t.group(0).replace('’', "'").replace('–', '-').replace('—', '-')
            out.append((v, li, off + t.start(), off + t.end()))
    return out

# transcription, découpée comme dans trier.py
ent = {i for i, (s, g, t) in enumerate(P) if s or (g and not t.startswith('Article'))}
j, cur, n = {'preambule': []}, 'preambule', 0
for i, (s, g, t) in enumerate(P):
    t = N(t)
    if not t or i in ent:
        continue
    m = re.match(r'^Article\s+(\d{1,3})\s*\.', t)
    if m and int(m.group(1)) == n + 1:
        n += 1; cur = str(n); j[cur] = []
    j[cur].append(t)
fold_ = lambda x: unicodedata.normalize('NFD', x).encode('ascii', 'ignore').decode().lower()
def ttok(lines):
    s = ' '.join(MARQ.sub('', l) for l in lines).replace('’', "'").replace('–', '-').replace('—', '-')
    s = re.sub(r'^(Article\s+\d+)\s*\.\s*-?\s*', r'\1. ', s)
    return TOKRE.findall(s)

# verdicts : tri à trois témoins, puis lectures sur l'image
E = json.load(open(D + '/ecarts-jo.json'))
lu = {}
for k in range(1, 7):
    items = json.load(open(f'{D}/lot-jo-{k}.json'))
    r = json.load(open(f'{D}/resultat-jo-{k}.json'))
    pts = r['points'] if isinstance(r, dict) else r
    for x in pts:
        it = items[x['i']]
        lu[(it['article'], it['base'], it['jo'])] = x
EXCLUS = {'109', '110', '111'}
# Coquilles du J.O. (mot absent du vocabulaire des codes en base, forme correcte en base) : la base garde la bonne leçon
# (décision « coquilles : uniquement corriger »). Les formes correctes que le J.O. rend à Salès, elles, s'appliquent
# (« philanthropique », « infectieuses », « occasionnel »).
COQUILLES_JO = {'incrire', 'enfâmante', 'afflicitive', 'extratives', 'intermitent', 'spectales', 'notammenent', 'consultatjon',
                'conditons', 'look', 'secrétairiat', 'permiers', 'dand', 'fonctins', 'enciente', 'chacunes', 'encoura', 'minimun',
                'heuheures', 'inexats', 'emprisonement', 'aves', 'pous', 'ferié', 'réglements'}
# Lectures à confiance moyenne qui changent le sens : soumises à Me Vaval, pas appliquées.
SOUMIS = {('422', 'porter', 'inviter'), ('423', '. 4', '3'), ('423', 'du Chapitre III', ''), ('423', 'paragraphes', 'paragraphe'), ('423', '', 'Gdes')}
HORS_LOI = re.compile(r'Presses Nationales|SocialesPrésident|CassationVice')
ENTETE = re.compile(r'\b(?:CHAPITRE|SECTION|TITRE|LOI\s+No|Chapitre|Section|Titre)\b|Voir également|^\*|Moniteur No')

def detok(ts):
    s = ' '.join(ts)
    s = re.sub(r'\s+([,.;:)\]»!?])', r'\1', s)
    s = re.sub(r'([(\[«])\s+', r'\1', s)
    s = re.sub(r"\s*'\s*", '’', s)
    s = re.sub(r'\s*/\s*', '/', s)          # « 50 o/o »
    s = re.sub(r'(?<=\.)\s*-\s*-', '--', s)  # « 1.000.-- »
    return s
def nettoyer(l):
    l = re.sub(r'(?<=\S)\s+([,.)])', r'\1', l)
    l = re.sub(r'([(])\s+', r'\1', l)
    l = re.sub(r'’\s+', '’', l)
    l = re.sub(r'(\d)\s*o/o', r'\1 o/o', l)   # « 50 o/o », comme le J.O.
    return re.sub(r' {2,}', ' ', l)

ops, decomptes, revoir = [], collections.Counter(), []
for k in art:
    if k == 'preambule' or k in EXCLUS or k not in j:
        continue
    A = jtok(art[k])
    Av = [a[0] for a in A]
    # la base compare sans espace avant « ; : » (typographie) : les jetons sont les mêmes
    T = ttok(j[k])
    sm = difflib.SequenceMatcher(None, Av, T, autojunk=False)
    edits = []
    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag == 'equal':
            continue
        a, t = ' '.join(Av[i1:i2]), ' '.join(T[j1:j2])
        e = next((x for x in E if x['article'] == k and x['base'] == a and x['jo'] == t), None)
        if not e:
            continue
        if ENTETE.search(a) or ENTETE.search(t) or (i1 == i2 and len(T[j1:j2]) > 8) or (j1 == j2 and len(Av[i1:i2]) > 8):
            decomptes['écarté (intitulé, note, long)'] += 1; continue
        if (k, a, t) in SOUMIS or (a == 'aux' and t == 'au'):
            decomptes['soumis ou coquille d’accord : base gardée'] += 1; continue
        # Trait d'union de fin de ligne recopié par la transcription (« quel-que », « sous- Entrepreneur ») : la base garde
        # le mot entier.
        if '-' in a.split() + t.split() and fold_(a.replace(' ', '').replace('-', '')) == fold_(t.replace(' ', '').replace('-', '')):
            decomptes['césure de la transcription : base gardée'] += 1; continue
        if '-' in t.split() or '-' in a.split():
            decomptes['trait d’union : base gardée'] += 1; continue
        if HORS_LOI.search(t) or set(re.findall(r"[a-zà-öø-ÿœ]+", t.lower())) & COQUILLES_JO:
            decomptes['coquille du J.O. ou hors loi : base gardée'] += 1; continue
        v = e['verdict']
        if v == 'image':
            x = lu.get((k, a, t))
            if not x:
                decomptes['non lu'] += 1; continue
            v = {'jo': 'jo', 'base': 'base'}.get(x['verdict'], x['verdict'])
            if v == 'autre':
                revoir.append({'article': k, 'base': a, 'jo': t, 'imprime': x.get('imprime'), 'note': x.get('note')}); decomptes['autre'] += 1; continue
            if v == 'illisible':
                decomptes['illisible'] += 1; continue
        decomptes[v] += 1
        if v != 'jo':
            continue
        if i1 < i2 and A[i1][1] != A[i2 - 1][1]:
            revoir.append({'article': k, 'base': a, 'jo': t, 'note': 'à cheval sur deux lignes'}); continue
        edits.append((i1, i2, j1, j2, a, t))
    if not edits:
        continue
    lignes = {li: B[li] for li in art[k]}
    for i1, i2, j1, j2, a, t in sorted(edits, key=lambda e: -e[0]):
        rep = detok(T[j1:j2])
        if i1 < i2:
            li, s0, s1 = A[i1][1], A[i1][2], A[i2 - 1][3]
        else:  # insertion après le jeton précédent
            li, s0 = A[i1 - 1][1], A[i1 - 1][3]; s1 = s0
            if rep and re.match(r'\w', rep[0]):
                rep = ' ' + rep
        l = lignes[li]
        lignes[li] = l[:s0] + rep + l[s1:]
    nouv = [nettoyer(lignes[li]) if lignes[li] != B[li] else B[li] for li in art[k]]
    ops.append({'type': 'reecrire', 'ancre': f'art-{k}', 'lignes': nouv, 'ecarts': [{'base': e[4], 'jo': e[5]} for e in edits],
                'preuve': 'J.O. n° 18-A du 5 mars 1984 : transcription + Tesseract concordants, ou lecture sur l’image'})
json.dump({'operations': ops}, open(OUT, 'w'), ensure_ascii=False, indent=1)
json.dump(revoir, open(D + '/jo-a-revoir.json', 'w'), ensure_ascii=False, indent=1)
print('articles réécrits', len(ops), '| écarts appliqués', sum(len(o['ecarts']) for o in ops), '| décomptes', dict(decomptes), '| à revoir', len(revoir))
