#!/usr/bin/env python3
"""Parser Code civil annoté (décrets intégrés) → bodyOriginal + structure.json — PASSE 2.

bodyOriginal = le Code officiel consolidé SEUL (en-têtes LOI/CHAPITRE/SECTION + 2047
articles, version amendée avec citations « (D. du …) » et mentions d'abrogation).
Structure d'affichage (structure.json) :
  - connexe[art-N]   : blocs « législation connexe » {label, text}
  - jurisprudence[k] : notes d'arrêts (clé sec-K|art-N)
  - commentaires[k]  : doctrine de l'auteur
  - status/labels    : modifié / abrogé par article
Règles clés :
  - Code vs décret intégré : numérotation du Code CONTINUE (1→2047) ; toute tête
    « Art. N » hors séquence est un article de décret → bloc connexe.
  - En-tête de décret : style Textecomplmentaire OU ligne (Décret|Décret-loi|Loi|
    Arrêté|Constitution) même stylée ArticleduCode (ex. « Décret-loi du 11 janvier 1944 »).
  - Bloc connexe ouvert : TOUT y entre (énumérations « 1. » comprises) sauf tête de
    Code / heading / nouvel en-tête / style Jurisprudence.
  - Fragments de coupure de page (début en minuscule/tiret) : recollés à la dernière
    émission (corps, jurisprudence, commentaire ou bloc connexe).
  - Lignes de titre continuées (MAJUSCULES, « Des effets… » sans ponctuation finale)
    → corps (fidèle au flux source), pas commentaires.
"""
import zipfile, re, json, os
OUT = os.path.dirname(os.path.abspath(__file__))
DOCX = '/Users/cvaval/Downloads/Code_civil_Clean_decrets-integres.docx'

ENT = [('&amp;','&'),('&lt;','<'),('&gt;','>'),('&#x2019;','’'),('&#x2018;','‘'),
       ('&#x2013;','–'),('&#x2014;','—'),('&#xa0;',' '),('&quot;','"'),('&apos;',"'")]
def clean(t):
    for a,b in ENT: t = t.replace(a,b)
    return re.sub(r'\s+',' ',t).strip()

def paras(path):
    z = zipfile.ZipFile(path)
    xml = z.read('word/document.xml').decode('utf-8','replace')
    out = []
    for p in re.findall(r'<w:p\b.*?</w:p>', xml, re.S):
        txt = clean(''.join(re.findall(r'<w:t[^>]*>(.*?)</w:t>', p, re.S)))
        if not txt: continue
        out.append({
            'b': '<w:b/>' in p or '<w:b ' in p,
            'i': '<w:i/>' in p or '<w:i ' in p,
            's': (re.search(r'<w:pStyle w:val="([^"]+)"', p) or [None,''])[1],
            't': txt,
        })
    return out

P = paras(DOCX)

ART   = re.compile(r'^Art\.?\s+(\d+)(er|ère)?\s*[.\-–]*\s*', re.I)
LEG   = re.compile(r'^(D[ée]cret(-loi)?\s+(du|de)\s|Loi\s+du\s|Arr[êe]t[ée]\s+du\s|Constitution\s+de\s+\d{4})', re.I)
NUMED = re.compile(r'^\d{1,2}\s*[.,\-–)]\s')
CASS  = re.compile(r'\bCass\.|\bCuss\.|Cour\s+de\s+cassation|Trib\.\s|arrêt\s+du\s+\d', re.I)
MODIF = re.compile(r'^Art\.?\s+\d+(?:er)?\s*[.\-–]*\s*\((D\.|Décret|L\.|Loi)[^)]*\)', re.I)
ABROG = re.compile(r'^Art\.?\s+\d+(?:er)?\s*[.\-–]*\s*Abrogé', re.I)
TITLEISH = re.compile(r"^(Des?\s|Du\s|D[’']|De\s+la\s|Aux?\s)")
FRAG  = re.compile(r"^[a-zàâäéèêëîïôöùûüç]|^[—–\-«\"]")  # début en minuscule / tiret → fragment

toc = []; body = []
labels = {}; status = {}
connexe = {}; juris = {}; comments = {}
review = []

sec_n = 0; cur_sec = 'sec-0'; cur_art = None
expected = 1; open_cx = None; gaps = []
pending = []  # annotations émises avant le 1er article d'une section → rattachées à lui
last = None  # dernière émission : ('body',)|('juris',k)|('comment',k)|('cx',)

def head(level, label, kind):
    global sec_n, cur_sec, last
    flush_cx()
    sec_n += 1
    a = f'sec-{sec_n}'
    toc.append({'level': level, 'label': label, 'anchor': a, 'kind': kind})
    body.append(label)
    cur_sec = a
    last = None  # un titre ne reçoit pas de fragment

def jkey():
    return f'{cur_sec}|{cur_art}' if cur_art else cur_sec

def flush_cx():
    global open_cx
    if open_cx and open_cx['lines']:
        target = cur_art
        if target:
            connexe.setdefault(target, []).append(
                {'label': open_cx['label'], 'text': '\n'.join(open_cx['lines']).strip()})
        else:
            review.append(('connexe-sans-article', (open_cx['label'] or open_cx['lines'][0])[:80]))
    elif open_cx and open_cx['label']:
        # en-tête seul, sans contenu : le libellé EST la citation
        if cur_art: connexe.setdefault(cur_art, []).append({'label': '', 'text': open_cx['label']})
    open_cx = None

def append_frag(t):
    """Recolle un fragment de coupure de page à la dernière émission."""
    global last
    if last is None: return False
    kind = last[0]
    if kind == 'body' and body: body[-1] = body[-1] + ' ' + t; return True
    if kind == 'juris': juris[last[1]][-1]['excerpt'] += ' ' + t; return True
    if kind == 'comment': comments[last[1]][-1] += ' ' + t; return True
    if kind == 'cx' and open_cx is not None and open_cx['lines']:
        open_cx['lines'][-1] += ' ' + t; return True
    return False

for idx, x in enumerate(P):
    t, st, bold, ital = x['t'], x['s'], x['b'], x['i']

    # ── En-têtes de structure ──
    if st == 'Heading1': head(1, t, 'loi'); cur_art = None; continue
    if st == 'Heading2': head(2, t, 'chapitre'); continue
    if st == 'Heading3': head(3, t, 'section'); continue

    m = ART.match(t)

    # ── Tête d'article : Code si la séquence suit ──
    if st == 'ArticleduCode' and m:
        n = int(m.group(1))
        if n == expected or (expected < n <= expected + 5):
            if n != expected: gaps.append((expected, n))
            flush_cx()
            cur_art = f'art-{n}'
            labels[cur_art] = 'Article 1er' if n == 1 else f'Article {n}'
            if pending:
                k2 = jkey()
                for kind2, payload in pending:
                    (juris if kind2 == 'juris' else comments).setdefault(k2, []).append(payload)
                pending.clear()
            if ABROG.match(t): status[cur_art] = 'abrogé'
            elif MODIF.match(t): status[cur_art] = 'modifié'
            body.append(t)
            expected = n + 1
            last = ('body',)
            continue
        else:
            # article interne d'un décret intégré
            if open_cx is None:
                blocks = connexe.get(cur_art or '', [])
                if blocks:  # continuation du dernier bloc du même article
                    open_cx = {'label': blocks[-1]['label'], 'lines': [blocks[-1]['text']]}
                    connexe[cur_art].pop()
                    review.append(('decret-art-recollé', f'[{idx}] {t[:70]}'))
                else:
                    open_cx = {'label': '', 'lines': []}
                    review.append(('decret-art-sans-en-tete', f'[{idx}] {t[:70]}'))
            open_cx['lines'].append(t)
            last = ('cx',)
            continue

    # ── En-tête de législation connexe (style dédié OU ligne Décret/Loi/…) ──
    is_leg_header = st == 'Textecomplmentaire' or (LEG.match(t) and st != 'Jurisprudence' and not NUMED.match(t))
    if is_leg_header:
        flush_cx()
        open_cx = {'label': t, 'lines': []}
        last = ('cx',)
        continue

    # ── Style Jurisprudence : ferme le bloc connexe ──
    if st == 'Jurisprudence':
        flush_cx()
        k = jkey()
        juris.setdefault(k, []).append({'ref': '', 'excerpt': t})
        last = ('juris', k)
        continue

    # ── Bloc connexe ouvert : tout y entre (énumérations comprises) ──
    if open_cx is not None:
        if FRAG.match(t) and open_cx['lines'] and append_frag(t): continue
        open_cx['lines'].append(t)
        last = ('cx',)
        continue

    # ── Fragments de coupure de page ──
    if FRAG.match(t) and not NUMED.match(t) and append_frag(t):
        review.append(('fragment-recollé', f'[{idx}] {t[:60]}'))
        continue

    # ── Lignes numérotées : énumération d'article OU note de jurisprudence ──
    mnum = re.match(r'^(\d{1,2})\s*[.,\-–)]\s*', t)
    if mnum and st != 'ArticleduCode':
        n_line = int(mnum.group(1))
        prev_num = re.match(r'^(\d{1,2})\s*[.,\-–)]', body[-1]) if body else None
        # Suite d'énumération du corps : l'article annonce une liste (« : ») ou l'item
        # précédent du corps porte le numéro n-1 → texte OFFICIEL (ex. art. 1915, 3°-5°).
        if last == ('body',) and (body[-1].rstrip().endswith(':') or (prev_num and n_line == int(prev_num.group(1)) + 1)):
            body.append(t)
            review.append(('énum→corps', f'[{idx}] {t[:70]}'))
            continue
        k = jkey()
        juris.setdefault(k, []).append({'ref': '', 'excerpt': t})
        last = ('juris', k)
        continue

    # ── Commentaires (italiques / ListParagraph) ──
    if st == 'ListParagraph' or (not st and ital):
        if cur_art is None:
            pending.append(('juris' if CASS.search(t) else 'comment',
                            {'ref': '', 'excerpt': t} if CASS.search(t) else t))
            last = None
            continue
        k = jkey()
        if CASS.search(t):
            juris.setdefault(k, []).append({'ref': '', 'excerpt': t})
            last = ('juris', k)
        else:
            comments.setdefault(k, []).append(t)
            last = ('comment', k)
        continue

    # ── Corps d'article ──
    if st == 'ArticleduCode':
        body.append(t)
        last = ('body',)
        continue

    # ── Libres non italiques ──
    if idx < 3 and t.isupper():
        body.append(t); last = None; continue
    if (t.isupper() and len(t) > 8) or (TITLEISH.match(t) and not t.rstrip().endswith(('.', ';', ':')) and len(t) < 130) \
       or (len(t) < 45 and t[0].isupper() and not t.rstrip().endswith(('.', ';', ':')) and not CASS.search(t)):
        body.append(t)  # ligne de titre continuée / intertitre court → reste dans le flux
        last = None
        review.append(('titre→corps', f'[{idx}] {t[:70]}'))
        continue
    k = jkey()
    if re.match(r'^V\.\s', t):  # « V. le D. … » : renvoi de l'auteur → commentaire
        comments.setdefault(k, []).append(t)
        last = ('comment', k)
        review.append(('voir→commentaire', f'[{idx}] {t[:70]}'))
    elif CASS.search(t):
        juris.setdefault(k, []).append({'ref': '', 'excerpt': t})
        last = ('juris', k)
        review.append(('libre→juris', f'[{idx}] {t[:70]}'))
    elif last == ('body',):
        body.append(t)  # suite d'énumération d'article (style perdu) → corps
        review.append(('libre→corps', f'[{idx}] {t[:70]}'))
    elif cur_art is None:
        pending.append(('comment', t))
        last = None
        review.append(('libre→commentaire-reporté', f'[{idx}] {t[:70]}'))
    else:
        comments.setdefault(k, []).append(t)
        last = ('comment', k)
        review.append(('libre→commentaire', f'[{idx}] {t[:70]}'))

flush_cx()

bodyOriginal = '\n'.join(body)

# navToc : LOIS → chapitres → sections
nav = []; cur_l = cur_c = None
for e in toc:
    if e['kind'] == 'loi':
        cur_l = {'label': e['label'], 'anchor': e['anchor'], 'children': []}
        nav.append(cur_l); cur_c = None
    elif e['kind'] == 'chapitre' and cur_l is not None:
        cur_c = {'label': e['label'], 'anchor': e['anchor'], 'children': []}
        cur_l['children'].append(cur_c)
    elif e['kind'] == 'section':
        (cur_c['children'] if cur_c is not None else cur_l['children']).append(
            {'label': e['label'], 'anchor': e['anchor']})
navToc = [{'label': 'Code civil d’Haïti', 'anchor': toc[0]['anchor'] if toc else 'sec-1', 'children': nav}]

structure = {
    'title': 'Code civil d’Haïti', 'annotationAuthor': '',
    'navToc': navToc, 'toc': toc, 'connexes': [], 'jurisprudence': juris,
    'commentaires': comments, 'connexe': connexe, 'indexEntries': [],
    'oldVersions': {}, 'status': {k: v for k, v in status.items() if v}, 'labels': labels, 'crossRefs': [],
}
open(os.path.join(OUT, 'parsed_bodyOriginal.txt'), 'w').write(bodyOriginal)
json.dump(structure, open(os.path.join(OUT, 'parsed_structure.json'), 'w'), ensure_ascii=False, indent=1)
json.dump(review, open(os.path.join(OUT, 'review.json'), 'w'), ensure_ascii=False, indent=1)

from collections import Counter
print('bodyOriginal :', len(bodyOriginal)//1024, 'Ko ·', len(body), 'lignes')
print('toc          :', len(toc), '—', dict(Counter(e['kind'] for e in toc)))
print('articles Code:', len(labels), '· manquants:', [n for n in range(1,2048) if f'art-{n}' not in labels][:10])
print('sauts        :', gaps[:10], f'({len(gaps)})')
print('statuts      :', dict(Counter(status.values())))
print('connexe      :', sum(len(v) for v in connexe.values()), 'blocs sous', len(connexe), 'articles')
print('jurisprudence:', sum(len(v) for v in juris.values()), 'notes sous', len(juris), 'clés')
print('commentaires :', sum(len(v) for v in comments.values()), '§ sous', len(comments), 'clés')
print('review       :', dict(Counter(k for k, _ in review)))
