#!/usr/bin/env python3
"""Parse CCH.docx : le Code civil, ses paragraphes et son appareil, tels que composés.

Le fichier distingue les strates par la MISE EN FORME, pas par la ponctuation :
  - texte de loi        : corps 20 (10 pt), sans retrait ;
  - appareil de l'auteur: corps 19 (9,5 pt), retrait de 567 twips, souvent encadré ;
  - titres              : corps 24-28, centrés, ou styles Heading1/2/3.

C'est la seule lecture qui rende à chaque paragraphe sa nature — et donc les sauts de
paragraphe du texte officiel, que notre base a perdus en recollant les colonnes.

Sortie JSON : { articles: { "157": {paras: [...], notes: [...], titre: "...", ordre: n} },
                titres: [...] }
"""
import json
import re
import pathlib
import sys
from collections import Counter

DOC = pathlib.Path('cch/word/document.xml').read_text(encoding='utf-8')

ART = re.compile(r'^Art(?:icle)?s?\.?\s*(1er|\d{1,4}(?:[-.]\d{1,2})?)(?:\s*(bis|ter))?\s*[.\-–—]?\s+', re.I)
TITRE_STYLES = {'Heading1', 'Heading2', 'Heading3', 'Titre1', 'Titre2', 'Titre3'}


def deschapper(s: str) -> str:
    return (s.replace('&amp;', '&').replace('&lt;', '<').replace('&gt;', '>')
             .replace('&quot;', '"').replace('&apos;', "'"))


def paragraphes():
    for p in re.findall(r'<w:p[ >].*?</w:p>', DOC, re.S):
        ppr = (re.search(r'<w:pPr>.*?</w:pPr>', p, re.S) or [''])[0]
        style = (re.search(r'<w:pStyle w:val="([^"]+)"', ppr) or [None, None])[1]
        ind = int((re.search(r'w:left="(\d+)"', ppr) or [0, 0])[1] or 0)
        jc = (re.search(r'<w:jc w:val="([^"]+)"', ppr) or [None, None])[1]
        borde = '<w:pBdr>' in ppr
        corps = p[len(ppr):] if ppr else p
        runs = re.findall(r'<w:r[ >].*?</w:r>', corps, re.S)
        txt = ''
        tailles = []
        for r in runs:
            t = re.sub(r'<w:tab/>', ' ', r)
            morceau = ''.join(re.findall(r'<w:t[^>]*>(.*?)</w:t>', t, re.S))
            if not morceau:
                continue
            txt += morceau
            sz = re.search(r'<w:sz w:val="(\d+)"/>', r)
            if sz and morceau.strip():
                tailles += [int(sz.group(1))] * len(morceau.strip())
        txt = deschapper(txt).strip()
        if not txt:
            continue
        sz = Counter(tailles).most_common(1)[0][0] if tailles else 0
        yield {'style': style, 'sz': sz, 'ind': ind, 'jc': jc, 'bdr': borde, 'txt': txt}


def est_titre(p) -> bool:
    return (p['style'] in TITRE_STYLES) or (p['jc'] == 'center' and len(p['txt']) < 120) \
        or bool(re.match(r'^(LIVRE|TITRE|CHAPITRE|SECTION|LOI No|§)\b', p['txt']))


def est_annotation(p) -> bool:
    """Appareil : corps réduit, ou retrait/encadré propres aux notes."""
    return p['bdr'] or p['ind'] >= 400 or (p['sz'] and p['sz'] <= 19)


def epine(candidats):
    """Indices de la plus longue sous-suite CROISSANTE de numéros d'article.

    Le recueil intercale des lois annexées dont la numérotation repart à 1 (« Art. 3. »
    de la loi sur l'état civil, « Art. 125.1 » de la Constitution). Un simple compteur
    monotone se laisse piéger dans les deux sens : soit il absorbe ces textes, soit un
    « Art. 125.1 » rencontré tôt fait rejeter les articles 2 à 126 du Code. La plus
    longue sous-suite croissante retient, elle, la SUITE DOMINANTE : celle du Code.
    """
    import bisect
    queues, prev, idx = [], [None] * len(candidats), []
    for i, (_, n) in enumerate(candidats):
        pos = bisect.bisect_left([candidats[j][1] for j in queues], n)
        if pos == len(queues):
            queues.append(i)
        else:
            queues[pos] = i
        prev[i] = queues[pos - 1] if pos else None
    out, k = [], queues[-1] if queues else None
    while k is not None:
        out.append(k)
        k = prev[k]
    return set(out)


def main():
    """Deux passes : on repère d'abord l'épine dorsale du Code (plus longue suite
    croissante de numéros), puis on range chaque paragraphe — loi, note ou texte annexé."""
    ps = [p for p in paragraphes()]
    candidats = []
    for i, p in enumerate(ps):
        m = ART.match(p['txt'])
        if m and not est_annotation(p) and not est_titre(p):
            candidats.append((i, 1 if m.group(1) == '1er' else int(re.match(r'\d+', m.group(1)).group(0))))
    garde = {candidats[i][0] for i in epine(candidats)}

    articles, titres, annexes, ordre = {}, [], [], 0
    courant, titre_courant, dans_annexe = None, '', False
    for i, p in enumerate(ps):
        if est_titre(p):
            titres.append(p['txt'])
            titre_courant = p['txt']
            dans_annexe = False
            continue
        m = ART.match(p['txt'])
        if m and not est_annotation(p):
            if i in garde:
                brut = m.group(1)
                num = ('1' if brut == '1er' else brut.replace('.', '-')) + (f"-{m.group(2).lower()}" if m.group(2) else '')
                ordre += 1
                courant, dans_annexe = num, False
                articles.setdefault(num, {'paras': [], 'notes': [], 'titre': titre_courant, 'ordre': ordre})
                articles[num]['paras'].append(p['txt'])
            else:
                annexes.append({'apres': courant, 'txt': p['txt']})
                dans_annexe = True
            continue
        if courant is None:
            continue
        if est_annotation(p):
            articles[courant]['notes'].append(p['txt'])
            dans_annexe = False
        elif dans_annexe:
            annexes.append({'apres': courant, 'txt': p['txt']})
        else:
            articles[courant]['paras'].append(p['txt'])
    json.dump({'articles': articles, 'titres': titres, 'annexes': annexes},
              open(sys.argv[1] if len(sys.argv) > 1 else 'cch.json', 'w', encoding='utf-8'), ensure_ascii=False)
    nums = [k for k in articles if re.fullmatch(r'\d+', k)]
    print(f"{len(articles)} articles · {len(titres)} intertitres · {len(annexes)} paragraphes annexés")
    print(f"plage : {min(map(int, nums))} … {max(map(int, nums))}")
    print(f"paragraphes de loi : {sum(len(a['paras']) for a in articles.values())} · "
          f"notes : {sum(len(a['notes']) for a in articles.values())}")
    for n in ('157', '683', '701'):
        a = articles.get(n)
        if a:
            print(f"\n— art. {n} — {len(a['paras'])} paragraphe(s), {len(a['notes'])} note(s) · {a['titre'][:50]}")
            for x in a['paras']:
                print('   LOI  :', x[:120])
            for x in a['notes']:
                print('   NOTE :', x[:120])


if __name__ == '__main__':
    main()
