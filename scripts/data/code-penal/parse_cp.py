#!/usr/bin/env python3
"""Parser Code pénal d'Haïti → bodyOriginal + structure.json (schéma AnnotatedText).

Source : Code_penal.docx (texte consolidé) + Table des matières.docx (hiérarchie propre).

bodyOriginal = le Code officiel SEUL : en-têtes de structure (LOI/TITRE/CHAPITRE/SECTION/§)
que le parseur ÉMET lui-même (mêmes chaînes que les libellés TOC, dans l'ordre → segmentAnnotated
apparie sans heuristique) + les 413 articles (têtes « Art. N.- » + corps + énumérations).

Hiérarchie (kind → niveau d'affichage AnnotatedText / rang de nidification navToc) :
  loi      → level 1 / rang 0   (LOI Nº 1..5)
  titre    → level 1 / rang 1   (Titre I..II, sous LOI 4)
  chapitre → level 3 / rang 2
  section  → level 4 / rang 3
  para     → level 5 / rang 4   (§ / sous-titres « Première classe », « Dispositions communes »…)

Nettoyage : les en-têtes gâtés du corps (espaces perdus « DESCONCUSSIONS… », lignes fusionnées
« CHAPITRE … SECTION … ») sont réparés en appariant leur DESCRIPTION (clé alphanumérique repliée)
à la Table des matières, source propre des libellés.

Ancres : anchorFromDesignation (réplique de src/lib/doc/anchors.ts) → art-N, art-19-bis, art-227-1.
Doit rester COHÉRENT avec src/lib/doc/anchors.ts (rendu + index + renvois).
"""
import zipfile, re, json, os, unicodedata
from collections import Counter

OUT = os.path.dirname(os.path.abspath(__file__))
PARSED = os.path.join(OUT, 'parsed')
BASE = '/Users/cvaval/Library/CloudStorage/OneDrive-Personal/National Center for Missing and Exploited Children'
DOCX = os.path.join(BASE, 'Code_penal.docx')
TMX = os.path.join(BASE, 'Table des matières.docx')

ENT = [('&amp;', '&'), ('&lt;', '<'), ('&gt;', '>'), ('&#x2019;', '’'), ('&#x2018;', '‘'),
       ('&#x2013;', '–'), ('&#x2014;', '—'), ('&#xa0;', ' '), ('&quot;', '"'), ('&apos;', "'")]


def clean(t):
    for a, b in ENT:
        t = t.replace(a, b)
    return re.sub(r'\s+', ' ', t).strip()


def paras(path):
    z = zipfile.ZipFile(path)
    xml = z.read('word/document.xml').decode('utf-8', 'replace')
    out = []
    for p in re.findall(r'<w:p\b[^>]*>.*?</w:p>', xml, re.S):
        body = re.sub(r'<w:pPr>.*?</w:pPr>', '', p, flags=re.S)  # retire les propriétés de paragraphe
        # Tabulations (mots séparés par <w:tab/> hors <w:t>) → espace CAPTURABLE. Sinon les mots se
        # collent (« DESCONCUSSIONS… ») ou, pire, le motif <w:t…> attrape <w:tab/> et aspire du XML.
        body = re.sub(r'<w:tab\b[^>]*>', '<w:t> </w:t>', body)
        # <w:t…> STRICT (t suivi d'espace ou de « > ») : n'attrape jamais <w:tab/>, <w:tbl>, etc.
        txt = clean(''.join(re.findall(r'<w:t(?:\s[^>]*)?>(.*?)</w:t>', body, re.S)))
        if not txt:
            continue
        st = (re.search(r'<w:pStyle w:val="([^"]+)"', p) or [None, ''])[1]
        out.append({'t': txt, 's': st,
                    'b': '<w:b/>' in p or '<w:b ' in p,
                    'i': '<w:i/>' in p or '<w:i ' in p})
    return out


def alnum(s):
    """Clé de comparaison : minuscules, accents repliés, non-alphanumériques retirés."""
    s = unicodedata.normalize('NFD', s.lower())
    s = ''.join(c for c in s if unicodedata.category(c) != 'Mn')
    return re.sub(r'[^a-z0-9]', '', s)


# ───────────────────────── Ancres (réplique anchors.ts) ─────────────────────────
def anchor_from_desig(desig):
    s = str(desig).lower().strip()
    s = re.sub(r'^premier\b', '1', s)
    s = re.sub(r'(\d)\s*(?:er|ère)(?=[\s.\-]|$)', r'\1', s)
    s = re.sub(r'(\d)\s*(bis|ter|quater)', r'\1-\2', s)
    s = re.sub(r'[.\s]+', '-', s)
    s = re.sub(r'-+', '-', s)
    s = s.strip('-')
    return 'art-' + s


ART = re.compile(r'^Art(?:icle)?\.?\s+(\d{1,4}(?:\s*(?:er|ère))?(?:\s*(?:bis|ter))?(?:-\d+)?)', re.I)
# LOI de STRUCTURE = « LOI Nº 1 » (majuscule + désignation numérotée) ; « Loi du 3 juillet 1935 »
# (statut intégré) N'EST PAS un en-tête → reste dans le corps.
LOI_HDR = re.compile(r'^LOI\s+N[ºo°.]*\s*\d', re.I)
STRUCT = re.compile(r'^\s*(TITRE|CHAPITRE|SECTION)\b', re.I)
KLASSE = re.compile(r'^(Premi[èe]re|Deuxi[èe]me|Troisi[èe]me|Quatri[èe]me|Cinqui[èe]me|Sixi[èe]me|Septi[èe]me)\s+classe\b', re.I)
DISPO = re.compile(r'^Dispositions?\s+(communes?|g[ée]n[ée]rales?|particuli[èe]res?)', re.I)
PARA = re.compile(r'^§\s*\d')
# Marqueur de sous-en-tête fusionné dans une même ligne (nécessite un numéro/roman derrière).
SPLIT = re.compile(r'(?=(?:CHAPITRE|SECTION|TITRE)\s+(?:[IVXLC]+\b|\d+|PREMIER\b|Ier\b|premier\b))')

KIND_LEVEL = {'loi': 1, 'titre': 1, 'chapitre': 3, 'section': 4, 'para': 5}
KIND_RANK = {'loi': 0, 'titre': 1, 'chapitre': 2, 'section': 3, 'para': 4}


def header_kind(t):
    if LOI_HDR.match(t):
        return 'loi'
    m = STRUCT.match(t)
    if m:
        return m.group(1).lower()
    if PARA.match(t) or KLASSE.match(t) or DISPO.match(t):
        return 'para'
    return None


def split_enum_desc(t, kind):
    """Sépare « CHAPITRE Ier DES PEINES » → ('Chapitre Ier', 'Des peines'). Renvoie (enum, desc)."""
    if kind == 'loi':
        m = re.match(r'^LOI\s+N[ºo°.]*\s*(\d+)\s*(.*)$', t, re.I)
        if m:
            return f'LOI Nº {m.group(1)}', m.group(2).strip(' .-–')
    if kind == 'titre':
        m = re.match(r'^Titre\s+([IVXLC]+|premier|\d+)\.?\-?\s*(.*)$', t, re.I)
        if m:
            return f'Titre {m.group(1)}', m.group(2).strip(' .-–')
    if kind == 'chapitre':
        m = re.match(r'^Chapitre\s+([IVXLC]+(?:er)?|PREMIER|premier|\d+)\.?\-?\s*(.*)$', t, re.I)
        if m:
            return f'Chapitre {m.group(1)}', m.group(2).strip(' .-–')
    if kind == 'section':
        m = re.match(r'^Section\s+([IVXLC]+(?:\s*\(?bis\)?)?|\d+(?:\s*\(?bis\)?)?)\.?\-?\s*(.*)$', t, re.I)
        if m:
            return f'Section {m.group(1)}', m.group(2).strip(' .-–:')
    return t, ''


# ───────────────────────── Table des matières (source propre) ─────────────────────────
def load_tm():
    """desc-alnum-key → libellé propre (pour réparer les en-têtes gâtés du corps)."""
    tm = paras(TMX)
    ref = {}
    for x in tm[1:]:  # saute « Table des matières »
        line = x['t']
        # éclate les lignes TM qui fusionnent plusieurs entrées
        parts = re.split(r'(?=(?:Loi\s+N|Titre\s+[IVX\d]|Chapitre\s+[IVX\d]|Section\s+\d|§\s*\d))', line)
        for part in parts:
            part = part.strip()
            if not part:
                continue
            k = header_kind(part) or ('para' if re.match(r'^§', part) else None)
            enum, desc = split_enum_desc(part, k) if k in ('titre', 'chapitre', 'section') else (part, part)
            # description après le « .- » pour les §
            mp = re.match(r'^§\s*\d+\.?\-?\s*(.*)$', part)
            if mp:
                desc = mp.group(1)
            key = alnum(desc)
            if len(key) >= 6 and key not in ref:
                ref[key] = desc.strip(' .-–:')
    return ref


TM_REF = load_tm()


def fix_desc(desc):
    """Répare une description gâtée (espaces perdus) via la Table des matières."""
    k = alnum(desc)
    if k in TM_REF:
        return TM_REF[k]
    return desc


# ───────────────────────── Parcours du corps ─────────────────────────
P = paras(DOCX)

toc = []       # {level, label, anchor, kind}
body = []      # lignes du bodyOriginal
labels = {}    # anchor → « Article N »
status = {}    # anchor → modifié|abrogé
seen_art = set()
review = []
sec_n = 0
expected = 1
gaps = []
dupes = []


def emit_header(kind, enum, desc):
    global sec_n
    desc = fix_desc(desc) if desc else ''
    if kind in ('chapitre', 'section', 'titre') and desc:
        label = f'{enum} — {desc}'
    elif kind == 'loi' and desc:
        label = f'{enum} — {desc}'
    elif kind == 'para':
        label = desc or enum
    else:
        label = enum if not desc else f'{enum} {desc}'
    label = clean(label)
    sec_n += 1
    a = f'sec-{sec_n}'
    toc.append({'level': KIND_LEVEL[kind], 'label': label, 'anchor': a, 'kind': kind})
    body.append(label)
    return a


def looks_like_desc(x):
    """Un paragraphe est-il une ligne de description (à fusionner au header précédent) ?"""
    t = x['t']
    if ART.match(t) or header_kind(t):
        return False
    # bold, en majuscules ou titre, raisonnablement court, pas de ponctuation finale de phrase
    if not x['b']:
        return False
    if t.rstrip().endswith(('.', ';', ':')) and not t.isupper():
        return False
    return len(t) < 150


i = 0
N = len(P)
while i < N:
    x = P[i]
    t = x['t']

    # 1) Titre du document
    if x['s'] == 'Title':
        i += 1
        continue

    # 2) Article
    m = ART.match(t)
    if m and (x['s'] in ('BodyText', '') or x['b']):
        desig = m.group(1)
        anchor = anchor_from_desig(desig)
        # numéro principal (sans bis/dash) pour le suivi de séquence
        base = int(re.match(r'^(\d+)', desig).group(1))
        is_suffixed = bool(re.search(r'(bis|ter)', desig, re.I) or '-' in desig)
        if anchor in seen_art:
            dupes.append((anchor, t[:60]))
            # 2ᵉ occurrence : conservée dans le corps (segmentAnnotated retire l'ancre en double)
        else:
            seen_art.add(anchor)
            # libellé d'affichage
            disp = re.sub(r'\s*(bis|ter)', lambda mm: ' ' + mm.group(1).lower(), desig, flags=re.I)
            disp = re.sub(r'\s+', ' ', disp).strip()
            labels[anchor] = f'Article {disp}'
            # statut : décret/loi modificateur dans la tête
            if re.match(r'^Art(?:icle)?\.?\s+\S+.*?\((?:D\.|Décret|D[ée]cret|L\.|Loi)', t, re.I):
                status[anchor] = 'modifié'
            if not is_suffixed:
                if base > expected:
                    gaps.append((expected, base))
                expected = max(expected, base + 1)
        body.append(t)
        i += 1
        continue

    # 3) En-tête de structure
    kind = header_kind(t)
    if kind or x['s'] in ('Heading1', 'Heading2'):
        # lignes fusionnées « CHAPITRE … SECTION … » → éclatées
        segments = [s.strip() for s in SPLIT.split(t) if s.strip()] if kind in ('chapitre', 'section', 'titre') else [t]
        if len(segments) > 1:
            review.append(('header-fusionné', t[:80]))
        for si, seg in enumerate(segments):
            k2 = header_kind(seg) or 'para'
            enum, desc = split_enum_desc(seg, k2)
            # fusion de la ligne de description suivante (seulement pour le DERNIER segment,
            # et si ce header n'a pas déjà sa description en ligne)
            if si == len(segments) - 1 and not desc and k2 in ('loi', 'titre', 'chapitre', 'section'):
                if i + 1 < N and looks_like_desc(P[i + 1]):
                    desc = P[i + 1]['t']
                    i += 1
            if k2 == 'para' and not desc:
                desc = seg
            emit_header(k2, enum, desc)
        i += 1
        continue

    # 4) Corps d'article / énumération / note → texte officiel
    body.append(t)
    # note d'abrogation/modification collective → statut des articles visés
    mn = re.match(r'^\(?Les\s+articles?\s+(\d+)\s*(?:à|,|et)\s*(\d+)?.*(abrog|modifi)', t, re.I)
    if mn:
        lo, hi = int(mn.group(1)), int(mn.group(2) or mn.group(1))
        stt = 'abrogé' if 'abrog' in mn.group(3).lower() else 'modifié'
        for nn in range(lo, hi + 1):
            a = f'art-{nn}'
            if a in seen_art:
                status[a] = stt
    i += 1

bodyOriginal = '\n'.join(body)

# ───────────────────────── navToc (arbre par rang) ─────────────────────────
root = {'label': 'Code pénal d’Haïti', 'anchor': toc[0]['anchor'] if toc else 'sec-1', 'children': []}
stack = [(-1, root)]  # (rang, nœud)
for e in toc:
    rank = KIND_RANK[e['kind']]
    while len(stack) > 1 and stack[-1][0] >= rank:
        stack.pop()
    node = {'label': e['label'], 'anchor': e['anchor']}
    parent = stack[-1][1]
    parent.setdefault('children', []).append(node)
    stack.append((rank, node))
navToc = [root]

structure = {
    'title': 'Code pénal d’Haïti', 'annotationAuthor': '',
    'navToc': navToc, 'toc': toc, 'connexes': [], 'jurisprudence': {},
    'commentaires': {}, 'connexe': {}, 'indexEntries': [],
    'oldVersions': {}, 'status': {k: v for k, v in status.items() if v}, 'labels': labels, 'crossRefs': [],
}

os.makedirs(PARSED, exist_ok=True)
open(os.path.join(PARSED, 'bodyOriginal.txt'), 'w').write(bodyOriginal)
json.dump(structure, open(os.path.join(PARSED, 'structure.json'), 'w'), ensure_ascii=False, indent=1)
json.dump(review, open(os.path.join(PARSED, 'review.json'), 'w'), ensure_ascii=False, indent=1)

# ───────────────────────── Diagnostics ─────────────────────────
print('bodyOriginal :', len(bodyOriginal) // 1024, 'Ko ·', len(body), 'lignes')
print('toc          :', len(toc), '—', dict(Counter(e['kind'] for e in toc)))
print('articles     :', len(labels), '(ancres uniques)')
present = set()
for a in labels:
    mm = re.match(r'^art-(\d+)', a)
    if mm:
        present.add(int(mm.group(1)))
missing = [n for n in range(1, 414) if n not in present]
print('num manquants (1-413):', missing)
print('sauts séquence:', gaps)
print('doublons     :', dupes)
print('statuts      :', dict(Counter(status.values())))
print('bis/dash     :', sorted([a for a in labels if re.search(r'-(bis|ter)$|-\d+$', a)]))
print('review       :', dict(Counter(k for k, _ in review)))
