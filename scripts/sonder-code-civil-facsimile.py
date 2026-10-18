#!/usr/bin/env python3
"""SONDE du Code civil contre son fac-similé (édition Zémès 2011, « Code Civil.pdf », 481 p.).
LECTURE SEULE — ne touche ni à la base ni au PDF. Elle prépare l'audit mot à mot
(docs/prompt-audit-code-civil-mot-a-mot.md) ; elle n'en tient pas lieu.

Ce qu'elle mesure, à partir de la GÉOMÉTRIE de la couche texte (jamais de ses mots, océrisés en
2016 par Acrobat Paper Capture : « Art. ter », « c. ctv. », « !'Haïtien », « Ha1'tienne ») :
  1. les alinéas du livre, article par article, comparés aux lignes de la base ;
  2. les lignes de LOI composées en italique (convention de l'édition) ;
  3. les gloses de l'éditeur en petit italique sous un article, et si la base les a versées au corps ;
  4. la confrontation de la base à CCH.docx (fichier de composition), en mots et en alinéas ;
  5. le tableau « composition × mention » : chaque article du livre, romain ou italique (entier, partiel), croisé
     avec la mention de l'éditeur qui le suit (« Abrogé par… », « V. … », autre glose, aucune). C'est la preuve
     que l'ITALIQUE signale l'ABROGATION (confirmé le 18 oct. 2026 : « Abrogé par… » ne suit jamais un article
     en romain).

Anatomie mesurée de la page (pt, repère PDF 398 × 626) :
  loi       Times-Roman 9,5-10,8 · interligne 12,0 · NOUVEL ALINÉA ≈ 14,6-15,0, sans retrait
  tête      « Art. N » en gras, au fer à gauche
  énum.     retrait ≈ 10 (1re ligne), retrait suspendu ≈ 20 (suite)
  renvoi    italique ≈ 10,5 en fin d'alinéa (« - C. civ., 49, 133 et s, 180. »)
  appareil  Helvetica 7,1-7,3, DEUX colonnes (x ≈ 46 et 212) sous un filet court
  encadré   ≈ 8,2, cadre, retrait ≈ 12
  folio     bas de page ; index PDF = folio + 1

Usage :
  python3 scripts/sonder-code-civil-facsimile.py "<Code Civil.pdf>" <body.txt> <annotations.json> \\
          scripts/data/code-civil/cch-source.json <dossier de sortie>
  (body.txt = bodyOriginal de CODE_CIVIL_ANNOTE ; annotations.json = son annotationsJson)

⚠️ C'est un DÉTECTEUR, calibré sur échantillon (17-18 oct. 2026) : sur les écarts d'alinéas qu'il
signale, une part notable est du bruit (intertitre lu comme loi, énumération en petit corps, ligne de
renvoi décalée). Tout écart se tranche sur l'IMAGE de la page, jamais sur ce script.
"""
import collections
import json
import pathlib
import re
import sys

import fitz  # PyMuPDF

PDF, BODY, ANN, CCH, OUT = sys.argv[1:6]
OUT = pathlib.Path(OUT)
OUT.mkdir(parents=True, exist_ok=True)
PAGES = range(22, 412)  # index 0 : p. 23 (LOI No 1) → p. 412 (fin de la LOI No 35)

HEAD = re.compile(r'^[\W_]{0,3}A\s*r\s*[tlrfi1]\W{0,3}\s*(\S{1,12})', re.I)
ENUM = re.compile(r'^(?:\d{1,2}|[IVX]{1,4})\s*[.°)\-]\s|^\d{1,2}o\s|^[a-h]\)\s|^[-–]\s')
ITAL = ('Italic', 'Oblique')


def numero(t):
    """Numéro d'une tête océrisée : « Art. ter » = 1er, « Art. 7S » = 75, « Art. 19S » = 195."""
    m = HEAD.match(t)
    s = m.group(1) if m else ''
    s = re.sub(r'^(?:ter|ler|1er|Ier)$', '1', s)
    s = s.translate(str.maketrans({'I': '1', 'l': '1', 'O': '0', 'o': '0', 'S': '5', 's': '5', 'B': '8',
                                   'Z': '2', 'i': '1', '!': '1', 'J': '1', 't': '1'}))
    m = re.match(r'(\d{1,4})', s)
    return int(m.group(1)) if m else None


# ── 1. Lignes de loi du livre, avec leur rupture d'alinéa ─────────────────────────────────────
doc = fitz.open(PDF)
lignes = []        # (page, tête?, texte, nouvel alinéa ?)
italiques = collections.defaultdict(lambda: [0, 0])   # article → [lignes de loi en italique, lignes de loi]
gloses = []
for pi in PAGES:
    page = doc[pi]
    brutes = []
    for b in page.get_text('dict')['blocks']:
        for l in b.get('lines', []):
            sp = [s for s in l['spans'] if s['text'].strip()]
            if not sp:
                continue
            tot = sum(len(s['text']) for s in sp)
            brutes.append({
                'y': l['bbox'][3], 'top': l['bbox'][1], 'x0': l['bbox'][0], 'x1': l['bbox'][2],
                'sz': sum(s['size'] * len(s['text']) for s in sp) / tot,
                'ital': sum(len(s['text']) for s in sp if any(k in s['font'] for k in ITAL)) / tot,
                'times': any('Times' in s['font'] for s in sp),
                't': ''.join(s['text'] for s in l['spans']).strip(),
            })
    brutes.sort(key=lambda r: r['y'])
    fusion = []  # un renvoi en italique est souvent une « ligne » distincte sur la même ligne de base
    for r in brutes:
        f = fusion[-1] if fusion else None
        if f and abs(r['y'] - f['y']) < 3.5 and r['sz'] > 8.5 and f['sz'] > 8.5 and r['x0'] > f['x1'] - 5:
            f['x1'] = max(f['x1'], r['x1'])
            f['t'] += ' ' + r['t']
            continue
        fusion.append(dict(r))
    xs = collections.Counter(round(r['x0']) for r in fusion if 9.2 <= r['sz'] <= 11.2 and len(r['t']) > 40)
    cand = [k for k, v in xs.items() if v >= max(1, xs.most_common(1)[0][1] // 3)] if xs else []
    marge = (min(cand) if cand else 46) - 1.5   # les pages paires et impaires n'ont pas la même marge
    prec = None
    art_courant = None
    for r in fusion:
        t = r['t']
        if r['y'] > 575 and re.fullmatch(r'\d{1,3}', t):
            continue  # folio
        if r['top'] < 40 and r['sz'] < 7:
            continue  # titre courant
        tete = bool(HEAD.match(t)) and r['x0'] < marge + 6
        loi = (9.2 <= r['sz'] <= 11.2 or (tete and re.search('Abrog', t))) and r['x0'] < marge + 30
        centre = (r['x0'] > marge + 25 and not ENUM.match(t)) or (t.isupper() and len(t) > 6 and not tete)
        if tete:
            art_courant = (pi + 1, numero(t))
        # gloses : phrase en petit italique Times, au fer à gauche, qui n'est ni un renvoi ni une note
        if (6.8 <= r['sz'] < 9.2 and r['times'] and r['ital'] > 0.9 and r['x0'] < marge + 14
                and re.match(r"^[A-ZÀ-ÉL][a-zà-ÿ'’]", t)
                and not re.match(r'^(V\.?\s|Cass|Civ|Le Moniteur|Moniteur|Bull|Aff|Gaz|S\. ?R)', t)
                and not re.search(r'\d{4}\.?\s*$|vs\.?|Bull\.|Aff\.?', t) and len(t) > 25):
            gloses.append({'page': pi + 1, 'article': art_courant[1] if art_courant else None, 'texte': t})
        if not loi or centre:
            prec = ('autre', r['y'])
            continue
        if art_courant:
            italiques[art_courant][1] += 1
            if r['ital'] > 0.9 and not re.match(r'^\W*(C\.|c\.|e\.|Civ)', t):
                italiques[art_courant][0] += 1
        enum = bool(ENUM.match(t)) and r['x0'] > marge + 5
        if tete:
            nouv = 'tete'
        elif prec is None:
            nouv = 'page'
        elif prec[0] == 'autre':
            nouv = 'apres-autre'
        elif enum:
            nouv = 'oui'
        else:
            nouv = 'oui' if r['y'] - prec[1] > 13.6 else 'non'
        lignes.append((pi + 1, tete, t, nouv))
        prec = ('loi', r['y'])

# ── Regroupement en articles et en alinéas ─────────────────────────────────────────────────────
arts = []
cur = None
for page, tete, t, nouv in lignes:
    if tete:
        cur = {'n': numero(t), 'page': page, 'alineas': [[t]]}
        arts.append(cur)
        continue
    if cur is None:
        continue
    der = cur['alineas'][-1][-1]
    if nouv == 'oui':
        cur['alineas'].append([t])
    elif nouv == 'non':
        cur['alineas'][-1].append(t)
    else:  # saut de page, ou reprise après une note : suite si la ligne d'avant ne finit pas une phrase
        suite = (der.endswith('-') and not re.search(r'\.-$', der)) or t[:1].islower() \
            or not re.search(r'[.:;!?»)]\s*$', der)
        (cur['alineas'][-1].append(t) if suite else cur['alineas'].append([t]))
for i, a in enumerate(arts):  # numéro illisible : la séquence croissante le donne
    pv = arts[i - 1]['n'] if i else 0
    nx = arts[i + 1]['n'] if i + 1 < len(arts) else None
    if a['n'] is None or (pv is not None and nx is not None and nx - pv == 2 and a['n'] != pv + 1):
        a['n'] = (pv or 0) + 1
livre = {}
for a in arts:
    livre.setdefault(str(a['n']), a)

# ── 2. La base, découpée COMME LE LECTEUR (`segmentAnnotated`) ────────────────────────────────
# Une ligne est un intitulé si et seulement si elle est ÉGALE (espaces normalisées) au libellé de
# table ATTENDU — la table se parcourt dans l'ordre. Une ligne en capitales qui n'est pas ce libellé
# (titre courant absorbé, doublon d'intitulé) reste du texte : c'est ce que le lecteur affiche.
corps = pathlib.Path(BODY).read_text(encoding='utf-8').split('\n')
ann = json.loads(pathlib.Path(ANN).read_text(encoding='utf-8'))
table = [re.sub(r'\s+', ' ', t['label']).strip() for t in ann['toc']]
ART = re.compile(r'^Art\.\s*(1er|\d{1,4}(?:-\d{1,2})?)\b')
base = {}
hors_article = []   # lignes que le lecteur affiche hors de tout article (sous un intitulé)
cur = None
ptr = 0
for no, l in enumerate(corps, 1):
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
        base[cur] = [s]
        continue
    if cur:
        base[cur].append(s)
    else:
        hors_article.append({'ligne': no, 'texte': s})
statut = ann.get('status', {})

# ── 3. Alinéas : base contre livre (articles sans statut — les autres suivent l'acte modificatif) ──
cmp = collections.Counter()
ecarts = []
for n, ls in base.items():
    if '-' in n or statut.get('art-' + n):
        continue
    a = livre.get(n)
    if not a:
        cmp['tête introuvable au relevé'] += 1
        ecarts.append({'article': n, 'type': 'tête introuvable', 'base': len(ls), 'livre': None, 'page': None})
        continue
    k = 'égal' if len(ls) == len(a['alineas']) else ('base a plus d’alinéas' if len(ls) > len(a['alineas'])
                                                     else 'base a moins d’alinéas')
    cmp[k] += 1
    if k != 'égal':
        ecarts.append({'article': n, 'type': k, 'base': len(ls), 'livre': len(a['alineas']), 'page': a['page']})

# ── 4. Base contre CCH.docx (mots et alinéas) ─────────────────────────────────────────────────
cch = json.loads(pathlib.Path(CCH).read_text(encoding='utf-8'))['articles']
norm = lambda x: re.sub(r'\s+', ' ', x.replace('’', "'").replace(' ', ' ').replace(' ', ' ')).strip()
ccmp = collections.Counter()
cch_mots = []
for n, ls in base.items():
    if '-' in n or statut.get('art-' + n) or n not in cch:
        continue
    cp = [norm(p) for p in cch[n]['paras']]
    dp = [norm(x) for x in ls]
    if cp == dp:
        ccmp['identique'] += 1
    elif cp[:len(dp)] == dp:
        ccmp['CCH a des paragraphes en plus (encadrés, renvois « V. »)'] += 1
    elif dp[:len(cp)] == cp:
        ccmp['base a des lignes en plus (énumérations rendues au dispositif)'] += 1
    else:
        ccmp['mots différents'] += 1
        cch_mots.append(n)

ital = [{'article': k[1], 'page': k[0], 'italique': v[0], 'lignes': v[1]} for k, v in italiques.items() if v[0]]
txt = '\n'.join(corps)
cle = lambda s: re.sub(r'[^a-zà-ÿœ]', '', s.lower())
for g in gloses:
    g['dans_le_corps'] = cle(g['texte'])[:30] in cle(txt) if len(cle(g['texte'])) >= 15 else None

(OUT / 'cch-mots-differents.json').write_text(json.dumps(cch_mots, ensure_ascii=False), encoding='utf-8')
(OUT / 'hors-article.json').write_text(json.dumps(hors_article, ensure_ascii=False, indent=1), encoding='utf-8')
(OUT / 'alineas-ecarts.json').write_text(json.dumps(ecarts, ensure_ascii=False, indent=1), encoding='utf-8')
(OUT / 'italiques.json').write_text(json.dumps(ital, ensure_ascii=False, indent=1), encoding='utf-8')
(OUT / 'gloses.json').write_text(json.dumps(gloses, ensure_ascii=False, indent=1), encoding='utf-8')
print(f'têtes d’article relevées au livre : {len(arts)}')
print(f'lignes de la base hors de tout article : {len(hors_article)} (dont les deux lignes de titre du document)')
print(f'articles où la base et CCH diffèrent en mots : {", ".join(cch_mots)}')
print('alinéas, base contre livre :', dict(cmp))
print('base contre CCH.docx      :', dict(ccmp))
print(f'articles à lignes de loi en italique : {len(ital)} (entièrement : {sum(1 for i in ital if i["italique"] == i["lignes"])})')
print(f'gloses candidates : {len(gloses)} (dont trouvées dans le corps : {sum(1 for g in gloses if g["dans_le_corps"])})')

# ── 5. Composition × mention de l'éditeur ──────────────────────────────────────────────────────
MENTION = re.compile(r'^(V\.?\s|V\s|Abrog|Ainsi|Cet article|Suivant|L.expression|Modifi|Remplac)')
compo = []
art = None
for pi in PAGES:
    rangs = []
    for b in doc[pi].get_text('dict')['blocks']:
        for l in b.get('lines', []):
            sp = [x for x in l['spans'] if x['text'].strip()]
            if sp:
                rangs.append((l['bbox'][3], l['bbox'][0], sp))
    rangs.sort(key=lambda r: r[0])
    for y, x0, sp in rangs:
        t = ''.join(x['text'] for x in sp).strip()
        tot = sum(len(x['text']) for x in sp)
        sz = sum(x['size'] * len(x['text']) for x in sp) / tot
        it = sum(len(x['text']) for x in sp if any(k in x['font'] for k in ITAL)) / tot
        times = any('Times' in x['font'] for x in sp)
        if y > 575 and re.fullmatch(r'\d{1,3}', t):
            continue
        if HEAD.match(t) and x0 < 60 and sz > 8.3:
            art = {'n': numero(t), 'page': pi + 1, 'loi': 0, 'ital': 0, 'mentions': []}
            compo.append(art)
            reste = sp[2:]
            if reste:
                rt = sum(len(x['text']) for x in reste)
                ri = sum(len(x['text']) for x in reste if any(k in x['font'] for k in ITAL))
                rsz = sum(x['size'] * len(x['text']) for x in reste) / max(rt, 1)
                if rsz < 9 and ri / max(rt, 1) > 0.8:
                    art['mentions'].append(''.join(x['text'] for x in reste).strip())  # « Art. 140 Abrogé par… »
                else:
                    art['loi'] += 1
                    art['ital'] += 1 if ri / max(rt, 1) > 0.9 else 0
            continue
        if not art:
            continue
        if 9.2 <= sz <= 11.2 and times:
            if re.match(r'^\W*(C\.|c\.|e\.|Civ|Const)', t):
                continue
            art['loi'] += 1
            art['ital'] += 1 if it > 0.9 else 0
        elif 6.5 <= sz < 9.2 and times and it > 0.9 and MENTION.match(t):
            art['mentions'].append(t)


def classe_mention(ms):
    m = ' '.join(ms)
    if re.search('Abrog', m):
        return 'Abrogé par…'
    if re.search(r'harmonie|Suivant|expression|Remplac|Modifi|Ainsi', m):
        return 'autre glose'
    if re.search(r'^V\.?|V\s', m):
        return 'V. …'
    return 'aucune'


tableau = collections.Counter()
for a in compo:
    c = ('texte remplacé par la mention' if a['loi'] == 0 else 'romain' if a['ital'] == 0
         else 'italique entier' if a['ital'] >= a['loi'] else 'italique partiel')
    a['composition'], a['mention'] = c, classe_mention(a['mentions'])
    tableau[(c, a['mention'])] += 1
(OUT / 'composition-mention.json').write_text(json.dumps(compo, ensure_ascii=False, indent=1), encoding='utf-8')
print('composition × mention :')
for (c, m), v in sorted(tableau.items()):
    print(f'  {c:30} {m:12} {v:5}')
