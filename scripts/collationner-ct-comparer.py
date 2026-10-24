#!/usr/bin/env python3
"""COLLATION DU CODE DU TRAVAIL — phase 2 : base / livre (Tesseract) / couche Acrobat. LECTURE SEULE.
Prompt : docs/prompt-audit-code-du-travail-mot-a-mot.md (§ 2, § 4, § 5, § 7 étape 2). Adapté de collationner-cpc-comparer.py.

Entrées : livre.json (phase 1), body.txt + ann.json (instantané de la base).
Sortie  : <dossier>/triangulation.json — par article : pages, verdict (conforme / à regarder), écarts de mots
          (base ↔ Tesseract, avec l'avis de la couche Acrobat), écarts d'alinéas, MARQUEURS d'énumération.

    /usr/bin/python3 scripts/collationner-ct-comparer.py <dossier de travail> <dossier instantané>

Règles (§ 2) : la base vient d'un docx reconstitué à partir de ce même livre ; les deux témoins sont deux OCR de
l'image, Tesseract (indépendant) et la couche Acrobat. Un écart base ≠ Tesseract n'est du BRUIT que s'il se réduit à
une confusion classique d'OCR ou à de la ponctuation voisine ET que la couche Acrobat porte ce que porte la base.
Les marqueurs d'énumération (« a) », « 1°) », « • ») se comparent À PART : ils ne comptent pas dans les mots.
"""
import collections
import difflib
import json
import pathlib
import re
import sys
import unicodedata

WORK, SNAP = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2])
O = json.loads((WORK / 'livre.json').read_text(encoding='utf-8'))
L = [l for l in O['lignes'] if l['passage'] == 1 and len(re.sub(r'\W', '', l['acrobat'] + l['tesseract'])) >= 2]

# ── Livre : têtes « Article N. », numéros, découpage ─────────────────────────────────────────────────
HEADNUM = re.compile(r'^\W{0,2}Ar\s*t\s*[il1]\s*c\s*[l1I]\s*e\s*([lI1]\s*er|[\dIlO][\dSOolI$]{0,3})\s*[.,:]', re.I)
# Marqueur en tête de ligne : « a) », « b ) », « 1°) », « 1) », « • » (Tesseract lit la puce « e », « © », « ® »).
MARQ = re.compile(r'^\s*(?:([a-z])\s?\)|(\d{1,2})\s?°?\s?\)|(•|·|®|©|e(?=\s+[a-zà-ÿ’\'d]))|([-–—])(?=\s))\s*')
FIN = re.compile(r'[.:;!?»)]\s*$')


def candidats(l):
    out = []
    for src in (l.get('acrobat') or '', l.get('tesseract') or ''):
        m = HEADNUM.match(src)
        if not m:
            continue
        s = re.sub(r'\s', '', m.group(1))
        if re.fullmatch(r'[lI1]er', s, re.I):
            c = 1
        else:
            s = s.translate(str.maketrans('SOolI$', '500115'))
            if not s.isdigit():
                continue
            c = int(s)
        if c not in out:
            out.append(c)
    return out


for l in L:
    l['tete'] = bool(l['tete'] or HEADNUM.match(l.get('tesseract') or ''))
tetes = [i for i, l in enumerate(L) if l['tete']]
cands = [candidats(L[i]) for i in tetes]
etats = [(k, c) for k in range(len(tetes)) for c in cands[k]]
best, prev = {}, {}
for (k, c) in etats:
    best[(k, c)], prev[(k, c)] = 1, None
    for j in range(max(0, k - 60), k):
        for c2 in cands[j]:
            if c2 < c and c - c2 <= (k - j) + 12 and best[(j, c2)] + 1 > best[(k, c)]:
                best[(k, c)], prev[(k, c)] = best[(j, c2)] + 1, (j, c2)
fin_ = max(best, key=lambda e: best[e]) if best else None
attribue = [None] * len(tetes)
while fin_ is not None:
    attribue[fin_[0]] = fin_[1]
    fin_ = prev[fin_]
livre, doublons = {}, []
premiere = next((tetes[k] for k in range(len(tetes)) if attribue[k] is not None), len(L))
livre['preambule'] = {'lignes': L[:premiere], 'page': L[0]['page'] if L else None}
for k, i in enumerate(tetes):
    if attribue[k] is None:
        continue  # tête hors séquence (citation d'un décret : art. 110) ou illisible : reste dans l'article précédent
    fin = next((tetes[j] for j in range(k + 1, len(tetes)) if attribue[j] is not None), len(L))
    n = str(attribue[k])
    if n in livre:
        doublons.append(n)
        continue
    livre[n] = {'lignes': L[i:fin], 'page': L[i]['page']}
hors_sequence = [(L[tetes[k]]['page'], L[tetes[k]]['acrobat'][:40]) for k in range(len(tetes)) if attribue[k] is None]


def marqueur(t):
    m = MARQ.match(t)
    if not m:
        return None, t
    g = m.groups()
    mk = f'{g[0]})' if g[0] else f'{g[1]}°)' if g[1] and '°' in m.group(0) else f'{g[1]})' if g[1] else '•' if g[2] else '-'
    return mk, t[m.end():]


def alineas(lignes):
    """Alinéas du livre : tête, marqueur d'énumération, ou retrait de première ligne (≈ + 18-23 pt). La suite d'un
    point d'énumération est en retrait suspendu (≈ + 36) : ce n'est pas un nouvel alinéa."""
    out = []
    for i, l in enumerate(lignes):
        acr, tes = l['acrobat'].strip(), (l['tesseract'] or l['acrobat']).strip()
        mk_a, _ = marqueur(acr)
        mk_t, _ = marqueur(tes)
        mk = mk_a or (mk_t if mk_t != '•' else None)
        if mk == '-' and l['retrait'] < 10:
            mk = None  # « - Moniteur No. 79 du 11 novembre 1985). » : suite d'une ligne, pas un tiret d'énumération
        nouv = i == 0 or l['tete'] or (mk is not None and -2 <= l['retrait'] <= 30) or (10 <= l['retrait'] <= 30)
        # Suite d'un point d'énumération : plus en retrait que son marqueur (retrait suspendu).
        if nouv and not l['tete'] and mk is None and out and out[-1]['marqueur'] and l['page'] == out[-1]['lignes'][0]['page'] \
                and l['retrait'] > out[-1]['lignes'][0]['retrait'] + 8:
            nouv = False
        if nouv:
            out.append({'lignes': [l], 'marqueur': mk if i > 0 or not l['tete'] else None})
        else:
            out[-1]['lignes'].append(l)
    return out


# ── Base : le Code seul (jusqu'à « ANNEXE I »), découpé comme le lecteur ───────────────────────────────
corps = (SNAP / 'body.txt').read_text(encoding='utf-8').split('\n')
ann = json.loads((SNAP / 'ann.json').read_text(encoding='utf-8'))
fin_code = next(i for i, l in enumerate(corps) if l.startswith('ANNEXE I'))
table = [re.sub(r'\s+', ' ', t['label']).strip() for t in ann['toc']]
ART = re.compile(r'^Article\s+(\d{1,3})\.')
base, hors = {'preambule': []}, []
cur, ptr = 'preambule', 0
for idx, l in enumerate(corps[:fin_code]):
    s = re.sub(r'\s+', ' ', l).strip()
    if not s:
        continue
    if ptr < len(table) and s == table[ptr]:
        ptr += 1
        continue
    m = ART.match(s)
    if m and int(m.group(1)) == (0 if cur == 'preambule' else int(cur)) + 1:
        cur = m.group(1)
        base[cur] = [l]
        continue
    base[cur].append(l)


def canon(s):
    s = s.replace('’', "'").replace('‘', "'").replace(' ', ' ').replace(' ', ' ').replace("''", '"')
    s = re.sub(r'^(Article\s+\d{1,3})\s*\.\s*', r'\1. ', s)
    s = re.sub(r'\s+([;:!?»])', r'\1', s)
    s = re.sub(r'«\s+', '«', s)
    s = re.sub(r'(?:\s?\.){3,}', ' … ', s)  # points de conduite (barème de l'art. 45)
    return re.sub(r'\s+', ' ', s).strip()


TOK = re.compile(r"[0-9A-Za-zÀ-ÖØ-öø-ÿŒœ]+|[^\s0-9A-Za-zÀ-ÖØ-öø-ÿŒœ]")
jetons = lambda s: TOK.findall(canon(s))


def recoudre(lignes_txt, vocab):
    txt = ''
    for ln in lignes_txt:
        ln = ln.strip()
        if not txt:
            txt = ln
            continue
        m = re.search(r'([A-Za-zÀ-ÿœ]+)-$', txt)
        if m and re.match(r'[a-zà-ÿœ]', ln):
            suite = re.match(r'[A-Za-zÀ-ÿœ]+', ln).group(0)
            if (m.group(1) + suite).lower() in vocab or (m.group(1) + '-' + suite).lower() not in vocab:
                txt = txt[:-1] + ln
            else:
                txt = txt + ln
        else:
            txt = txt + ' ' + ln
    return txt


def sans_accent(s):
    return ''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn')


def cle_ocr(seq):
    s = sans_accent(''.join(seq)).lower()
    s = s.translate(str.maketrans({'1': 'l', 'i': 'l', '|': 'l', '!': 'l', '0': 'o', ',': '.', ';': '.', ':': '.',
                                   '—': '-', '–': '-', '"': "'", '`': "'", '°': 'o'}))
    s = s.replace('œ', 'oe').replace('rn', 'm').replace('ii', 'u').replace('cl', 'd')
    return re.sub(r"[.\-']+", '.', s)


PONCT = re.compile(r"^[^0-9A-Za-zÀ-ÖØ-öø-ÿŒœ]*$")


def proches(a_seg, t_seg):
    a, t = cle_ocr(a_seg), cle_ocr(t_seg)
    return a == t or (len(a) >= 3 and difflib.SequenceMatcher(None, a, t).ratio() >= 0.75)


res, cpt = {}, collections.Counter()
for n in base:
    A_lignes = [x for x in base[n] if x.strip()]
    b = livre.get(n)
    r = {'article': n, 'page': b['page'] if b else None}
    if not b:
        r.update(verdict='à regarder', motif='tête introuvable au livre')
        res[n] = r
        cpt[r['verdict']] += 1
        continue
    ref = '\n'.join(A_lignes)
    vocab = set(w.lower() for w in TOK.findall(canon(ref))) | set(w.lower() for w in re.findall(r"[A-Za-zÀ-ÿœ]+(?:-[A-Za-zÀ-ÿœ]+)+", canon(ref)))
    als = alineas(b['lignes'])
    # Texte de chaque alinéa, sans son marqueur ; Tesseract et Acrobat recousus sur les MÊMES alinéas.
    als_t, als_c, mk_livre = [], [], []
    for al in als:
        t = recoudre([(x['tesseract'] or x['acrobat']) for x in al['lignes']], vocab)
        c = recoudre([x['acrobat'] for x in al['lignes']], vocab)
        if al['marqueur']:
            t, c = marqueur(t)[1], marqueur(c)[1]
        als_t.append(t)
        als_c.append(c)
        mk_livre.append(al['marqueur'])
    mk_base, A_txts = [], []
    for ln in A_lignes:
        mk, reste = marqueur(ln)
        mk = mk if mk in ('•', '-') or (mk and re.match(r'^[a-z]\)$|^\d{1,2}°?\)$', mk)) else None
        mk_base.append(mk)
        A_txts.append(reste if mk else ln)
    A, T, C = jetons(' '.join(A_txts)), jetons(' '.join(als_t)), jetons(' '.join(als_c))
    smAC = difflib.SequenceMatcher(None, A, C, autojunk=False)
    carteAC = {}
    for blk in smAC.get_matching_blocks():
        for d in range(blk.size):
            carteAC[blk.a + d] = blk.b + d

    def seg_acrobat(i1, i2):
        g = next((carteAC[i] for i in range(i1 - 1, -1, -1) if i in carteAC), -1)
        dd = next((carteAC[i] for i in range(i2, len(A)) if i in carteAC), len(C))
        return C[g + 1:dd]

    colle = lambda seq: re.sub(r"[\s\-–—'’.]", '', cle_ocr(seq))
    smAT = difflib.SequenceMatcher(None, A, T, autojunk=False)
    bruit, regard = [], []
    for tag, i1, i2, j1, j2 in [op for op in smAT.get_opcodes() if op[0] != 'equal']:
        a_seg, t_seg = A[i1:i2], T[j1:j2]
        c_seg = seg_acrobat(i1, i2)
        cle_a, cle_t, cle_c = cle_ocr(a_seg), cle_ocr(t_seg), cle_ocr(c_seg)
        ponct = PONCT.match(''.join(a_seg)) and PONCT.match(''.join(t_seg))
        if not a_seg and len(''.join(t_seg)) <= 3 and re.fullmatch(r'[\W\d_]*', ''.join(t_seg)):
            bruit.append('appel de note'); continue
        if colle(a_seg) and colle(a_seg) == colle(t_seg) and colle(c_seg) in (colle(a_seg), ''):
            bruit.append('espaces'); continue
        if cle_a == cle_t and (cle_c == cle_a or c_seg == a_seg):
            bruit.append('confusion'); continue
        if c_seg == a_seg and (ponct or proches(a_seg, t_seg) or len(''.join(t_seg)) <= 4):
            bruit.append('tesseract'); continue
        ctx = ' '.join(A[max(0, i1 - 6):i1]) + ' ⟦' + ' '.join(a_seg) + '⟧ ' + ' '.join(A[i2:i2 + 6])
        regard.append({'base': ' '.join(a_seg), 'livre': ' '.join(t_seg), 'acrobat': ' '.join(c_seg), 'contexte': ctx,
                       'ocr_concordants': bool(t_seg or c_seg) and cle_ocr(c_seg) == cle_t})
    # Alinéas : bornes en indices de jetons.
    bornes_A, k = [], 0
    for ln in A_txts:
        bornes_A.append(k)
        k += len(jetons(ln))
    bornes_T_brutes, k = [], 0
    for al in als_t:
        bornes_T_brutes.append(k)
        k += len(jetons(al))
    carte = {}
    for blk in smAT.get_matching_blocks():
        for d in range(blk.size):
            carte[blk.b + d] = blk.a + d
    bornes_T = []
    for bt in bornes_T_brutes:
        j = bt
        while j < len(T) and j not in carte:
            j += 1
        bornes_T.append(carte[j] - (j - bt) if j in carte else None)
    sA, sT = set(bornes_A), set(x for x in bornes_T if x is not None)
    # Tolérance de ± 2 jetons : la tête collée par l'OCR (« Article3. ») décale l'alignement du premier jeton.
    pres = lambda x, S: any(abs(x - y) <= 2 for y in S)
    al_ecart = sorted({x for x in sA if not pres(x, sT)} | {x for x in sT if not pres(x, sA)})
    # Marqueurs : pour chaque alinéa du livre qui en porte un, celui de la ligne de base qui commence au même jeton.
    pos_base = dict(zip(bornes_A, mk_base))
    marqueurs = []
    for bt, mk in zip(bornes_T, mk_livre):
        if mk and bt is not None and bt in pos_base and pos_base[bt] != mk:
            marqueurs.append({'livre': mk, 'base': pos_base[bt] or '', 'debut': ' '.join(A[bt:bt + 6])})
    for ba, mk in zip(bornes_A, mk_base):
        if mk and ba not in sT:
            marqueurs.append({'livre': '(pas d’alinéa)', 'base': mk, 'debut': ' '.join(A[ba:ba + 6])})
    r.update({'alineas_base': len(A_txts), 'alineas_livre': len(als), 'bornes_diff': al_ecart, 'ecarts': regard,
              'marqueurs': marqueurs, 'marqueurs_livre': [m for m in mk_livre if m], 'bruit': len(bruit), 'jetons': len(A),
              'similitude': round(smAT.ratio(), 4), 'livre_texte': [((m + ' ') if m else '') + t for m, t in zip(mk_livre, als_t)],
              'pages': sorted({l['page'] for l in b['lignes']})})
    r['verdict'] = 'conforme' if not regard and not al_ecart and not marqueurs else 'à regarder'
    cpt[r['verdict']] += 1
    res[n] = r

(WORK / 'triangulation.json').write_text(json.dumps(res, ensure_ascii=False, indent=0), encoding='utf-8')
code = [r for k, r in res.items() if k != 'preambule']
print('têtes lues', len(tetes), '— hors séquence', len(hors_sequence), hors_sequence[:8], '— doublons', doublons[:10])
print('articles base', len(base) - 1, '— au livre', len(livre) - 1, '— sans tête au livre', [r['article'] for r in code if r.get('motif')][:20])
print(dict(cpt))
print(f"à écarts de mots : {sum(1 for r in code if r.get('ecarts'))} ({sum(len(r.get('ecarts', [])) for r in code)} écarts) ; "
      f"d'alinéas : {sum(1 for r in code if r.get('bornes_diff'))} ; de marqueurs : {sum(1 for r in code if r.get('marqueurs'))} "
      f"({sum(len(r.get('marqueurs', [])) for r in code)} points) ; OCR concordants contre la base : "
      f"{sum(1 for r in code for e in r.get('ecarts', []) if e['ocr_concordants'])}")
print('marqueurs du livre :', collections.Counter(re.sub(r'[a-z]', 'x', re.sub(r'\d+', 'n', m)) for r in code for m in r.get('marqueurs_livre', [])))
print('similitude < 0,9 :', sorted((r['article'] for r in code if r.get('similitude', 1) < 0.9), key=int)[:60])
