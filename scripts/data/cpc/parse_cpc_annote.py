#!/usr/bin/env python3
"""
CODE DE PROCÉDURE CIVILE — séparation du TEXTE DE LOI et de son APPAREIL D'ANNOTATION.

Le corps publié jusqu'ici mêlait trois matières que l'imprimé distingue pourtant à l'œil :
le texte des articles, les notes de jurisprudence, et les renvois de marge à l'ancienne
numérotation. Le lecteur y voyait 1 137 extraits d'arrêts coulés dans le fil des articles.
Ce parseur les sépare : le corps ne garde que la loi, la jurisprudence et les « Anc. art. »
passent en annotations repliables.

⚠️ LE DISCRIMINANT EST L'ITALIQUE, et lui seul. Le scan (Code_procedure_civile-pdf.pdf,
p. 40) le montre sans ambiguïté : les articles sont en romain, la jurisprudence tout entière
— extraits numérotés, alinéas de suite et références d'arrêt — en italique. Le .docx a
fidèlement conservé ces styles, ce qui rend la séparation sûre là où aucune règle de forme ne
suffirait :
  · 1 137 lignes « N.- » sont des extraits de jurisprudence, mais 122 autres, EN ROMAIN, sont
    de vraies énumérations d'articles. Les confondre amputerait le texte de loi.
  · 58 articles portent un arrêt SANS extrait numéroté : une note isolée n'est pas numérotée,
    et rien dans le texte ne signale où elle commence.
La hauteur des caractères du PDF ne pouvait pas servir : d'une page à l'autre l'écart entre
les deux corps tombe à 0,1 pt — en deçà du tremblé de l'OCR.

Produit : bodyOriginal.txt (loi seule) · structure.json · jurisprudence.json · anciens.json
    python3 scripts/data/cpc/parse_cpc_annote.py
"""
import html
import json
import os
import re
import zipfile

SRC = os.path.expanduser('~/Downloads/CPC_cumule_corrige.docx')
DIR = os.path.dirname(os.path.abspath(__file__))

# ── Renvois au Code FRANÇAIS : retirés (repris de parse_cpc.py) ───────────────
NUM = r'\d{1,4}[a-z]?(?:\s*(?:bis|ter|quater))?(?:,\s*\d+(?:er|e)\s*al)?'
FR_SEUL = re.compile(rf'^\[?\s*(?:Conc\.\s*:\s*)?(?:D\.\s*[^,]+,\s*)?Art\.?\s*(?:{NUM})'
                     rf'(?:\s*,\s*{NUM})*\s*(?:mod\s*)?fr\b[\s.,]*\]?$', re.I)
FR_FRAG = re.compile(rf'\[?\s*(?:Conc\.\s*:\s*)?(?:D\.\s*\d[^,]*,\s*)?Art\.?\s*(?:{NUM})'
                     rf'(?:\s*,\s*{NUM})*\s*(?:mod\s*)?fr\b[^—·]*', re.I)
DECRET_FR = re.compile(r'^D\.\s*\d[^,]*\bfr\b,?\s*art\.[^—]*', re.I)

LIVRE = re.compile(r'^LIVRE\s+(PREMIER|[IVX]+)\s*$')
DIVISION = re.compile(r'^(Titre|Chapitre|Section|Sous-section)\s+[^.:]{1,40}\s*(?:\.\-|:)\s*.+$', re.I)
TETE = re.compile(r'^Article\s+(\d{1,4}(?:-\d{1,2})?)(?:er)?\s*(?:\(([^)]*)\))?\s*\.\-\s*(.*)$')
ANC = re.compile(r'Anc\.?\s*art\.?\s*(\d{1,4})', re.I)
NOTE_MARGE = re.compile(r'^\[?\s*(?:Art\.?\s*\d|Anc\.?\s*art|Conc\.)', re.I)
EXTRAIT = re.compile(r'^(\d{1,2})\s*\.\-\s*(.*)$')
ARRET = re.compile(r'^Cass\b', re.I)
FIN_CODE = 'APPENDICE'


def paragraphes():
    """[(texte, italique)] — l'italique est lu sur les runs, non sur le paragraphe."""
    x = zipfile.ZipFile(SRC).read('word/document.xml').decode('utf8')
    out = []
    for p in re.findall(r'<w:p\b[^>]*>(.*?)</w:p>', x, re.S):
        t = html.unescape(re.sub(r'<[^>]+>', '', re.sub(r'<w:tab/>', ' ', p)))
        t = re.sub(r'[ \t]+', ' ', t).strip().replace("'", '’')
        if not t:
            continue
        runs = [r for r in re.findall(r'<w:r\b[^>]*>(.*?)</w:r>', p, re.S) if re.search(r'<w:t[ >]', r)]
        ital = sum(1 for r in runs if re.search(r'<w:i\s*/>|<w:i\s+w:val="(?:1|true|on)"', r))
        out.append((t, bool(runs) and ital / len(runs) > 0.6))
    return out


def sans_francais(l):
    if FR_SEUL.match(l):
        return ''
    l = DECRET_FR.sub('', l)
    l = FR_FRAG.sub('', l)
    l = re.sub(r'^\s*[—·,\-]+\s*', '', l)
    l = re.sub(r'\s*[—·,]\s*$', '', l)
    return l.strip(' []')


def decouper_juris(bloc):
    """Suite de paragraphes en italique → [{n, excerpt, refs}].

    Une note se lit : l'extrait (numéroté ou non), ses alinéas de suite, puis le ou les
    arrêts qui l'appuient. Deux libertés de l'imprimé qu'il faut suivre :
      · une note peut n'avoir AUCUN arrêt — ce sont les notes doctrinales, « Il est
        généralement admis que… », « Il est de règle que… » ;
      · une note peut en avoir PLUSIEURS — l'article 19 en aligne deux sous sa note 3.
    Fermer sur le premier arrêt venu fabriquerait des notes fantômes, réduites à une
    référence sans texte.
    """
    items, cur = [], {'n': None, 'excerpt': [], 'refs': []}

    def clore():
        if cur['excerpt'] or cur['refs']:
            items.append({'n': cur['n'], 'excerpt': '\n'.join(cur['excerpt']).strip(),
                          'refs': list(cur['refs'])})

    for p in bloc:
        if ARRET.match(p):
            cur['refs'].append(p)
            continue
        m = EXTRAIT.match(p)
        if m and (cur['excerpt'] or cur['refs']):
            clore()
            cur = {'n': int(m.group(1)), 'excerpt': [m.group(2)] if m.group(2) else [], 'refs': []}
            continue
        if m:
            cur['n'] = int(m.group(1))
            if m.group(2):
                cur['excerpt'].append(m.group(2))
            continue
        # Un alinéa qui SUIT un arrêt ouvre une note nouvelle : l'arrêt scellait la
        # précédente. Sans cela, deux notes voisines non numérotées se confondraient.
        if cur['refs']:
            clore()
            cur = {'n': None, 'excerpt': [p], 'refs': []}
            continue
        cur['excerpt'].append(p)
    clore()
    return [i for i in items if i['excerpt'] or i['refs']]


def main():
    ps = paragraphes()
    fin = next((i for i, (t, _) in enumerate(ps) if t == FIN_CODE), len(ps))
    code = ps[:fin]

    corps, toc, labels, statuts = [], [], {}, {}
    juris, anciens = {}, {}
    ancre_courante = None
    section_courante = None
    bloc_ital, anc_en_attente = [], None
    n_fr_sup = n_fr_net = 0

    def vider_juris():
        nonlocal bloc_ital
        if bloc_ital and ancre_courante:
            notes = decouper_juris(bloc_ital)
            if notes:
                cle = f'{section_courante or "sec-0"}|{ancre_courante}'
                juris.setdefault(cle, []).extend(notes)
        bloc_ital = []

    for texte, ital in code:
        l = texte
        # ⚠️ Nettoyer les renvois français AVANT de reconnaître la note de marge. La note
        # « D. 22 déc. 1858 fr, art. 17 — Anc. art. 12, Anc. art. 18 » de l'article 18 ne
        # s'annonce comme telle qu'une fois le décret français retiré ; testée d'abord, elle
        # échappait au filtre et, composée en italique, allait grossir la jurisprudence.
        if re.search(r'\bfr\b', l):
            net = sans_francais(l)
            if net == '':
                n_fr_sup += 1
                continue
            if net != l:
                n_fr_net += 1
            l = net
        # Note de marge : l'ancienne numérotation est mise de côté pour l'article qui SUIT —
        # c'est ainsi que l'imprimé la dispose, en regard de sa tête. Un article peut en
        # porter DEUX (« Anc. art. 12, Anc. art. 18 ») : on garde la désignation entière.
        if NOTE_MARGE.match(l):
            nums = ANC.findall(l)
            if nums:
                anc_en_attente = nums
            n_fr_sup += 1
            continue

        # ⚠️ La structure prime sur le style : neuf en-têtes de division sont composés en
        # italique dans le .docx. S'en remettre au style seul les versait à la jurisprudence
        # et amputait le sommaire de neuf entrées.
        structure = bool(LIVRE.match(l) or (DIVISION.match(l) and len(l) < 200) or TETE.match(l))
        if ital and not structure:
            bloc_ital.append(l)
            continue
        vider_juris()

        if LIVRE.match(l):
            corps.append(l)
            toc.append({'level': 1, 'label': l, 'anchor': f'sec-{len(toc) + 1}', 'kind': 'livre'})
            section_courante, ancre_courante = toc[-1]['anchor'], None
            continue
        if DIVISION.match(l) and len(l) < 200:
            niveau = {'titre': 2, 'chapitre': 3, 'section': 4, 'sous-section': 5}[l.split()[0].lower()]
            corps.append(l)
            toc.append({'level': niveau, 'label': l, 'anchor': f'sec-{len(toc) + 1}',
                        'kind': l.split()[0].lower()})
            section_courante, ancre_courante = toc[-1]['anchor'], None
            continue
        t = TETE.match(l)
        if t:
            num, mention, reste = t.group(1), t.group(2), t.group(3)
            lib = 'Article 1er' if num == '1' else f'Article {num}'
            ancre_courante = f'art-{num}'
            corps.append(f'{lib}{f" ({mention})" if mention else ""}.- {reste}'.rstrip())
            labels[ancre_courante] = lib
            if mention:
                statuts[ancre_courante] = mention.strip()
            if anc_en_attente:
                anciens[ancre_courante] = anc_en_attente
                anc_en_attente = None
            continue
        corps.append(l)
    vider_juris()

    body = '\n'.join(corps) + '\n'
    open(f'{DIR}/bodyOriginal.txt', 'w').write(body)
    json.dump({'title': 'Code de procédure civile d’Haïti', 'toc': toc, 'labels': labels,
               'amendes': statuts}, open(f'{DIR}/structure.json', 'w'), ensure_ascii=False, indent=1)
    json.dump(juris, open(f'{DIR}/jurisprudence.json', 'w'), ensure_ascii=False, indent=1)
    json.dump(anciens, open(f'{DIR}/anciens.json', 'w'), ensure_ascii=False, indent=1)

    entiers = sorted(int(k.replace('art-', '')) for k in labels if '-' not in k.replace('art-', ''))
    manq = sorted(set(range(1, max(entiers) + 1)) - set(entiers))
    notes = sum(len(v) for v in juris.values())
    arrets = sum(len(i['refs']) for v in juris.values() for i in v)
    sans_ref = sum(1 for v in juris.values() for i in v if not i['refs'])
    print(f'articles                : {len(labels)} ({len(entiers)} entiers'
          + ('  ✓ série entière' if not manq else f'  ⚠ manquants {manq}') + ')')
    print(f'divisions               : {len(toc)}')
    print(f'articles annotés        : {len(juris)}')
    print(f'notes de jurisprudence  : {notes} · {arrets} arrêts cités · '
          f'{sans_ref} notes doctrinales (sans arrêt)')
    print(f'renvois « Anc. art. »   : {len(anciens)}')
    print(f'renvois français retirés: {n_fr_sup} lignes, {n_fr_net} nettoyées · résiduels '
          f'{sum(1 for l in corps if re.search(r"(?<![a-zA-Zà-ÿ])fr(?![a-zA-Zà-ÿ])", l))}')
    print(f'corps                   : {len(body)} car., {len(corps)} lignes')
    print(f'\n→ bodyOriginal.txt · structure.json · jurisprudence.json · anciens.json')


if __name__ == '__main__':
    main()
