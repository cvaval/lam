#!/usr/bin/env python3
"""Parser Code de commerce (édition Vandal) → bodyOriginal + structure.json (schéma AnnotatedText).

Source : 00_Code-de-commerce/0_Code-de-commerce.docx (Livres I à IV, annoté).

Particularités de l'édition Vandal (sondées avant écriture) :
  - en-têtes : LIVRE / TITRE / SECTION (dont « SECTION II BIS ») ; la description
    est sur la LIGNE SUIVANTE (« LIVRE PREMIER » puis « Sur le commerce en général ») ;
  - têtes d'articles = « Article N.- … » (644) — « Article premier.- » pour l'art. 1 ;
  - lignes « Art N [mod] » = MARQUEURS ÉDITORIAUX décalés (ils suivent le bloc de
    leur article) : seuls les suffixes « mod » informent le statut, la ligne est
    retirée du corps ;
  - jurisprudence = lignes « N.- Arrêt du …, Gaz du Pal … » sous l'article
    (annotations Vandal) → JurisCase{ref} par ancre, hors du texte officiel.

Ancres : réplique de src/lib/doc/anchors.ts → art-1, art-612-1, art-19-bis.
Doit rester COHÉRENT avec anchors.ts (rendu + index + renvois).
"""
import html, zipfile, re, json, os, unicodedata
from collections import Counter

OUT = os.path.dirname(os.path.abspath(__file__))
PARSED = os.path.join(OUT, 'parsed')
DOCX = '/Users/cvaval/Downloads/Officiel_Code-de-Commerce_Vandal_legislations-separees/00_Code-de-commerce/0_Code-de-commerce.docx'

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
        # Piège <w:tab/> (cf. parse_cp.py) : tabulation → espace capturable.
        body = re.sub(r'<w:tab\b[^>]*>', '<w:t> </w:t>', body)
        txt = clean(''.join(re.findall(r'<w:t(?:\s[^>]*)?>(.*?)</w:t>', body, re.S)))
        if not txt:
            continue
        st = (re.search(r'<w:pStyle w:val="([^"]+)"', p) or [None, ''])[1]
        out.append({'t': txt, 's': st,
                    'b': '<w:b/>' in p or '<w:b ' in p,
                    'i': '<w:i/>' in p or '<w:i ' in p})
    return out


def anchor_from_desig(desig):
    s = str(desig).lower().strip()
    s = re.sub(r'^premier\b', '1', s)
    s = re.sub(r'(\d)\s*(?:er|ère)(?=[\s.\-]|$)', r'\1', s)
    s = re.sub(r'(\d)\s*(bis|ter|quater)', r'\1-\2', s)
    s = re.sub(r'[.\s]+', '-', s)
    s = re.sub(r'-+', '-', s)
    return 'art-' + s.strip('-')


# ── Motifs ──
# Tête d'article, formes Vandal : « Article 2.- », « Article 38 (L. 3 août 1955) .- »,
# « Article 636. (L. 29 juillet 1955).- », « Article 247.· », « Article 252.:· ».
ART_HEAD = re.compile(
    r'^Article\s+(premier|\d{1,4}(?:\s*(?:er|ère))?(?:\s*(?:bis|ter|quater))?(?:-\d+)?)'
    r'[\s.]*(\([^)]{1,60}\))?[\s.:]*[-–—·]\s*(.*)$', re.I)
# Marqueur éditorial Vandal : forme ABRÉGÉE « Art … » (les vraies têtes disent « Article »).
# Variantes : « Art 2 mod », « Art 16 & 17 combinés », « Art 154 abr », « Art 42, 2ème al »,
# « Art. 637 fr. mod. D-L 3 oct. 1935 ». Ligne courte, retirée du corps ; statuts extraits.
ART_MARK = re.compile(r'^Art\.?\s+\d{1,4}(?![\d.]*\s*[-–—·])[^;]{0,60}$')
JURIS = re.compile(r'^(\d{1,2})\s*\.\-\s+(.*)$')
JURIS_KEY = re.compile(r'arr[êe]t|cass|trib|gaz|pal|bull|jugement|sirey|sect|D\.\s?[HP]\.', re.I)
ORD = r'PREMIER|DEUXI[ÈE]ME|SECOND|TROISI[ÈE]ME|QUATRI[ÈE]ME|CINQUI[ÈE]ME|SIXI[ÈE]ME|SEPTI[ÈE]ME|HUITI[ÈE]ME|NEUVI[ÈE]ME|DIXI[ÈE]ME'
LIVRE = re.compile(rf'^LIVRE\s+({ORD}|[IVXLC]+|\d+)\b', re.I)
STRUCT = re.compile(r'^\s*(TITRE|CHAPITRE|SECTION)\b')
PARA_HDR = re.compile(r'^§\s*\d|^Dispositions?\s+(commune|g[ée]n[ée]rale|particuli[èe]re|transitoire)', re.I)

KIND_LEVEL = {'livre': 1, 'titre': 3, 'chapitre': 3, 'section': 4, 'para': 5}
KIND_RANK = {'livre': 0, 'titre': 1, 'chapitre': 2, 'section': 3, 'para': 4}


def header_kind(t):
    if LIVRE.match(t):
        return 'livre'
    m = STRUCT.match(t)
    if m:
        return m.group(1).lower()
    if PARA_HDR.match(t):
        return 'para'
    return None


def split_enum_desc(t, kind):
    if kind == 'livre':
        m = re.match(rf'^LIVRE\s+({ORD}|[IVXLC]+|\d+)\s*[—–-]?\s*(.*)$', t, re.I)
        if m:
            return f'Livre {m.group(1).title() if len(m.group(1)) > 3 else m.group(1)}', m.group(2).strip(' .-–')
    if kind == 'titre':
        m = re.match(rf'^TITRE\s+({ORD}|[IVXLC]+|\d+)\.?\-?\s*(.*)$', t, re.I)
        if m:
            return f'Titre {m.group(1).title() if len(m.group(1)) > 3 else m.group(1)}', m.group(2).strip(' .-–')
    if kind == 'chapitre':
        m = re.match(r'^CHAPITRE\s+(PREMIER|[IVXLC]+(?:er)?|\d+)\.?\-?\s*(.*)$', t, re.I)
        if m:
            return f'Chapitre {m.group(1)}', m.group(2).strip(' .-–')
    if kind == 'section':
        m = re.match(r'^SECTION\s+(PREMI[ÈE]RE|[IVXLC]+(?:\s*BIS)?|\d+(?:\s*BIS)?)\.?\-?\s*(.*)$', t, re.I)
        if m:
            enum = m.group(1).title().replace(' Bis', ' bis')
            return f'Section {enum}', m.group(2).strip(' .-–:')
    return t, ''


def looks_like_desc(x):
    """Ligne de description à fusionner à l'en-tête précédent (« Sur le commerce en général »)."""
    t = x['t']
    if ART_HEAD.match(t) or ART_MARK.match(t) or header_kind(t) or JURIS.match(t):
        return False
    if t.rstrip().endswith(('.', ';', ':')) and not t.isupper():
        return False
    return len(t) < 120


P = paras(DOCX)

toc = []
body = []
labels = {}
status = {}
juris = {}      # ancre → [JurisCase]
seen_art = set()
review = []
sec_n = 0
expected = 1
gaps = []
dupes = []
cur_art = None      # ancre de l'article courant (rattachement de la jurisprudence)
cur_section = None  # ancre de section courante — la CLÉ juris est « sec-K|art-N »
anc_art = 0         # marqueurs « Anc art N » retirés du corps (ancien n° d'article)


def emit_header(kind, enum, desc):
    global sec_n, cur_section
    label = clean(f'{enum} — {desc}') if desc else clean(enum)
    sec_n += 1
    a = f'sec-{sec_n}'
    cur_section = a
    toc.append({'level': KIND_LEVEL[kind], 'label': label, 'anchor': a, 'kind': kind})
    body.append(label)
    return a


# Frontière d'un bloc de considérant : autre arrêt, tête/marqueur d'article,
# en-tête de structure, marqueur « Anc art N », ou ligne vide.
def is_juris_boundary(t):
    return bool(JURIS.match(t) or ART_HEAD.match(t) or ART_MARK.match(t)
                or header_kind(t) or re.match(r'^Anc\.?\s+art', t, re.I))


i = 0
N = len(P)
while i < N:
    x = P[i]
    t = x['t']

    # 1) Marqueur éditorial « Art … » (forme abrégée) : statuts extraits, ligne retirée du corps.
    mm = ART_MARK.match(t)
    if mm:
        nums = re.findall(r'\d{1,4}', t)
        stt = 'abrogé' if re.search(r'\babr\b', t, re.I) else ('modifié' if re.search(r'\bmod\b', t, re.I) else None)
        if stt:
            for n in nums[:2]:  # paires « 85 & 86 » ; jamais plus de 2 numéros d'articles
                status[anchor_from_desig(n)] = stt
        if len(t) > 40:
            review.append(('marqueur-long', t[:80]))
        i += 1
        continue

    # 2) Tête d'article « Article N.- … »
    m = ART_HEAD.match(t)
    if m:
        desig = m.group(1)
        anchor = anchor_from_desig(desig)
        base = 1 if desig.lower() == 'premier' else int(re.match(r'^(\d+)', desig).group(1))
        is_suffixed = bool(re.search(r'(bis|ter|quater)', desig, re.I) or '-' in desig)
        if anchor in seen_art:
            dupes.append((anchor, t[:60]))
        else:
            seen_art.add(anchor)
            disp = '1er' if desig.lower() == 'premier' else re.sub(r'\s+', ' ', desig).strip()
            labels[anchor] = f'Article {disp}'
            # « Article 280 (Abrogé).- » ou corps commençant par « Abrogé » /
            # « Anciennement 315, abrogé » → statut abrogé.
            rest = m.group(3) or ''
            paren = m.group(2) or ''
            if re.search(r'abrogé', paren, re.I) or re.match(r'^\(?\s*(anciennement\s+\d+\s*,\s*)?abrogé', rest, re.I):
                status[anchor] = 'abrogé'
            elif re.match(r'^\(\s*(L|D|Loi|Décret|Decret|Arr)', paren):
                # citation du texte modificateur dans la tête → article modifié
                status[anchor] = 'modifié'
            if not is_suffixed:
                if base > expected:
                    gaps.append((expected, base - 1))
                expected = max(expected, base + 1)
        cur_art = anchor
        body.append(t)
        i += 1
        continue

    # 3) Marqueur « Anc art N » (ancien numéro d'article) : éditorial, retiré du corps.
    if re.match(r'^Anc\.?\s+art', t, re.I):
        anc_art += 1
        i += 1
        continue

    # 4) Jurisprudence « N.- Arrêt … » : référence + considérant (lignes suivantes
    #    jusqu'à la prochaine frontière), rattachée à l'article — HORS texte officiel.
    #    CLÉ « sec-K|art-N » (comme Code du travail/civil), sinon le lecteur l'ignore.
    j = JURIS.match(t)
    if j and JURIS_KEY.search(t):
        ref = clean(j.group(2))
        excerpt_lines = []
        i += 1
        while i < N and not is_juris_boundary(P[i]['t']):
            excerpt_lines.append(P[i]['t'])
            i += 1
        if cur_art is None:
            review.append(('juris-sans-article', ref[:80]))
        else:
            key = f'{cur_section or "sec-0"}|{cur_art}'
            juris.setdefault(key, []).append({'ref': ref, 'excerpt': clean(' '.join(excerpt_lines))})
        continue
    if j and not JURIS_KEY.search(t):
        review.append(('numerote-conserve-corps', t[:80]))

    # 4) En-tête de structure (description sur la ligne suivante)
    kind = header_kind(t)
    if kind:
        enum, desc = split_enum_desc(t, kind)
        if not desc and i + 1 < N and looks_like_desc(P[i + 1]):
            desc = P[i + 1]['t']
            i += 1
            # description sur DEUX lignes (« Des commerçants » + « et des actes de commerce »)
            while i + 1 < N and looks_like_desc(P[i + 1]) and len(desc) < 80:
                desc = f'{desc} {P[i + 1]["t"]}'
                i += 1
        emit_header(kind, enum, clean(desc))
        i += 1
        continue

    # 5) Corps (alinéas, énumérations 1°), notes d'abrogation…)
    body.append(t)
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

# ── navToc ──
root = {'label': 'Code de commerce', 'anchor': toc[0]['anchor'] if toc else 'sec-1', 'children': []}
stack = [(-1, root)]
for e in toc:
    rank = KIND_RANK[e['kind']]
    while len(stack) > 1 and stack[-1][0] >= rank:
        stack.pop()
    node = {'label': e['label'], 'anchor': e['anchor']}
    stack[-1][1].setdefault('children', []).append(node)
    stack.append((rank, node))
navToc = [root]

structure = {
    'title': 'Code de commerce', 'annotationAuthor': 'Édition Vandal',
    'navToc': navToc, 'toc': toc, 'connexes': [], 'jurisprudence': juris,
    'commentaires': {}, 'connexe': {}, 'indexEntries': [],
    'oldVersions': {}, 'status': {k: v for k, v in status.items() if v}, 'labels': labels, 'crossRefs': [],
}

os.makedirs(PARSED, exist_ok=True)
open(os.path.join(PARSED, 'bodyOriginal.txt'), 'w').write(bodyOriginal)
json.dump(structure, open(os.path.join(PARSED, 'structure.json'), 'w'), ensure_ascii=False, indent=1)
json.dump(review, open(os.path.join(PARSED, 'review.json'), 'w'), ensure_ascii=False, indent=1)

# ── Diagnostics ──
print('bodyOriginal :', len(bodyOriginal) // 1024, 'Ko ·', len(body), 'lignes')
print('toc          :', len(toc), '—', dict(Counter(e['kind'] for e in toc)))
print('articles     :', len(labels), '(ancres uniques)')
nums = sorted(int(re.match(r'^art-(\d+)', a).group(1)) for a in labels if re.match(r'^art-\d+$', a))
print('plage        :', nums[0], '→', nums[-1], '· sauts:', gaps[:12], ('…' if len(gaps) > 12 else ''))
print('doublons     :', dupes[:6])
print('statuts mod  :', len(status), '· juris:', sum(len(v) for v in juris.values()), 'arrêts sur', len(juris), 'articles (clé sec-K|art-N)')
print('« Anc art » retirés du corps :', anc_art)
print('review       :', len(review), '—', review[:6])
