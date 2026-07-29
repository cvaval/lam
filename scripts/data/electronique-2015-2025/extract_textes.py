#!/usr/bin/env python3
"""
Extrait les 5 textes du dossier « électronique » et CONSOLIDE la loi de 2017.

  T1  Décret du 9 décembre 2015 sur la signature électronique          17 art.
  T2  Décret du 6 janvier 2016 sur l'administration électronique       51 art.
  T3  Loi du 14 février 2017 sur la signature électronique      17 → 25 art.
  T4  Loi du 14 février 2017 sur les échanges électroniques           18 têtes
  T5  Décret du 20 août 2025 amendant la loi de 2017                    3 art.

⚠️ CONSOLIDATION (T3) : le décret de 2025 AJOUTE 8 articles (1.1, 2.1→2.5, 8.1, 8.2),
en RÉÉCRIT 8 (2, 6, 7, 8, 10, 11, 14, 15) et en ABROGE 1 (16). Le texte consolidé fait
donc 25 articles. Les rédactions de 2017 sont conservées pour l'affichage replié.

Produit textes.json : {slug: {titre, corps, toc, articles, amendements}}.
    python3 scripts/data/electronique-2015-2025/extract_textes.py
"""
import html
import json
import os
import re
import zipfile

SRC = os.path.expanduser('~/Downloads')
DIR = os.path.dirname(os.path.abspath(__file__))

FICHIERS = {
    'decret-2015-signature': 'Decret_signature_electronique_09-12-2015.docx',
    'decret-2016-administration': 'Decret_administration_electronique_06-01-2016.docx',
    'loi-2017-signature': 'Loi_2017_Signature_Electronique.docx',
    'loi-2017-echanges': 'Moniteur_Special_12_2017_Echanges_Electroniques.docx',
    'decret-2025-signature': '01_Decret_20_aout_2025_Signature_Electronique_Moniteur_Special_No_55.docx',
}

# Tête d'article : « Article 1er.- », « Article 12.- », « Article 9-1.- », « Article 2.1.- »
TETE = re.compile(r'^«?\s*Article\s+(\d{1,3}(?:er)?(?:[.\-]\d{1,2})?)\s*\.-\s*(.*)$')
ENTETE = re.compile(r'^(CHAPITRE|TITRE|Section)\b', re.I)
# Bruit de bandeau / colophon du Moniteur, hors dispositif.
BRUIT = re.compile(r'^(LE MONITEUR|JOURNAL OFFICIEL|Paraissant|Directeur Général|\d{2,3}e Année|SOMMAIRE|'
                   r'NUMÉRO (SPÉCIAL|ORDINAIRE)|AVIS RELATIF|La Direction Générale|Les numéros spéciaux|'
                   r'Journal Officiel de la République — Abonnement|Hormis les numéros|\[Coupon|Coupon à retourner|'
                   r'Comptant déjà|Ronald Saint Jean|Directeur Général|Achevé d|ISSN|© Tous droits|231-233|B\.P\.|'
                   r'E-mail|Tirage)', re.I)


def paragraphes(nom):
    x = zipfile.ZipFile(f'{SRC}/{nom}').read('word/document.xml').decode('utf8')
    x = re.sub(r'<w:tab/>', ' ', x)
    x = re.sub(r'</w:p>', '\n', x)
    x = re.sub(r'<[^>]+>', '', x)
    return [re.sub(r'[ \t]+', ' ', p.strip()).replace("'", '’')
            for p in html.unescape(x).split('\n') if p.strip()]


# Formule de clôture : promulgation, contreseings, signatures. Elle SUIT le dernier article
# et n'en fait pas partie — absorbée, elle gonflait l'article 46 de la loi de 1919 à
# 9 530 caractères.
CLOTURE = re.compile(
    r'(Donné (?:au Palais|à la Chambre|au Sénat)|Au Nom de la République|'
    r'Par le Président\s*:|PAR LE CONSEIL|Le Président de la République ordonne|'
    r'Donnée (?:au Palais|à la Chambre|au Sénat))')


def detacher_cloture(arts):
    """Sort la formule de clôture du DERNIER article. Renvoie (articles, lignes de clôture)."""
    if not arts:
        return arts, []
    dernier = arts[-1]
    m = CLOTURE.search(dernier['text'])
    if not m or m.start() == 0:
        return arts, []
    reste = dernier['text'][m.start():]
    dernier['text'] = dernier['text'][: m.start()].strip()
    return arts, [x.strip() for x in reste.split('\n') if x.strip()]


# Un alinéa qui CITE un article (« « Article 1102.- … » ») garde son guillemet ouvrant :
# c'est la typographie du J.O., et cela empêche la citation de passer pour une tête
# d'article une fois les alinéas séparés (sans quoi le décret de 2025 comptait 19 articles
# au lieu de 3, et la loi de 2017 en comptait 30 au lieu de 25).
CITATION = re.compile(r'^«\s*Article\s+\d')


def alinea(p):
    return p if CITATION.match(p) else re.sub(r'^«\s*', '', p)


def norm_num(n):
    return n.replace('er', '') if n.endswith('er') else n


def suivant_admis(num, dernier, decimaux=True):
    """Le numéro ouvre-t-il l'article SUIVANT ? Garde anti-citation.

    Un texte cite volontiers les articles qu'il modifie (« « Article 30.- … » » dans
    l'art. 5 de la loi de 2017 ; les articles amendés dans l'art. 2 du décret de 2025).
    Seule la suite attendue est admise : entier +1, ou extension décimale du courant
    (après l'article 9, « 9-1 » est admis ; après « 9-1 », l'article 10 l'est aussi).
    """
    a, _, b = num.replace('-', '.').partition('.')
    n, sub = int(a), int(b) if b else 0
    dn, dsub = dernier
    if sub == 0:
        return n == dn + 1
    # Le décret de 2025 n'a que 3 articles ENTIERS : « 2.1 » y est un article CITÉ de la loi
    # de 2017, non une subdivision du décret.
    return decimaux and n == dn and sub == dsub + 1


def decouper(ps, decimaux=True):
    """→ (entete, toc, articles) ; les articles gardent leur numéro tel qu'imprimé."""
    entete, toc, arts, cur = [], [], [], None
    dernier = (0, 0)
    for p in ps:
        if BRUIT.match(p):
            continue
        if ENTETE.match(p) and len(p) < 90:
            toc.append(p)
            cur = None
            continue
        m = TETE.match(p)
        if m:
            num = norm_num(m.group(1))
            if not suivant_admis(num, dernier, decimaux):
                # citation d'un article étranger : rattachée comme alinéa de l'article courant
                if cur:
                    cur['alineas'].append(alinea(p))
                continue
            a, _, b = num.replace('-', '.').partition('.')
            dernier = (int(a), int(b) if b else 0)
            # « alineas » : un paragraphe du .docx = un alinéa. Les recoller en une seule
            # ligne rendait l'article illisible (l'art. 11 de la loi de 2017 faisait
            # 4 131 caractères d'un bloc).
            cur = {'num': num, 'alineas': [m.group(2).strip()] if m.group(2).strip() else []}
            arts.append(cur)
            continue
        if cur:
            cur['alineas'].append(alinea(p))
        elif not arts:
            entete.append(p)
    for a in arts:
        a['alineas'] = [re.sub(r'\s+', ' ', x).strip().rstrip(' »') for x in a['alineas']]
        a['alineas'] = [x for x in a['alineas'] if x]
        a['text'] = '\n'.join(a['alineas'])
    return entete, toc, arts


# ── Consolidation de la loi de 2017 par le décret de 2025 ──
AJOUT = re.compile(r'Il est ajouté un article\s+(\d{1,2}(?:\.\d{1,2})?)\s+qui se lit comme suit\s*:', re.I)
REECR = re.compile(r'L[’\']article\s+(\d{1,2})\s+se lit désormais comme suit\s*:', re.I)
ABROG = re.compile(r'L[’\']article\s+(\d{1,2})\s+est abrogé', re.I)


def amendements_2025(ps):
    """Lit l'article 2 du décret de 2025 → {num: ('nouveau'|'modifié'|'abrogé', texte)}."""
    # Le dispositif court de « Article 2.- » jusqu'à « Article 3.- ».
    i = next(k for k, p in enumerate(ps) if re.match(r'^Article\s+2\s*\.-', p))
    j = next(k for k, p in enumerate(ps) if k > i and re.match(r'^Article\s+3\s*\.-', p))
    zone = ps[i:j]
    out, en_cours = {}, None
    for p in zone:
        for rx, statut in ((AJOUT, 'nouveau'), (REECR, 'modifié')):
            m = rx.search(p)
            if m:
                en_cours = (m.group(1), statut)
                out[en_cours[0]] = [statut, []]
                break
        else:
            m = ABROG.search(p)
            if m:
                out[m.group(1)] = ['abrogé', []]
                en_cours = None
                continue
            if en_cours:
                t = TETE.match(p)
                if t and norm_num(t.group(1)) == en_cours[0]:
                    if t.group(2).strip():
                        out[en_cours[0]][1].append(t.group(2).strip())
                else:
                    out[en_cours[0]][1].append(alinea(p))
    for k in out:
        al = [re.sub(r'\s+', ' ', x).strip().rstrip(' »') for x in out[k][1]]
        out[k][1] = '\n'.join(x for x in al if x)
    return {k: tuple(v) for k, v in out.items()}


def cle(n):
    a, _, b = n.partition('.')
    return (int(a), int(b) if b else 0)


def main():
    sortie = {}
    for slug, nom in FICHIERS.items():
        ps = paragraphes(nom)
        entete, toc, arts = decouper(ps, decimaux=(slug != 'decret-2025-signature'))
        arts, cloture = detacher_cloture(arts)
        sortie[slug] = {'entete': entete, 'toc': toc, 'articles': arts, 'cloture': cloture}
        print(f'{slug:30} {len(arts):3} articles · {len(toc)} en-têtes')

    # ── Loi de 2017 consolidée ──
    am = amendements_2025(paragraphes(FICHIERS['decret-2025-signature']))
    base = {a['num']: a for a in sortie['loi-2017-signature']['articles']}
    manquants = [n for n, (s, t) in am.items() if s != 'abrogé' and not t]
    if manquants:
        raise SystemExit(f'textes amendés vides : {manquants} — annulé')

    consolide, anciennes, statuts = {}, {}, {}
    for n, a in base.items():
        consolide[n] = a['text']
    for n, (statut, texte) in am.items():
        statuts[n] = statut
        if statut == 'modifié':
            anciennes[n] = base[n]['text']
            consolide[n] = texte
        elif statut == 'nouveau':
            consolide[n] = texte
        # abrogé : le texte de 2017 est CONSERVÉ, replié (convention de la plateforme)
        elif statut == 'abrogé':
            anciennes[n] = base[n]['text']

    sortie['loi-2017-signature']['consolide'] = [
        {'num': n, 'text': consolide[n]} for n in sorted(consolide, key=cle)
    ]
    sortie['loi-2017-signature']['anciennes'] = anciennes
    sortie['loi-2017-signature']['statuts'] = statuts

    n_nouv = sum(1 for s in statuts.values() if s == 'nouveau')
    n_mod = sum(1 for s in statuts.values() if s == 'modifié')
    n_abr = sum(1 for s in statuts.values() if s == 'abrogé')
    print(f'\nCONSOLIDATION loi 2017 : {len(base)} → {len(consolide)} articles')
    print(f'  nouveaux {n_nouv} : {sorted((n for n,s in statuts.items() if s=="nouveau"), key=cle)}')
    print(f'  modifiés {n_mod} : {sorted((n for n,s in statuts.items() if s=="modifié"), key=cle)}')
    print(f'  abrogé   {n_abr} : {sorted((n for n,s in statuts.items() if s=="abrogé"), key=cle)}')

    json.dump(sortie, open(f'{DIR}/textes.json', 'w'), ensure_ascii=False, indent=1)
    print(f'\n→ {DIR}/textes.json')


if __name__ == '__main__':
    main()
