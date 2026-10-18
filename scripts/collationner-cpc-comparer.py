#!/usr/bin/env python3
"""COLLATION DU CODE DE PROCÉDURE CIVILE — phase 2 : base / livre (Tesseract) / couche Acrobat. LECTURE SEULE.
Prompt : docs/prompt-audit-code-procedure-civile-mot-a-mot.md (§ 2, § 4, § 5, § 7 étape 4).

Entrées : livre.json (phase 1), body.txt + ann.json (instantané de la base).
Sortie  : <dossier>/triangulation.json — par article : pages, verdict (conforme / à regarder), écarts de mots
          (base ↔ Tesseract, avec l'avis de la couche Acrobat), écarts d'alinéas, note de marge « Anc art ».

    python3 scripts/collationner-cpc-comparer.py <dossier de travail> <dossier instantané>

Règles (§ 2) : il n'existe pas, pour le CPC, de fichier de composition indépendant (la base vient de
`CPC_cumule_corrige.docx`, transcription de ce même livre). Les deux témoins sont deux OCR de l'image :
Tesseract (indépendant) et la couche Acrobat (2013). Un écart base ≠ Tesseract n'est du BRUIT que si (a) il se
réduit à une confusion classique d'OCR ou à de la ponctuation voisine ET (b) la couche Acrobat porte ce que porte
la base à cet endroit. Sinon : « à regarder » sur l'image.
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
L = O['lignes']

# ── Livre : têtes « Article N.- » (Times ou Helvetica gras), numéros, découpage ─────────────────────
HEADNUM = re.compile(r'^\W{0,2}Ar\s*t\s*[il1]\s*c\s*[l1I]\s*e\s*([lI1]\s*er|[\dIlO][\dSOolI$]{0,3})(?:\s*[-.]\s*(\d{1,2})(?=\s*[.\-(]))?', re.I)
TETE2 = re.compile(r'^\W{0,2}Ar\s*t\s*[il1]\s*c\s*[l1I]\s*e\s*(?:[lI1]\s*er|[\dIlO][\dSOolI]{0,3})(?:\s*[-.]\s*\d{1,2})?\s*(?:\(|[.,:]?\s*[-–—])')
ENUM = re.compile(r'^(?:\d{1,2}\s*°?\s*\)|\d{1,2}\s*°|\d{1,2}\s*[.-]\s*-|[a-h]\s*\)|[IVX]{1,4}\s*[.)-]|[-–—]\s)')
FIN = re.compile(r'[.:;!?»)]\s*\d{0,2}\s*$')


def candidats(l):
    """Numéros possibles d'une tête : la lecture Acrobat ET celle de Tesseract (la séquence départage)."""
    out = []
    for src in (l.get('acrobat') or '', l.get('tesseract') or ''):
        m = HEADNUM.match(src)
        if not m:
            continue
        s = re.sub(r'\s', '', m.group(1))
        if re.fullmatch(r'[lI1]er', s, re.I):
            c = (1, 0)
        else:
            s = s.translate(str.maketrans('SOolI$', '500115'))
            if not s.isdigit():
                continue
            c = (int(s), int(m.group(2)) if m.group(2) else 0)
        if c not in out:
            out.append(c)
    return out


for l in L:  # la tête se juge aussi sur Tesseract (« Article IO.- » à la couche, « Article 10.- » à l'OCR)
    l['tete'] = bool(l['tete'] or TETE2.match(l.get('tesseract') or ''))
tetes = [i for i, l in enumerate(L) if l['tete']]
cands = [candidats(L[i]) for i in tetes]
# Plus longue sous-suite croissante sur (tête, candidat).
etats = [(k, c) for k in range(len(tetes)) for c in cands[k]]
best, prev = {}, {}
for (k, c) in etats:
    best[(k, c)], prev[(k, c)] = 1, None
    for j in range(max(0, k - 80), k):
        for c2 in cands[j]:
            if c2 < c and c[0] - c2[0] <= (k - j) + 25 and best[(j, c2)] + 1 > best[(k, c)]:
                best[(k, c)], prev[(k, c)] = best[(j, c2)] + 1, (j, c2)
fin_ = max(best, key=lambda e: best[e]) if best else None
attribue = [None] * len(tetes)
while fin_ is not None:
    attribue[fin_[0]] = fin_[1]
    fin_ = prev[fin_]
sure = {k for k in range(len(tetes)) if attribue[k] is not None}
nums = [cands[k][0] if cands[k] else None for k in range(len(tetes))]
cle = lambda t: f'{t[0]}' if not t[1] else f'{t[0]}-{t[1]}'
livre, doublons = {}, []
for k, i in enumerate(tetes):
    if attribue[k] is None:
        continue  # tête illisible : rattachée à l'article précédent, signalée plus bas
    fin = next((tetes[j] for j in range(k + 1, len(tetes)) if attribue[j] is not None), len(L))
    n = cle(attribue[k])
    if n in livre:
        doublons.append(n)
        continue
    livre[n] = {'lignes': L[i:fin], 'page': L[i]['page'], 'lu': nums[k]}
illisibles = [L[tetes[k]]['page'] for k in range(len(tetes)) if attribue[k] is None]


def alineas(lignes):
    """Bornes d'alinéa du livre : interligne (≥ 15 pt pour un pas de 12,4-13), énumération, ligne courte finale."""
    out = []
    for i, l in enumerate(lignes):
        t = (l['tesseract'] or l['acrobat']).strip()
        if i == 0:
            out.append([t])
            continue
        p = lignes[i - 1]
        pt = (p['tesseract'] or p['acrobat']).strip()
        courte = p.get('droite') is not None and p['x1'] < p['droite'] - 14
        meme = p['page'] == l['page'] and p['col'] == l['col']
        ecart = l['y0'] - p['y0'] if meme else None
        if ENUM.match(t) and (l['retrait'] > -2):
            nouv = True
        elif meme and ecart >= 15.0:
            nouv = True
        elif meme:
            nouv = False
        else:  # saut de colonne ou de page : nouvel alinéa si la ligne d'avant finissait court sur une ponctuation
            nouv = bool(FIN.search(pt)) and courte
        if nouv:
            out.append([t])
        else:
            out[-1].append(t)
    return out


# ── Base : découpée comme le lecteur (intitulés = égalité exacte avec la table, parcourue dans l'ordre) ──
corps = (SNAP / 'body.txt').read_text(encoding='utf-8').split('\n')
ann = json.loads((SNAP / 'ann.json').read_text(encoding='utf-8'))
table = [re.sub(r'\s+', ' ', t['label']).strip() for t in ann['toc']]
ART = re.compile(r'^Article\s+(1er|\d{1,4}(?:-\d{1,2})?)\b')
base, hors = {}, []
cur, ptr = None, 0
for idx, l in enumerate(corps):
    s = re.sub(r'\s+', ' ', l).strip()
    if not s:
        continue
    if ptr < len(table) and s == table[ptr]:
        ptr += 1
        cur = None
        continue
    m = ART.match(s)
    if m:
        cur = m.group(1).replace('1er', '1')
        base[cur] = [l]
        continue
    if cur:
        base[cur].append(l)
    else:
        hors.append((idx, l))
commentaires = ann.get('commentaires', {})


def canon(s):
    s = s.replace('’', "'").replace('‘', "'").replace(' ', ' ').replace(' ', ' ').replace(' ', ' ')
    s = re.sub(r'^(Article\s+(?:1er|\d{1,4}(?:-\d{1,2})?))(\s*\([^)]*\))?\s*\.?\s*[-–—]\s*', r'\1\2.- ', s)
    s = re.sub(r'\s+([;:!?»])', r'\1', s)
    s = re.sub(r'«\s+', '«', s)
    return re.sub(r'\s+', ' ', s).strip()


TOK = re.compile(r"[0-9A-Za-zÀ-ÖØ-öø-ÿŒœ]+|[^\s0-9A-Za-zÀ-ÖØ-öø-ÿŒœ]")
jetons = lambda s: TOK.findall(canon(s))


def recoudre(lignes_al, vocab):
    txt = ''
    for ln in lignes_al:
        ln = ln.strip()
        if not txt:
            txt = ln
            continue
        m = re.search(r'([A-Za-zÀ-ÿœ]+)-$', txt)
        if m and not txt.endswith('.-') and re.match(r'[a-zà-ÿœ]', ln):
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
# Restes de la mise en page que l'extraction n'a pas pu écarter : notes de marge prises dans une ligne (« dé- 894 fr
# clareront », « Anc art 763dans »), filets en tirets.
RESTES = re.compile(r"(?:\b(?:A[nm][ce]|ne|nc)\.?\s*art\.?\s*[\dSOolI]{1,4}|\b(?:Art\.?\s*)?\d{1,4}\s*fr\b,?|(?:-\s*){4,})", re.I)
nettoyer = lambda s: re.sub(r'\s+', ' ', RESTES.sub(' ', s)).strip()


def proches(a_seg, t_seg):
    a, t = cle_ocr(a_seg), cle_ocr(t_seg)
    return a == t or (len(a) >= 3 and difflib.SequenceMatcher(None, a, t).ratio() >= 0.75)


def ecarts(a, b):
    sm = difflib.SequenceMatcher(None, a, b, autojunk=False)
    return [op for op in sm.get_opcodes() if op[0] != 'equal'], sm


# Notes de marge « Anc art N » : rattachées à l'article dont la tête est sur la même page/colonne, juste au-dessus.
ANC = re.compile(r'A[nm][ce]\.?\s*art\.?\s*([\dSOolI]{1,4})', re.I)
marges_par_art = collections.defaultdict(list)
for mg in O['marges']:
    m = ANC.search(mg['acrobat'])
    if not m:
        continue
    cand = [(n, b) for n, b in livre.items() if b['page'] == mg['page'] and b['lignes'][0]['col'] == mg['col']
            and b['lignes'][0]['y0'] - 2 <= mg['y0'] <= b['lignes'][0]['y0'] + 30]
    if cand:
        n = min(cand, key=lambda x: abs(x[1]['lignes'][0]['y0'] - mg['y0']))[0]
        marges_par_art[n].append(m.group(1).translate(str.maketrans('SOolI', '50011')))

res, cpt = {}, collections.Counter()
cles_base = list(base.keys())
for n in cles_base:
    A_lignes = [x for x in base[n] if x.strip()]
    b = livre.get(n)
    r = {'article': n, 'page': b['page'] if b else None, 'tete_seule': bool(re.fullmatch(r'Article\s+\S+?\s*(\([^)]*\))?\s*\.?-\s*', A_lignes[0].strip()))}
    anc_base = [x for c in commentaires.get('art-' + n, []) if re.search(r'numérotation', c) for x in re.findall(r'\d{1,4}', c)]
    r['anc_base'], r['anc_livre'] = anc_base, marges_par_art.get(n, [])
    if not b:
        r.update(verdict='à regarder', motif='tête introuvable au livre')
        res[n] = r
        cpt[r['verdict']] += 1
        continue
    ref = '\n'.join(A_lignes)
    vocab = set(w.lower() for w in TOK.findall(canon(ref)))
    vocab |= set(w.lower() for w in re.findall(r"[A-Za-zÀ-ÿœ]+(?:-[A-Za-zÀ-ÿœ]+)+", canon(ref)))
    als_l = alineas(b['lignes'])
    als = [nettoyer(recoudre(al, vocab)) for al in als_l]
    als_acr = [recoudre([x['acrobat'] for x in []] or [], vocab)]  # (placeholder, voir ci-dessous)
    # Texte Acrobat, recousu sur les MÊMES alinéas
    acr, k = [], 0
    for al in als_l:
        objs = b['lignes'][k:k + len(al)]
        acr.append(nettoyer(recoudre([o['acrobat'] for o in objs], vocab)))
        k += len(al)
    # La base fusionne la tête seule (« Article 385.- ») à son premier alinéa pour la comparaison des MOTS.
    A_txt = ' '.join(A_lignes)
    A, T, C = jetons(A_txt), jetons(' '.join(als)), jetons(' '.join(acr))
    # Segment Acrobat aligné sur chaque plage de la base (même alignement pour toutes les plages).
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
    opsAT, smAT = ecarts(A, T)
    bruit, regard = [], []
    for tag, i1, i2, j1, j2 in opsAT:
        a_seg, t_seg = A[i1:i2], T[j1:j2]
        c_seg = seg_acrobat(i1, i2)
        cle_a, cle_t, cle_c = cle_ocr(a_seg), cle_ocr(t_seg), cle_ocr(c_seg)
        ponct = PONCT.match(''.join(a_seg)) and PONCT.match(''.join(t_seg))
        if not a_seg and len(''.join(t_seg)) <= 3 and re.fullmatch(r'[\W\d_]*', ''.join(t_seg)):
            bruit.append('appel de note'); continue                       # « paix.1 », « * », « ° »
        if colle(a_seg) and colle(a_seg) == colle(t_seg) and colle(c_seg) in (colle(a_seg), ''):
            bruit.append('espaces'); continue                             # « surle-champ », « Article436 »
        if cle_a == cle_t and (cle_c == cle_a or c_seg == a_seg):
            bruit.append('confusion'); continue                           # « 1er/ler/Ier », « État/Etat »
        if c_seg == a_seg and (ponct or proches(a_seg, t_seg) or len(''.join(t_seg)) <= 4):
            bruit.append('tesseract'); continue                           # la couche lit la base, Tesseract bute (« I ] »)
        ctx = ' '.join(A[max(0, i1 - 6):i1]) + ' ⟦' + ' '.join(a_seg) + '⟧ ' + ' '.join(A[i2:i2 + 6])
        regard.append({'base': ' '.join(a_seg), 'livre': ' '.join(t_seg), 'acrobat': ' '.join(c_seg), 'contexte': ctx,
                       'ocr_concordants': bool(t_seg or c_seg) and cle_ocr(c_seg) == cle_t})
    # Alinéas : bornes en indices de jetons de la base (la tête seule ne compte pas comme alinéa).
    lignes_al = A_lignes[:]
    if r['tete_seule'] and len(lignes_al) > 1:
        lignes_al = [lignes_al[0] + ' ' + lignes_al[1]] + lignes_al[2:]
    bornes_A, k = set(), 0
    for ln in lignes_al:
        bornes_A.add(k)
        k += len(jetons(ln))
    bornes_T_brutes, k = [], 0
    for al in als:
        bornes_T_brutes.append(k)
        k += len(jetons(al))
    carte = {}
    for blk in smAT.get_matching_blocks():
        for d in range(blk.size):
            carte[blk.b + d] = blk.a + d
    bornes_T = set()
    for bt in bornes_T_brutes:
        j = bt
        while j < len(T) and j not in carte:
            j += 1
        if j in carte:
            bornes_T.add(carte[j] - (j - bt))
    al_ecart = sorted(bornes_A ^ bornes_T)
    r.update({'alineas_base': len(lignes_al), 'alineas_livre': len(als), 'bornes_diff': al_ecart, 'ecarts': regard,
              'bruit': len(bruit), 'jetons': len(A), 'similitude': round(smAT.ratio(), 4), 'livre_texte': als,
              'lignes_livre': len(b['lignes']),
              'zone': [(l['page'], l['col'], round(l['y0'], 1)) for l in (b['lignes'][0], b['lignes'][-1])]})
    anc_ko = bool(r['anc_livre']) and sorted(r['anc_livre']) != sorted(anc_base)
    r['anc_ecart'] = anc_ko
    r['verdict'] = 'conforme' if not regard and not al_ecart and not r['tete_seule'] else 'à regarder'
    cpt[r['verdict']] += 1
    res[n] = r

absents_base = sorted(set(livre) - set(base), key=lambda s: tuple(map(int, s.split('-'))))
(WORK / 'triangulation.json').write_text(json.dumps(res, ensure_ascii=False, indent=0), encoding='utf-8')
print('têtes lues', len(tetes), '— numéros sûrs', len(sure), '— illisibles (pages)', illisibles[:20], '— doublons', doublons[:20])
print('articles base', len(base), '— au livre', len(livre), '— au livre sans base', absents_base[:20], '— lignes hors article', len(hors))
print(dict(cpt))
print(f"à écarts de mots : {sum(1 for r in res.values() if r.get('ecarts'))} ; d'alinéas : {sum(1 for r in res.values() if r.get('bornes_diff'))} ; "
      f"têtes seules : {sum(1 for r in res.values() if r.get('tete_seule'))} ; OCR concordants contre la base : "
      f"{sum(1 for r in res.values() for e in r.get('ecarts', []) if e['ocr_concordants'])} ; « Anc art » discordants : {sum(1 for r in res.values() if r.get('anc_ecart'))}")
print('similitude < 0,9 :', sorted((r['article'] for r in res.values() if r.get('similitude', 1) < 0.9), key=lambda s: tuple(map(int, s.split('-'))))[:60])
