#!/usr/bin/env python3
"""
Parseur du CODE DE PROCÉDURE CIVILE D'HAÏTI
(voté par la Chambre Législative le 17 septembre 1963, promulgué le 17 janvier 1964).

Source : ~/Downloads/CPC_cumule_corrige.docx — Livres I à X (l'Appendice et le répertoire
de jurisprudence font l'objet de lots ultérieurs).

Traitements :
  · RETRAIT des renvois au Code de procédure civile FRANÇAIS (« Art. 7 fr »,
    « Conc. : Art 444, 445 fr », « D. 22 déc. 1858 fr, art. 17 ») ;
  · CONSERVATION des renvois « Anc. art. N » à l'ancienne numérotation HAÏTIENNE — ils
    servent à retrouver un article cité sous son ancien numéro. Ce sont des notes de
    marge de l'imprimé : ils ne doivent jamais devenir des ancres ;
  · ALINÉAS préservés (un paragraphe du .docx = un alinéa) ;
  · TÊTE D'ARTICLE admettant une mention de modification : « Article 717 (L. 12 sept
    1966).- ». Sans cela 14 articles échappent au relevé — ce sont précisément les
    articles amendés du Code.

Produit bodyOriginal.txt + structure.json (toc, labels, statuts des articles amendés).
    python3 scripts/data/cpc/parse_cpc.py
"""
import html
import json
import os
import re
import zipfile

SRC = os.path.expanduser('~/Downloads/CPC_cumule_corrige.docx')
DIR = os.path.dirname(os.path.abspath(__file__))

# ── Renvois au Code FRANÇAIS : retirés ────────────────────────────────────────
NUM = r'\d{1,4}[a-z]?(?:\s*(?:bis|ter|quater))?(?:,\s*\d+(?:er|e)\s*al)?'
FR_SEUL = re.compile(rf'^\[?\s*(?:Conc\.\s*:\s*)?(?:D\.\s*[^,]+,\s*)?Art\.?\s*(?:{NUM})'
                     rf'(?:\s*,\s*{NUM})*\s*(?:mod\s*)?fr\b[\s.,]*\]?$', re.I)
FR_FRAG = re.compile(rf'\[?\s*(?:Conc\.\s*:\s*)?(?:D\.\s*\d[^,]*,\s*)?Art\.?\s*(?:{NUM})'
                     rf'(?:\s*,\s*{NUM})*\s*(?:mod\s*)?fr\b[^—·]*', re.I)
DECRET_FR = re.compile(r'^D\.\s*\d[^,]*\bfr\b,?\s*art\.[^—]*', re.I)

# ── En-têtes de division ──────────────────────────────────────────────────────
LIVRE = re.compile(r'^LIVRE\s+(PREMIER|[IVX]+)\s*$')
# Deux ponctuations coexistent : « Titre II.- Des citations » et « Section I : Du compromis »
# (les six sections sur l'arbitrage). Ne pas admettre la seconde en perdait six divisions.
DIVISION = re.compile(r'^(Titre|Chapitre|Section|Sous-section)\s+[^.:]{1,40}\s*(?:\.\-|:)\s*.+$', re.I)
# Tête d'article, avec mention de modification facultative
# ⚠️ Numérotation DÉCIMALE : la partie arbitrage compte 43 articles « 957-1 » à « 978-1 ».
# Ne pas les admettre les perdait entièrement.
TETE = re.compile(r'^Article\s+(\d{1,4}(?:-\d{1,2})?)(?:er)?\s*(?:\(([^)]*)\))?\s*\.\-\s*(.*)$')
# Note de marge conservée (ancienne numérotation haïtienne) — jamais une ancre
ANC = re.compile(r'^Anc\.?\s*art', re.I)

FIN_CODE = 'APPENDICE'


def paragraphes():
    x = zipfile.ZipFile(SRC).read('word/document.xml').decode('utf8')
    x = re.sub(r'<w:tab/>', ' ', x)
    x = re.sub(r'</w:p>', '\n', x)
    x = re.sub(r'<[^>]+>', '', x)
    return [re.sub(r'[ \t]+', ' ', p.strip()).replace("'", '’')
            for p in html.unescape(x).split('\n') if p.strip()]


def sans_francais(l):
    """Retire les renvois au Code français ; '' si la ligne n'était que cela."""
    if FR_SEUL.match(l):
        return ''
    l = DECRET_FR.sub('', l)
    l = FR_FRAG.sub('', l)
    l = re.sub(r'^\s*[—·,\-]+\s*', '', l)
    l = re.sub(r'\s*[—·,]\s*$', '', l)
    return l.strip(' []')


def main():
    ps = paragraphes()
    fin = next((i for i, p in enumerate(ps) if p.strip() == FIN_CODE), len(ps))
    code = ps[:fin]
    print(f'Code (Livres I à X) : {len(code)} paragraphes sur {len(ps)}')

    corps, toc, labels, statuts = [], [], {}, {}
    n_fr_sup = n_fr_net = n_anc = 0
    livre_en_cours = None

    for brut in code:
        l = brut
        if re.search(r'\bfr\b', l):
            net = sans_francais(l)
            if net == '':
                n_fr_sup += 1
                continue
            if net != l:
                n_fr_net += 1
            l = net
        if ANC.match(l):
            n_anc += 1

        m = LIVRE.match(l)
        if m:
            livre_en_cours = l
            corps.append(l)
            toc.append({'level': 1, 'label': l, 'anchor': f'sec-{len(toc) + 1}', 'kind': 'livre'})
            continue
        if DIVISION.match(l) and len(l) < 200:  # un titre de l'arbitrage fait 172 car.
            niveau = {'titre': 2, 'chapitre': 3, 'section': 4, 'sous-section': 5}[l.split()[0].lower()]
            corps.append(l)
            toc.append({'level': niveau, 'label': l, 'anchor': f'sec-{len(toc) + 1}',
                        'kind': l.split()[0].lower()})
            continue
        t = TETE.match(l)
        if t:
            num, mention, reste = t.group(1), t.group(2), t.group(3)
            lib = 'Article 1er' if num == '1' else f'Article {num}'
            ancre = f'art-{num}'
            corps.append(f'{lib}{f" ({mention})" if mention else ""}.- {reste}'.rstrip())
            labels[ancre] = lib
            if mention:
                statuts[ancre] = mention.strip()
            continue
        corps.append(l)

    body = '\n'.join(corps) + '\n'
    struct = {'title': 'Code de procédure civile d’Haïti', 'toc': toc, 'labels': labels,
              'amendes': statuts}
    open(f'{DIR}/bodyOriginal.txt', 'w').write(body)
    json.dump(struct, open(f'{DIR}/structure.json', 'w'), ensure_ascii=False, indent=1)

    entiers = sorted(int(k.replace('art-', '')) for k in labels if '-' not in k.replace('art-', ''))
    decimaux = sorted(k.replace('art-', '') for k in labels if '-' in k.replace('art-', ''))
    nums = entiers
    manq = sorted(set(range(1, max(entiers) + 1)) - set(entiers))
    print(f'\nrenvois FRANÇAIS retirés          : {n_fr_sup} lignes supprimées, {n_fr_net} nettoyées')
    print(f'notes « Anc. art. » CONSERVÉES    : {n_anc}')
    residuels = sum(1 for l in corps if re.search(r'\bfr\b', l))
    print(f'renvois français résiduels        : {residuels}')
    print(f'divisions (toc)                   : {len(toc)}')
    print(f'articles                          : {len(labels)}  = {len(entiers)} entiers ({entiers[0]} → {entiers[-1]})'
          f' + {len(decimaux)} décimaux'
          + (f'  ⚠ manquants {manq}' if manq else '  ✓ série entière sans lacune'))
    if decimaux:
        print(f'  décimaux : {decimaux[0]} … {decimaux[-1]}')
    print(f'articles AMENDÉS (mention au texte): {len(statuts)} → {sorted(int(k.replace("art-", "")) for k in statuts)}')
    print(f'corps                             : {len(body)} caractères, {len(corps)} lignes, '
          f'moyenne {len(body) // max(1, len(corps))} car./ligne')
    print(f'\n→ {DIR}/bodyOriginal.txt · structure.json')


if __name__ == '__main__':
    main()
