#!/usr/bin/env python3
"""COLLATION DU CODE CIVIL — phase 2 : triangulation base / CCH.docx / livre (Tesseract). LECTURE SEULE.
Prompt : docs/prompt-audit-code-civil-mot-a-mot.md (§ 2, § 4, § 5, § 7 étape 4).

Entrées : livre.json (phase 1), body.txt + ann.json + versions.json (instantané de la base),
          scripts/data/code-civil/cch-source.json.
Sortie  : <dossier>/triangulation.json — par article : pages, verdict (conforme / à regarder),
          écarts de mots (base ↔ livre, avec l'avis de CCH), écarts d'alinéas, italique.

    python3 scripts/collationner-code-civil-comparer.py <dossier de travail> <dossier instantané>

Règles (§ 2) : un écart base ≠ livre n'est du BRUIT D'OCR que si (a) il se réduit à des confusions
classiques de Tesseract (l/1/I, O/0, rn/m, accents, ponctuation voisine) ET (b) CCH porte ce que porte la
base à cet endroit. Sinon l'article est « à regarder » sur l'image. Les alinéas : bornes de la base =
bornes du livre, sinon « à regarder ».
"""
import collections
import difflib
import json
import pathlib
import re
import sys
import unicodedata

WORK, SNAP = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2])
CCH = pathlib.Path(__file__).resolve().parent / 'data/code-civil/cch-source.json'

# ── Livre : articles et alinéas ───────────────────────────────────────────────────────────────
L = json.loads((WORK / 'livre.json').read_text(encoding='utf-8'))
HEADNUM = re.compile(r'^[\W_]{0,3}A\s*r\s*[tlrfi1]\W{0,3}\s*(1\s*er|[lI1]er|\d[\dSOolI]{0,3})\b', re.I)
ENUM = re.compile(r'^(?:\d{1,2}|[IVX]{1,4})\s*[.°)\-]\s|^\d{1,2}o\s|^[a-h]\)\s|^[-–—]\s')
FIN = re.compile(r'[.:;!?»)]\s*$|\d\.?\s*$|\bs\.?\s*$')


def num_tete(l):
    for src in (l['tesseract'], l['acrobat']):
        m = HEADNUM.match(src or '')
        if m:
            s = re.sub(r'\s', '', m.group(1))
            if re.fullmatch(r'[lI1]er', s):
                return 1
            s = s.translate(str.maketrans('SOolI', '50011'))
            if s.isdigit():
                return int(s)
    return None


# Une tête est « Art. N » au fer, A CAPITAL suivi d'un numéro : la règle de la phase 1, insensible à la casse,
# prenait aussi les lignes de loi qui commencent par « article 156 n'a pas… » (décalage de toute une série).
VRAIE_TETE = re.compile(r'^[\W_]{0,2}A\s*r\s*[tlrfi1]\s*[.,·:;]?\s*(?:1\s*er|[lI1]er|\d[\dSOolI]{0,3})\b')
for l in L:
    l['tete'] = bool(l['tete'] and (VRAIE_TETE.match(l['tesseract'] or '') or VRAIE_TETE.match(l['acrobat'] or '')))
tetes = [i for i, l in enumerate(L) if l['tete']]
nums = [num_tete(L[i]) for i in tetes]
# Plus longue sous-suite croissante (numéros sûrs), puis interpolation des numéros illisibles.
best = [1] * len(nums)
prev = [-1] * len(nums)
for i in range(len(nums)):
    if nums[i] is None:
        continue
    for j in range(max(0, i - 60), i):
        if nums[j] is not None and nums[j] < nums[i] and nums[i] - nums[j] <= (i - j) + 25 and best[j] + 1 > best[i]:
            best[i], prev[i] = best[j] + 1, j
i = max(range(len(nums)), key=lambda k: best[k])
sure = set()
while i != -1:
    sure.add(i)
    i = prev[i]
attribue = [nums[k] if k in sure else None for k in range(len(nums))]
for k in range(len(attribue)):
    if attribue[k] is None:
        a = next((attribue[j] for j in range(k - 1, -1, -1) if attribue[j] is not None), 0)
        da = next((k - j for j in range(k - 1, -1, -1) if attribue[j] is not None), k + 1)
        attribue[k] = a + da  # suite immédiate de la dernière tête sûre
livre = {}
doublons = []
for k, i in enumerate(tetes):
    fin = tetes[k + 1] if k + 1 < len(tetes) else len(L)
    n = str(attribue[k])
    entree = {'lignes': L[i:fin], 'page': L[i]['page'], 'folio': L[i]['folio'], 'lu': nums[k], 'sur': k in sure}
    if n in livre:
        doublons.append(n)
        # Deux têtes pour un numéro : celle dont le numéro a été LU l'emporte sur l'interpolée (les « Art. 1,
        # Art. 2… » d'un texte connexe composé au corps de la loi, sans cadre — loyers, index 318-321).
        if livre[n]['sur'] or not entree['sur']:
            continue
    livre[n] = entree


# Tête ILLISIBLE (« 4rt. 683 », « î \\ rt . , 1013 », têtes d'articles abrogés en petit corps) : l'article
# précédent avale le suivant. On le recoupe à la ligne au fer qui commence par le numéro attendu.
recoupes = []
for n in range(1, 2047):
    a, suiv = livre.get(str(n)), str(n + 1)
    if not a or (suiv in livre and livre[suiv].get('sur')):
        continue
    for k, l in enumerate(a['lignes'][1:], 1):
        debut = (l['tesseract'] or '')[:16] + ' ' + (l['acrobat'] or '')[:16]
        if (l['retrait'] < 8 and re.search(r'(?<![\d,])' + suiv + r'(?!\d)', debut)
                and not re.match(r'^\W*(C\.|c\.|Civ)', l['tesseract'] or '')):
            livre[suiv] = {'lignes': a['lignes'][k:], 'page': l['page'], 'folio': l['folio'], 'lu': n + 1,
                           'sur': False, 'recoupe': True}
            a['lignes'] = a['lignes'][:k]
            recoupes.append(suiv)
            break


def alineas(lignes, avec_lignes=False):
    """Bornes d'alinéa du livre : interligne, ligne courte qui finit une phrase, énumération."""
    out = []
    objets = []
    for i, l in enumerate(lignes):
        t = (l['tesseract'] or l['acrobat']).strip()
        if i == 0:
            out.append([t])
            objets.append([l])
            continue
        p = lignes[i - 1]
        pt = (p['tesseract'] or p['acrobat']).strip()
        courte = p['x1'] < p['droite'] - 14
        meme_page = p['page'] == l['page']
        ecart = l['y1'] - p['y1'] if meme_page else None
        if ENUM.match(t) and l['retrait'] > 5:
            nouv = True
        elif meme_page and ecart is not None and ecart > 13.6 and not (ecart > 20 and not courte and not FIN.search(pt)):
            nouv = True
        elif courte and FIN.search(pt):
            nouv = True
        elif not meme_page:
            nouv = bool(FIN.search(pt)) and courte
        else:
            nouv = False
        if nouv:
            out.append([t])
            objets.append([l])
        else:
            out[-1].append(t)
            objets[-1].append(l)
    return (out, objets) if avec_lignes else out


# ── Base : découpée comme le lecteur ─────────────────────────────────────────────────────────
corps = (SNAP / 'body.txt').read_text(encoding='utf-8').split('\n')
ann = json.loads((SNAP / 'ann.json').read_text(encoding='utf-8'))
versions = json.loads((SNAP / 'versions.json').read_text(encoding='utf-8'))
table = [re.sub(r'\s+', ' ', t['label']).strip() for t in ann['toc']]
ART = re.compile(r'^Art\.\s*(1er|\d{1,4}(?:-\d{1,2})?)\b')
base = {}
cur, ptr = None, 0
for l in corps:
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
statut = ann.get('status', {})
vers = collections.defaultdict(dict)
for v in versions:
    vers[v['anchor']][v['status']] = v
cch = json.loads(CCH.read_text(encoding='utf-8'))['articles']

# ── Normalisation et jetons ──────────────────────────────────────────────────────────────────
def canon(s):
    s = s.replace('’', "'").replace('‘', "'").replace(' ', ' ').replace(' ', ' ').replace(' ', ' ')
    s = re.sub(r'^(Art\.\s*(?:1er|\d{1,4}(?:-\d{1,2})?))\s*\.?\s*[—–]?\s*', r'\1 ', s)
    s = re.sub(r'\s+([;:!?»])', r'\1', s)
    s = re.sub(r'«\s+', '«', s)
    return re.sub(r'\s+', ' ', s).strip()


TOK = re.compile(r"[0-9A-Za-zÀ-ÖØ-öø-ÿŒœ]+|[^\s0-9A-Za-zÀ-ÖØ-öø-ÿŒœ]")


def jetons(s):
    return TOK.findall(canon(s))


def recoudre(lignes_al, vocab):
    """Recolle les lignes d'un alinéa du livre ; une césure se recoud si le mot recousu est connu."""
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
    s = ''.join(seq)
    s = sans_accent(s).lower()
    s = s.translate(str.maketrans({'1': 'l', 'i': 'l', '|': 'l', '!': 'l', '0': 'o', ',': '.', ';': '.', ':': '.',
                                   '—': '-', '–': '-', '"': "'", '`': "'"}))
    s = s.replace('œ', 'oe').replace('rn', 'm').replace('ii', 'u').replace('cl', 'd')
    return re.sub(r"[.\-']+", '.', s)


PONCT = re.compile(r"^[^0-9A-Za-zÀ-ÖØ-öø-ÿŒœ]*$")


def proches(a_seg, t_seg):
    a, t = cle_ocr(a_seg), cle_ocr(t_seg)
    return a == t or (len(a) >= 3 and difflib.SequenceMatcher(None, a, t).ratio() >= 0.75)


def ecarts(a, b):
    sm = difflib.SequenceMatcher(None, a, b, autojunk=False)
    return [op for op in sm.get_opcodes() if op[0] != 'equal'], sm


res = {}
cpt = collections.Counter()
for n in [str(i) for i in range(1, 2048)]:
    anc = 'art-' + n
    st = statut.get(anc)
    vs = vers.get(anc, {})
    # Le texte que le livre gouverne (§ 1) : le corps, sauf pour les articles réécrits depuis 2011.
    if 'MODIFIE' in vs:
        ref_base, source_base = vs['MODIFIE']['body'], 'ArticleVersion MODIFIE'
    elif 'ABROGE' in vs:
        ref_base, source_base = vs['ABROGE']['body'], 'ArticleVersion ABROGE'
    elif n in ('1101', '1102', '1111', '1112'):
        ref_base, source_base = ann.get('oldVersions', {}).get(anc, ''), 'oldVersions'
    else:
        ref_base, source_base = '\n'.join(base.get(n, [])), 'corps'
    A_lignes = [x for x in ref_base.split('\n') if x.strip()]
    b = livre.get(n)
    r = {'article': n, 'statut': st, 'source_base': source_base, 'page': b['page'] if b else None,
         'folio': b['folio'] if b else None, 'lu': b['lu'] if b else None}
    if not b or not A_lignes:
        r['verdict'] = 'à regarder' if not b else 'sans texte en base'
        r['motif'] = 'tête introuvable au livre' if not b else 'aucun texte de référence en base'
        res[n] = r
        cpt[r['verdict']] += 1
        continue
    vocab = set(w.lower() for w in TOK.findall(canon(ref_base)))
    vocab |= set(w.lower() for w in re.findall(r"[A-Za-zÀ-ÿœ]+(?:-[A-Za-zÀ-ÿœ]+)+", canon(ref_base)))
    _al, _obj = alineas(b['lignes'], True)
    als = [recoudre(al, vocab) for al in _al]
    RENV = re.compile(r'^\W*(C\.|c\.|e\.|Civ|civ|Const)')
    def ital_al(obj):
        lois = [l for l in obj if not RENV.match(l['tesseract'] or l['acrobat'] or '')]
        if not lois:
            return 'non'
        it = [l.get('ital_loi', l['ital']) for l in lois]
        if all(x > 0.85 for x in it):
            return 'entier'
        return 'mots' if any(0.08 < x <= 0.85 for x in it) else 'non'
    italique_als = [ital_al(o) for o in _obj]
    mots_italique = [w for o in _obj for l in o if not RENV.match(l['tesseract'] or l['acrobat'] or '') for w in l.get('mots_ital', [])]
    A = jetons(' '.join(A_lignes))
    T = jetons(' '.join(als))
    C = jetons(' '.join(cch[n]['paras'])) if n in cch else None
    opsAC = None
    if C is not None:
        opsAC, _ = ecarts(A, C)
    diffAC = set()
    for tag, i1, i2, j1, j2 in (opsAC or []):
        diffAC.update(range(i1, max(i2, i1 + 1)))
    opsAT, smAT = ecarts(A, T)
    bruit, regard = [], []
    for tag, i1, i2, j1, j2 in opsAT:
        a_seg, t_seg = A[i1:i2], T[j1:j2]
        soutien = C is not None and not (set(range(i1, max(i2, i1 + 1))) & diffAC)
        # Bruit d'OCR — SEULEMENT si CCH porte ce que porte la base : ponctuation seule (Tesseract perd le point
        # de « C. civ., » en petit italique, le « ° » de « 1° »), ou mot voisin (« béritiers », « manoeuvres »).
        if soutien and ((PONCT.match(''.join(a_seg)) and PONCT.match(''.join(t_seg))) or proches(a_seg, t_seg)):
            bruit.append((tag, ' '.join(a_seg), ' '.join(t_seg), ' '.join(A[max(0, i1 - 5):i1]) + ' ⟦' + ' '.join(a_seg) + '⟧ ' + ' '.join(A[i2:i2 + 5])))
        else:
            ctx = ' '.join(A[max(0, i1 - 6):i1]) + ' ⟦' + ' '.join(a_seg) + '⟧ ' + ' '.join(A[i2:i2 + 6])
            regard.append({'base': ' '.join(a_seg), 'livre': ' '.join(t_seg), 'contexte': ctx,
                           'cch_comme_base': soutien})
    # Alinéas : bornes en indices de jetons de la base
    bornes_A, k = set(), 0
    for ln in A_lignes:
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
    r.update({'alineas_base': len(A_lignes), 'alineas_livre': len(als), 'bornes_diff': al_ecart,
              'ecarts': regard, 'bruit': len(bruit), 'jetons': len(A),
              # séparateur INTERNE du renvoi lu « ; » au livre et « . » en base : CCH reproduit l'erreur (art. 1054)
              'separateurs_suspects': [x[3] for x in bruit if '.' in x[1] and ';' in x[2]],
              'similitude': round(smAT.ratio(), 4), 'livre_texte': als,
              'italique': sum(1 for l in b['lignes'] if l['ital'] > 0.9 and not re.match(r'^\W*(C\.|c\.|e\.|Civ)', l['tesseract'] or '')),
              'lignes_livre': len(b['lignes']), 'italique_alineas': italique_als, 'mots_italique': mots_italique[:20],
              'zone': [(l['page'], round(l['y0'], 1), round(l['y1'], 1)) for l in (b['lignes'][0], b['lignes'][-1])]})
    r['verdict'] = 'conforme' if not regard and not al_ecart else 'à regarder'
    cpt[r['verdict']] += 1
    res[n] = r

(WORK / 'triangulation.json').write_text(json.dumps(res, ensure_ascii=False, indent=0), encoding='utf-8')
print('têtes lues', len(tetes), '— numéros sûrs', len(sure), '— doublons de numéro', doublons[:20], '— recoupés', recoupes)
print(dict(cpt))
mots = sum(1 for r in res.values() if r.get('ecarts'))
alin = sum(1 for r in res.values() if r.get('bornes_diff'))
print(f'articles à écarts de mots : {mots} ; à écarts d’alinéas : {alin}')
print('similitude < 0,9 :', sorted((r['article'] for r in res.values() if r.get('similitude', 1) < 0.9), key=int)[:60])
