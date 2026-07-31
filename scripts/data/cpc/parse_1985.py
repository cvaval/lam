#!/usr/bin/env python3
"""
LE MONITEUR N° 69 DU 30 SEPTEMBRE 1985 — deux textes.

  · ARRÊTÉ du 27 septembre 1985 mettant en vigueur le nouveau tarif judiciaire (I.E) ;
  · LOI du 18 septembre 1985 sur l'Organisation Judiciaire — celle qui a modifié
    l'article 18 du Code de procédure civile. Absente du recueil : document NOUVEAU.

⚠️ LE TARIF SE RECONSTITUE PAR RECOUPEMENT DE DEUX SOURCES INCOMPLÈTES, ET ELLES SE
COMPLÈTENT PRESQUE EXACTEMENT :
    transcription du J.O. (ce fichier)   art. 1–10, 29–48, 64–148   (3 pages absentes)
    recueil du C.P.C. (déjà en ligne)    art. 1–5, 149–168          (1 page absente)
    ────────────────────────────────────────────────────────────────────────────────
    réunion                              art. 1–10, 29–48, 64–168   135 articles
    manquent encore                      art. 11–28 et 49–63        33 articles
La fin de l'arrêté — articles 149 à 168, clause d'exécution — ne se trouve QUE dans le
recueil ; le début et le corps du barème ne se trouvent QUE dans la transcription. On prend
donc la transcription pour 1–148 et le recueil à partir du Titre VI.

Les notes de lacune restent DANS le corps : sans elles, un texte qui saute de l'article 10
au 29 se lit comme une erreur de la plateforme plutôt que comme une page manquante.

⚠️ Trois formes de division coexistent : la désignation seule suivie de sa légende en
capitales (« TITRE I » / « DES TRIBUNAUX DE PAIX »), la forme d'un tenant
(« CHAPITRE PREMIER: DU CORPS JUDICIAIRE »), et la légende SEULE, sans désignation
(« TAXES DES AVOCATS ») — 13 dans le seul tarif.

⚠️ Les sous-articles de la loi sur l'organisation judiciaire sont numérotés de QUATRE façons
dans le même texte : « Article 127-1.- », « Article 127-2 », « Article 127.3 »,
« Article 127.-4 ». Seule la première donne spontanément la bonne ancre ; « 127.-4 » se
rabat sur art-127 et entre en collision avec l'article 127. Tout est ramené à « 127-4 ».
Piège voisin : « Article 93- 1) (C.P.C. 603)- » — ici le « 1) » ouvre une énumération, ce
n'est PAS un sous-article. Un sous-numéro n'est reconnu que collé au numéro et non suivi
d'une parenthèse.

    python3 scripts/data/cpc/parse_1985.py
"""
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from parse_appendice import paragraphes  # noqa: E402

DIR = os.path.dirname(os.path.abspath(__file__))
MONITEUR = 'Le Moniteur, 140ᵉ année n° 69 du lundi 30 septembre 1985'

# Sous-numéro : collé au numéro, jamais suivi d'un chiffre ni d'une parenthèse
# (« Article 93- 1) » est une énumération, pas un sous-article).
ART_TETE = re.compile(r'^Articles?\s+(\d{1,4})\s*(bis|ter)?\s*'
                      r'(?:[.\-]{1,2}(\d{1,2})(?![\d)]))?\s*([.\-]+)?\s*(.*)$', re.I)
DESIGNATION = re.compile(r'^(TITRE|SOUS-TITRE|CHAPITRE|SECTION|SOUS-SECTION)\s+'
                         r'([IVXLC]+|\d+|PREMIER|PREMIÈRE)\b', re.I)
DESIGNATION_SEULE = re.compile(r'^(TITRE|SOUS-TITRE|CHAPITRE|SECTION|SOUS-SECTION)\s+'
                               r'([IVXLC]+|\d+|PREMIER|PREMIÈRE)\s*:?\s*$', re.I)
NIVEAU = {'TITRE': 1, 'SOUS-TITRE': 2, 'CHAPITRE': 2, 'SECTION': 3, 'SOUS-SECTION': 4}
PAGE = re.compile(r'^\[p\. \d+.*\]$')
# Apparat solennel du fascicule : en capitales comme les légendes de division, mais ce ne
# sont pas des divisions — les prendre pour telles fabriquerait de fausses entrées de sommaire.
APPARAT = re.compile(r'^(ARR[ÊE]T[ÉE]|LOI|JEAN[- ]?CLAUDE|PR[ÉE]SIDENT|LE MONITEUR|'
                     r'A PROPOS[ÉE]|AU NOM DE|NAN NON|PREZIDAN|LIBERT[ÉE]|R[ÉE]PUBLIQUE)', re.I)


def est_legende(l):
    """Ligne en capitales servant d'intitulé de division."""
    return 8 < len(l) < 130 and l == l.upper() and not APPARAT.match(l) \
        and not ART_TETE.match(l) and not PAGE.match(l) and not l.startswith('[')


def decouper(ps, debut, fin, sous_articles):
    """(lignes, toc, labels) — corps normalisé d'un texte du fascicule.

    `sous_articles` : le tarif numérote À PLAT, de 1 à 168. Y reconnaître un sous-numéro
    serait une faute de lecture — « Article 102.-1 (C.P.C. 628, 631).- Pour l'extrait… »
    est l'article 102, dont le premier point d'énumération a perdu sa parenthèse : les
    lignes suivantes portent « 2) » et « 3) ». La loi sur l'organisation judiciaire, elle,
    a bien quinze sous-articles (127-1 à 133 bis).
    """
    lignes, toc, labels = [], [], {}
    saut = False
    for k in range(debut, fin):
        if saut:
            saut = False
            continue
        p = ps[k]
        if PAGE.match(p):
            continue  # pagination du fascicule : repère d'édition, pas du texte
        m = ART_TETE.match(p)
        if m and (m.group(3) or m.group(4)):
            num, bis, sous, _punct, reste = m.groups()
            if not sous_articles and sous:
                sous, reste = None, f'{sous} {reste}'.strip()
            ancre = f'art-{num}' + (f'-{sous}' if sous else '') + (f'-{bis.lower()}' if bis else '')
            desig = num + (f'-{sous}' if sous else '') + (f' {bis}' if bis else '')
            lib = 'Article 1er' if desig == '1' else f'Article {desig}'
            if ancre in labels:
                raise SystemExit(f'✗ article {desig} en double (¶{k})')
            labels[ancre] = lib
            lignes.append(f'{lib}.- {reste}'.rstrip())
            continue
        if DESIGNATION_SEULE.match(p):
            legende = ps[k + 1] if k + 1 < fin else ''
            if est_legende(legende):
                p, saut = f'{p.rstrip(" :")} — {legende}', True
            toc.append({'level': NIVEAU[DESIGNATION.match(p).group(1).upper()], 'label': p,
                        'anchor': f'sec-{len(toc) + 1}', 'kind': DESIGNATION.match(p).group(1).lower()})
            lignes.append(p)
            continue
        if DESIGNATION.match(p) and len(p) < 200:
            toc.append({'level': NIVEAU[DESIGNATION.match(p).group(1).upper()], 'label': p,
                        'anchor': f'sec-{len(toc) + 1}', 'kind': DESIGNATION.match(p).group(1).lower()})
            lignes.append(p)
            continue
        if est_legende(p):
            toc.append({'level': 3, 'label': p, 'anchor': f'sec-{len(toc) + 1}', 'kind': 'rubrique'})
            lignes.append(p)
            continue
        lignes.append(p)
    return lignes, toc, labels


def plages(ns):
    ns = sorted(ns)
    out, deb, prev = [], ns[0], ns[0]
    for n in ns[1:]:
        if n == prev + 1:
            prev = n
            continue
        out.append((deb, prev))
        deb = prev = n
    out.append((deb, prev))
    return ', '.join(f'{a}' if a == b else f'{a}–{b}' for a, b in out)


def num(ancre):
    return int(ancre.replace('art-', '').split('-')[0])


def tarif():
    ps = paragraphes('03_Arrete_Tarif_Judiciaire_1985.docx')
    debut = next(i for i, p in enumerate(ps) if p.strip() == 'ARRÊTÉ')
    lignes, toc, labels = decouper(ps, debut, len(ps), sous_articles=False)

    # ── Raccord avec la fin que seul le recueil détient ──
    app = json.load(open(f'{DIR}/appendice.json'))
    ie = next(x for x in app if x['cote'] == 'I.E')
    corps_recueil = ie['corps'].split('\n')
    i = next(k for k, l in enumerate(corps_recueil) if l.startswith('Titre VI'))
    ART_RECUEIL = re.compile(r'^Art\.?\s+(\d{1,4})\s*\.\-\s*(.*)$')
    for l in corps_recueil[i:]:
        m = ART_RECUEIL.match(l)
        if m:
            n = m.group(1)
            if f'art-{n}' in labels:
                raise SystemExit(f'✗ raccord : article {n} déjà présent dans la transcription')
            labels[f'art-{n}'] = f'Article {n}'
            lignes.append(f'Article {n}.- {m.group(2)}'.rstrip())
            continue
        if l.startswith('Titre VI'):
            toc.append({'level': 1, 'label': l, 'anchor': f'sec-{len(toc) + 1}', 'kind': 'titre'})
        lignes.append(l)

    ns = sorted({num(a) for a in labels})
    manquants = [n for n in range(1, max(ns) + 1) if n not in ns]
    return {
        'source': 'CPC_APPENDICE_I_E_1',
        'titre': 'Arrêté présidentiel du 27 sept 1985 mettant en vigueur le nouveau tarif judiciaire.',
        'moniteur': MONITEUR, 'date': '1985-09-27',
        'corps': '\n'.join(lignes).strip(), 'toc': toc, 'labels': labels,
        'plages': plages(ns), 'manquants': plages(manquants) if manquants else '',
    }


def organisation():
    ps = paragraphes('02_Loi_18-09-1985_Organisation_Judiciaire.docx')
    debut = next(i for i, p in enumerate(ps) if p.strip() == 'LOI')
    lignes, toc, labels = decouper(ps, debut, len(ps), sous_articles=True)
    ns = sorted({num(a) for a in labels})
    manquants = [n for n in range(1, max(ns) + 1) if n not in ns]
    return {
        'source': 'LOI_ORGANISATION_JUDICIAIRE_1985',
        'titre': 'Loi du 18 septembre 1985 sur l’Organisation Judiciaire',
        'moniteur': MONITEUR, 'date': '1985-09-18',
        'corps': '\n'.join(lignes).strip(), 'toc': toc, 'labels': labels,
        'plages': plages(ns), 'manquants': plages(manquants) if manquants else '',
    }


def main():
    out = [tarif(), organisation()]
    json.dump(out, open(f'{DIR}/moniteur1985.json', 'w'), ensure_ascii=False, indent=1)
    for d in out:
        sous = sum(1 for a in d['labels'] if a.count('-') > 1)
        print(f'{d["titre"][:62]:64}')
        print(f'   {len(d["labels"]):3} articles ({sous} sous-articles) · {len(d["toc"]):2} divisions')
        print(f'   présents : {d["plages"]}')
        print(f'   manquent : {d["manquants"] or "— série complète"}')
    print(f'\n→ {DIR}/moniteur1985.json')


if __name__ == '__main__':
    main()
