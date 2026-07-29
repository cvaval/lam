#!/usr/bin/env python3
"""
Parseur du DÉCRET DU 9 AVRIL 2020 SUR LE BAIL À USAGE PROFESSIONNEL
(Le Moniteur, 175e Année, Spécial N° 4, lundi 11 mai 2020, pp. 1-8).

Produit  bodyOriginal.txt  +  annotations.json  dans ce dossier.

Le décret compte 11 articles propres et INSÈRE 33 articles au Code de commerce
(1721-1 → 1729-3), plus une renumérotation (art. 111 → 1710-1, libellé inchangé).

Choix éditoriaux — tous vérifiables sur le J.O. :
  · Les articles insérés sont cités entre guillemets dans le décret ; on retire le
    guillemet ouvrant de tête et le fermant de queue pour que
    `articleAnchorFromHeading` reconnaisse la tête d'article (regex ancrée en ^).
    Le précédent est le décret sûretés (« Article 1774-1.- » → `Article 1774-1.- `).
  · Les 9 sections du chapitre II ne sont pas des lignes de titre au J.O. : elles sont
    NOMMÉES par les articles 2 à 10 (« La section N ... est intitulée : « X » »). On les
    promeut en en-têtes, avec l'intitulé EXACT du décret — c'est ce que fait déjà le
    sommaire de la cliente.
  · L'article 1710-1 n'a PAS de texte ici : le décret dit seulement qu'il reprend
    l'article 111 « dont le libellé demeure inchangé ». Son texte est porté au Code de
    commerce par l'overlay (_apply-decret-bail-pro-ccom.ts), pas inventé ici.

    python3 scripts/data/decret-bail-pro-2020/parse_dbp.py
"""
import html
import json
import os
import re
import zipfile

SRC = os.path.expanduser('~/Downloads')
DIR = os.path.dirname(os.path.abspath(__file__))
DECRET = f'{SRC}/Decret_Bail_a_Usage_Professionnel_9_avril_2020.docx'
SOMMAIRE = f'{SRC}/Sommaire_Decret_Bail_a_Usage_Professionnel.docx'
INDEX = f'{SRC}/Index_Decret_Bail_a_Usage_Professionnel.docx'


def paragraphs(path):
    """Paragraphes non vides. Les tabulations deviennent \\t (séparateur de l'index)."""
    x = zipfile.ZipFile(path).read('word/document.xml').decode('utf8')
    x = re.sub(r'<w:tab/>', '\t', x)
    x = re.sub(r'</w:p>', '\n', x)
    x = re.sub(r'<[^>]+>', '', x)
    return [p.strip() for p in html.unescape(x).split('\n') if p.strip()]


# ── Corps ────────────────────────────────────────────────────────────────────
ART_DECRET = re.compile(r'^Article\s+(\d+)(?:er)?\.-')
ART_INSERE = re.compile(r'^«?\s*Article\s+(17\d\d-\d+)\.-')
INTITULE = re.compile(r'est intitulée\s*:\s*«\s*([^»]+?)\s*»')


def build_body():
    ps = paragraphs(DECRET)
    # 0-2 = page de garde (« DÉCRET », titre, « NUMÉRO SPÉCIAL ») — écartée, comme
    # pour le décret sûretés dont le corps ouvre sur « LIBERTÉ ÉGALITÉ FRATERNITÉ ».
    assert ps[3].startswith('LIBERTÉ'), f'garde inattendue : {ps[:4]}'
    ps = ps[3:]

    out, toc, labels = [], [], {}
    sec = 0

    def section(label):
        nonlocal sec
        sec += 1
        out.append(label)
        toc.append({'level': 1, 'label': label, 'anchor': f'sec-{sec}', 'kind': 'code'})

    for raw in ps:
        # Les articles cités portent un guillemet ouvrant en tête de CHAQUE alinéa (usage
        # français de la citation longue) : il n'appartient pas au texte normatif et
        # empêcherait de reconnaître les têtes d'article. Retiré partout — aucun alinéa de
        # ce décret ne s'ouvre légitimement par « (les citations internes sont en milieu de
        # ligne : « Louage des choses », « Champ d'application »…).
        p = re.sub(r'^«\s*', '', raw)

        if p == 'DÉCRÈTE':
            section('DÉCRÈTE')
            continue

        m = ART_DECRET.match(p)
        if m:
            n = int(m.group(1))
            # Articles 2 à 10 : chacun crée une section du chapitre II — on promeut
            # l'intitulé (mot pour mot celui du décret) en en-tête AVANT l'article.
            t = INTITULE.search(p)
            if 2 <= n <= 10 and t:
                section(f'SECTION {n - 1} — {t.group(1).upper()}')
            elif n == 11:
                section('DISPOSITIONS FINALES DU DÉCRET')
            out.append(p)
            labels[f'art-{n}'] = 'Article 1er' if n == 1 else f'Article {n}'
            continue

        mi = ART_INSERE.match(p)
        if mi:
            out.append(p.rstrip(' »'))
            labels[f'art-{mi.group(1)}'] = f'Article {mi.group(1)}'
            continue

        # Guillemet FERMANT de fin de citation — retiré seulement s'il ne ferme pas une
        # citation interne à la ligne (« … » au milieu d'un article du décret).
        out.append(p.rstrip(' »') if p.endswith('»') and '«' not in p else p)

    # Les tabulations Word (« 1)<tab>Locaux… ») n'ont pas de sens dans le texte stocké :
    # ramenées à une espace. Conservées en revanche pour l'index, où elles séparent le
    # sujet de ses renvois.
    body = '\n'.join(out) + '\n'
    body = re.sub(r'[ \t]+', ' ', body)
    return body, toc, labels


# ── Sommaire client → navToc ─────────────────────────────────────────────────
SOM_DEC = re.compile(r'^Article\s+(\d+)(?:er)?\s*—\s*(.+?)\s*\d*$')
SOM_INS = re.compile(r'^Art\.\s*(17\d\d-\d+)\.\s*—\s*(.+?)[\s\d–-]*$')


def build_navtoc(toc):
    """Sommaire de la cliente : articles du décret en groupes, articles insérés en enfants."""
    by_anchor = {t['label']: t['anchor'] for t in toc}
    sec_of = {}  # n° d'article du décret → ancre de section
    for t in toc:
        m = re.match(r'^SECTION (\d+) —', t['label'])
        if m:
            sec_of[int(m.group(1)) + 1] = t['anchor']

    groups, cur = [], None
    for p in paragraphs(SOMMAIRE):
        md = SOM_DEC.match(p)
        if md:
            n = int(md.group(1))
            anchor = sec_of.get(n) or by_anchor.get('DÉCRÈTE' if n == 1 else 'DISPOSITIONS FINALES DU DÉCRET') or f'art-{n}'
            label = f"Article {'1er' if n == 1 else n} — {md.group(2).rstrip('0123456789 ')}"
            cur = {'label': label, 'anchor': anchor, 'children': []}
            groups.append(cur)
            continue
        mi = SOM_INS.match(p)
        if mi and cur is not None:
            cur['children'].append({'label': f'Art. {mi.group(1)} — {mi.group(2)}', 'anchor': f'art-{mi.group(1)}'})
    return [{'label': 'Décret sur le Bail à Usage Professionnel', 'anchor': 'sec-1', 'children': groups}]


# ── Index client → indexEntries ──────────────────────────────────────────────
REF_INS = re.compile(r'\b(17\d\d-\d+)\b')
REF_DEC = re.compile(r'Décret,\s*art\.\s*(\d+)')


def build_index(valid):
    entries, parent = [], None
    for p in paragraphs(INDEX):
        if len(p) <= 2 and p.isalpha():           # lettre de section (A, B, C…)
            continue
        if p.startswith('INDEX') or p.startswith('Décret du') or p.startswith('(Le Moniteur') or p.startswith('Nota.'):
            continue
        head, _, refs = p.partition('\t')
        head = head.strip()
        if not refs:                               # « Sujet : » → parent d'un groupe
            parent = head.rstrip(' :') if head.endswith(':') else None
            if parent is None and head:
                parent = None
            continue
        sub = head.lstrip('—– ').strip()
        subject = f'{parent} — {sub}' if parent and head.startswith(('—', '–')) else sub
        ct = [r for r in REF_INS.findall(refs) if f'art-{r}' in valid]
        ct += [r for r in REF_DEC.findall(refs) if f'art-{r}' in valid]
        if not ct:
            continue
        seen, uniq = set(), []
        for r in ct:
            if r not in seen:
                seen.add(r)
                uniq.append(r)
        entries.append({'subject': subject, 'ctRefs': uniq})
    return entries


def main():
    body, toc, labels = build_body()
    navToc = build_navtoc(toc)
    idx = build_index(set(labels))

    ann = {
        'title': 'Décret sur le Bail à Usage Professionnel',
        'annotationAuthor': '',
        'navToc': navToc,
        'toc': toc,
        'connexes': [],
        'jurisprudence': {},
        'indexEntries': idx,
        'labels': labels,
    }
    open(f'{DIR}/bodyOriginal.txt', 'w').write(body)
    json.dump(ann, open(f'{DIR}/annotations.json', 'w'), ensure_ascii=False, indent=1)

    inseres = [k for k in labels if re.match(r'^art-17\d\d-', k)]
    print(f'corps        : {len(body)} caractères, {len(body.splitlines())} lignes')
    print(f'sections     : {len(toc)}  → {[t["label"][:38] for t in toc]}')
    print(f'articles     : {len(labels)}  (décret {len(labels) - len(inseres)} · insérés {len(inseres)})')
    print(f'navToc       : {len(navToc[0]["children"])} groupes, '
          f'{sum(len(g["children"]) for g in navToc[0]["children"])} enfants')
    print(f'index        : {len(idx)} entrées')


if __name__ == '__main__':
    main()
