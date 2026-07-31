#!/usr/bin/env python3
"""
Découpe NOTARIAT_compilation_revue.docx en TEXTES DISTINCTS.

La compilation réunit neuf blocs ; deux sont écartés et signalés :
  · le DÉCRET-LOI DU 27 NOVEMBRE 1969 — DOUBLON de la transcription autonome déjà traitée
    (scripts/data/notariat-1969/) ; sa transcription est ici de moindre qualité ;
  · la LOI DU 1er SEPTEMBRE 1951 SUR L'EXPROPRIATION — HORS SUJET (ni notariat, ni
    modificative), et réduite à son préambule.
La LOI DU 6 AVRIL 1880 sur les officiers de l'état civil n'a QUE son titre : rien à publier.

Produit textes.json : {slug: {titre, date, articles: [{num, text}], corps}}.
    python3 scripts/data/notariat-compilation/extract_compilation.py
"""
import html
import json
import os
import re
import zipfile

SRC = os.path.expanduser('~/Downloads/NOTARIAT_compilation_revue.docx')
DIR = os.path.dirname(os.path.abspath(__file__))

# (slug, titre officiel, borne début, borne fin exclue, date, nb d'articles attendu)
TEXTES = [
    ('arrete-1919-examen',
     'Arrêté réglementant les détails de l’examen en Notariat et fixant le mode de versement '
     'et d’affectation du cautionnement',
     1, 25, '1919', 14),
    ('loi-1919-notariat',
     'Loi du 24 février 1919 sur le Notariat',
     25, 96, '1919-02-24', 46),
    ('loi-1862-notariat',
     'Loi du 21 août 1862 sur le Notariat',
     96, 108, '1862-08-21', 11),
    ('loi-1877-modificative',
     'Loi du 8 août 1877 modificative sur le Notariat',
     108, 113, '1877-08-08', 2),
    ('decret-loi-1941-etude-vacante',
     'Décret-loi du 20 juin 1941 sur le notaire dont l’étude est devenue vacante',
     114, 121, '1941-06-20', 2),
    # ⚠️ 224–226 et non 224–228 : les paragraphes 227 et 228 sont l'« Annexe » de la
    # compilation (notice sur l'histoire législative) et deux notes de jurisprudence. Ils
    # étaient absorbés par la clôture du décret, qui atteignait 3 147 caractères.
    ('decret-1974-nombre-notaires',
     'Décret du 30 septembre 1974 augmentant le nombre des notaires',
     224, 227, '1974-09-30', 2),
    ('decret-1986-nombre-notaires',
     'Décret du 9 juillet 1986 du Conseil National de Gouvernement fixant le nombre des notaires',
     233, 242, '1986-07-09', 2),
]

ECARTES = [
    ('DÉCRET-LOI DU 27 NOVEMBRE 1969', 121, 224,
     'DOUBLON — transcription autonome déjà traitée (scripts/data/notariat-1969/)'),
    ('LOI DU 6 AVRIL 1880 sur les officiers de l’état civil', 113, 114,
     'TITRE SEUL — aucun corps dans la compilation'),
    ('LOI DU 1er SEPTEMBRE 1951 sur l’expropriation', 229, 233,
     'HORS SUJET — étrangère au notariat, réduite à son préambule'),
]

# Coquilles sûres, propres à cette transcription (elle est plus abîmée que l'autre).
COQUILLES = [
    (r'\bJjustice\b', 'Justice'), (r'\biiotaires\b', 'notaires'), (r'\bnotaiiat\b', 'notariat'),
    (r'\bppur\b', 'pour'), (r'\binterdissant\b', 'interdisant'), (r'\bPublies\b', 'Publics'),
    (r'\bRFPUBLIQUE\b', 'RÉPUBLIQUE'), (r'\bPRESIDÉNT\b', 'PRÉSIDENT'), (r'\bNANPHY\b', 'NAMPHY'),
    (r'\bLicutenant\b', 'Lieutenant'), (r'\bJaeques\b', 'Jacques'), (r'\bFranQois\b', 'François'),
    (r'\bWilliarns\b', 'Williams'), (r'\bd\'offlce\b', 'd’office'), (r'\bdécés\b', 'décès'),
    (r'\bétre\b', 'être'), (r'\ban\. 32\b', 'art. 32'), (r'\bMAGLOIPE\b', 'MAGLOIRE'),
    (r'\barücle\b', 'article'), (r'\bConstiotution\b', 'Constitution'), (r'\bdérnontré\b', 'démontré'),
    (r'\bMiragoàne\b', 'Miragoâne'), (r'\bGoàve\b', 'Goâve'), (r'\bRiviére\b', 'Rivière'),
    (r'\bprofes:\s*sion\b', 'profession'), (r'\bTa Secrétairerie\b', 'La Secrétairerie'),
    # Décret du 9 juillet 1986 — la transcription en est particulièrement abîmée.
    (r'\bPrésiden\.', 'Président.'), (r'NATIONAL[\'’]DE', 'NATIONAL DE'),
    (r'CONSEIL NATION DE GOUVERNEMENT', 'CONSEIL NATIONAL DE GOUVERNEMENT'),
    (r'Port-auPrince', 'Port-au-Prince'), (r'An 183"-e de Indépendance', 'An 183e de l’Indépendance'),
    (r'\bqu8e\b', 'que'), (r'\beroissance\b', 'croissance'), (r'\bderníéres\b', 'dernières'),
    (r'\baugementation\b', 'augmentation'), (r'\bNotaríat\b', 'Notariat'),
    (r'\bMinistére\b', 'Ministère'), (r'\baprés\b', 'après'), (r'\bannonqant\b', 'annonçant'),
    (r'\bcornposition\b', 'composition'), (r'élargir [\'’]effectif', 'élargir l’effectif'),
    (r'l[\'’]exode vers la capital\b', 'l’exode vers la capitale'),
    (r'\bDelmas: Delmas:', 'Delmas:'), (r'\bGonaives\b', 'Gonaïves'), (r'\bLéogane\b', 'Léogâne'),
    (r'Et de [\'’]avis', 'Et de l’avis'),
]


def paragraphes():
    x = zipfile.ZipFile(SRC).read('word/document.xml').decode('utf8')
    x = re.sub(r'<w:tab/>', ' ', x)
    x = re.sub(r'</w:p>', '\n', x)
    x = re.sub(r'<[^>]+>', '', x)
    return [re.sub(r'[ \t]+', ' ', p.strip()) for p in html.unescape(x).split('\n') if p.strip()]


# Formule de clôture : promulgation, contreseings, signatures. Elle SUIT le dernier article
# et n'en fait pas partie — absorbée, elle gonflait l'article 46 de la loi de 1919 à
# 9 530 caractères.
CLOTURE = re.compile(
    r'(Donné (?:au Palais|à la Chambre|au Sénat)|Au Nom de la République|'
    r'Par le Président\s*:|PAR LE CONSEIL|Le Président de la République ordonne|'
    r'Donnée (?:au Palais|à la Chambre|au Sénat))')


# Articulations de la formule de clôture : la compilation la donne d'un seul tenant
# (9 309 caractères pour la loi de 1919, promulgation, contreseings et notes confondus).
# On coupe AVANT chacun de ces marqueurs — aucun mot n'est ajouté ni retiré.
ARTICULATIONS = re.compile(
    r'(?=Donné (?:au Palais|à la Chambre|au Sénat)|Donnée (?:au Palais|à la Chambre|au Sénat)|'
    r'Au Nom de la République|Le Président de la République ordonne|Par le Président\s*:|'
    r'PAR LE CONSEIL|Le Président\b|Les Secrétaires\b|\(\d+\)\s+[A-ZÉÈÀ])')


# Le matériel ANNEXÉ (dépêche de 1819, tarif des actes, droits d'enregistrement) est donné
# d'un seul tenant par la compilation. Il porte sa propre numérotation en degré (« 33º ») et
# des intitulés en capitales : on coupe dessus. Le lecteur rend ensuite ces numéros en liste.
ITEMS = re.compile(r'(?=\d{1,2}\s*[ºo°]\s|DROITS\s+D|TARIF\b|DEPECHE\b|DÉPÊCHE\b)')
LONG = 1500

# ── En-tête : visas et considérants ───────────────────────────────────────────
# La compilation les donne d'un seul tenant — 1 202 caractères pour le décret de 1986, où
# se suivent six « Vu », trois « Considérant » et la formule d'adoption. Le lecteur y voyait
# un pavé. On coupe AVANT chaque articulation : aucun mot n'est ajouté ni retiré.
VISAS = re.compile(r'(?=\bVu\s+(?:la|le|les|l’)|\bConsidérant\s+(?:que|qu’)|'
                   r'\bSur le rapport\b|\bEt (?:de l’avis|après délibération)\b|'
                   r'\bD[ÉE]CR[ÈE]TE\b|\bARR[ÊE]TE\b)')

# ── Énumérations d'un article ─────────────────────────────────────────────────
# Les deux décrets sur le NOMBRE DES NOTAIRES fixent un effectif par commune, en liste. La
# compilation la donne en un seul paragraphe : « Port-au-Prince: 22 notaires Delmas: 5
# notaires Pétion-Ville: 5 notaires… ». On ne coupe que dans un article qui s'annonce comme
# une liste (« fixé ainsi qu'il suit », « fixé comme suit ») — ailleurs, le point-virgule
# sépare des membres de phrase, non des items.
ANNONCE_LISTE = re.compile(r'fix[ée]\s+(?:ainsi qu’il suit|comme suit)\s*:', re.I)
ITEM_NOTAIRES = re.compile(r'(?<=[Nn]otaires)\s+(?=[A-ZÉÀ])|(?<=;)\s+(?=\d+\s+[Nn]otaires)')


# ── Signatures et contreseings ────────────────────────────────────────────────
# « Donné au Palais National… Henri NAMPHY Lieutenant-Général, FAD'H., Président Williams
# REGALA, Colonel FAD'H., Membre Me. Jacques A. FRANÇOIS, Membre » : trois signataires en un
# paragraphe. On coupe devant un nom (prénom capitalisé + PATRONYME en capitales) lorsqu'il
# suit une ponctuation ou l'une des qualités qui closent la signature précédente.
# ⚠️ La négative sur « Me. » est indispensable : son point est une ponctuation, et sans elle
# la civilité se détache du nom qu'elle introduit.
NOM = r'(?:Me\.\s+)?[A-ZÉÈ][a-zà-ÿ]+(?:\s+[A-Z]\.)?\s+[A-ZÉÈÀÇ]{4,}'
SIGNATURES = re.compile(rf'(?<=[.:])(?<!Me\.)\s+(?={NOM})|(?<=Président)\s+(?={NOM})'
                        rf'|(?<=Membre)\s+(?={NOM})|\s+(?=Le Ministre\b)|\s+(?=Le Secr[ée]taire\b)')


def ventiler_entete(bloc):
    """Visas, considérants et formule d'adoption, un par ligne."""
    out = []
    for x in VISAS.split(bloc):
        x = x.strip()
        if x:
            out.extend(y.strip() for y in SIGNATURES.split(x) if y.strip())
    return out


def ventiler_article(texte):
    """Article portant une énumération → chapeau puis un item par ligne."""
    if not ANNONCE_LISTE.search(texte) or len(texte) < 200:
        return texte
    m = ANNONCE_LISTE.search(texte)
    chapeau, liste = texte[: m.end()].strip(), texte[m.end():].strip()
    items = [x.strip(' ;') for x in ITEM_NOTAIRES.split(liste) if x.strip(' ;')]
    return chapeau + '\n' + '\n'.join(items) if items else texte


def ventiler(bloc):
    """Coupe un bloc de clôture à ses articulations ; renvoie une liste de lignes."""
    out = []
    for x in ARTICULATIONS.split(bloc):
        x = x.strip()
        if not x:
            continue
        if len(x) > LONG:
            out.extend(y.strip() for y in ITEMS.split(x) if y.strip())
        else:
            out.extend(y.strip() for y in SIGNATURES.split(x) if y.strip())
    return out


# Matière ÉTRANGÈRE au texte porteur, que la compilation enchaîne sans le moindre blanc :
# la clôture du décret de 1974 était suivie, dans le même paragraphe, d'un avis sur la loi
# du 21 août 1975. La clôture s'arrête là.
HORS_TEXTE = re.compile(r'\s*Décret du 21 Août 1975 autorisant\b.*$', re.S)


def detacher_cloture(arts):
    """Sort la formule de clôture du DERNIER article. Renvoie (articles, lignes de clôture)."""
    if not arts:
        return arts, []
    dernier = arts[-1]
    dernier['text'] = HORS_TEXTE.sub('', dernier['text'])
    m = CLOTURE.search(dernier['text'])
    if not m or m.start() == 0:
        return arts, []
    reste = dernier['text'][m.start():]
    dernier['text'] = dernier['text'][: m.start()].strip()
    lignes = []
    for x in reste.split('\n'):
        lignes.extend(ventiler(x))
    return arts, lignes


def corriger(s):
    for rx, rep in COQUILLES:
        s = re.sub(rx, rep, s)
    # Apostrophe typographique UNIQUE : l'OCR mêle « ' » et « ’ », et la table ci-dessus
    # introduisait elle-même l'incohérence (« d'apposer d’office »).
    return s.replace("'", '\u2019')


def main():
    ps = [corriger(p) for p in paragraphes()]
    sortie = {}
    print(f'{"texte":34} {"¶":>9}  articles')
    for slug, titre, a, b, date, attendu in TEXTES:
        seg = ps[a:b]
        # Découpe en articles : une tête peut être incrustée en milieu de paragraphe.
        joint = '\n'.join(seg)
        # « Art 37- » : la forme ABRÉGÉE existe aussi (articles 37 et 38 de la loi de 1919).
        # Ne la pas admettre faisait perdre ces deux articles ET tous les suivants, le garde
        # séquentiel s'arrêtant au premier trou.
        # ⚠️ La ponctuation de tête est double dans cette transcription : « Article 1. — Le
        # Décret… ». Ne consommer que le point laissait le tiret en tête du texte, et le
        # gabarit d'écriture le redoublait : « Article 1. — — Le Décret… ».
        reperes = [(int(m.group(1)), m.start(), m.end())
                   for m in re.finditer(r'(?<!l’)(?<!l\')(?<!du )(?<!L\')Art(?:icle)?\.?\s*(\d{1,3})\s*[.\s—\-]*', joint)]
        # Ne garder que la SÉQUENCE croissante depuis 1 (les « Article 32 » cités par un
        # texte modificatif ne sont pas des articles du texte porteur).
        garde, attendu_n = [], 1
        for n, s0, e0 in reperes:
            if n == attendu_n:
                garde.append((n, s0, e0))
                attendu_n += 1
        arts = []
        for i, (n, _, e0) in enumerate(garde):
            fin = garde[i + 1][1] if i + 1 < len(garde) else len(joint)
            arts.append({'num': str(n), 'text': re.sub(r'\s+', ' ', joint[e0:fin]).strip()})
        arts, cloture = detacher_cloture(arts)
        for art in arts:
            art['text'] = ventiler_article(art['text'])
        entete = joint[: garde[0][1]].strip() if garde else joint
        corps = '\n'.join(ventiler_entete(entete))
        corps += '\n' + '\n'.join(f'Article {a["num"]}. — {a["text"]}' for a in arts)
        if cloture:
            corps += '\n' + '\n'.join(cloture)
        sortie[slug] = {'titre': titre, 'date': date, 'articles': arts, 'corps': corps, 'cloture': cloture}
        drapeau = '✓' if len(arts) == attendu else f'⚠ attendu {attendu}'
        print(f'{slug:34} ¶{a:>3}–{b - 1:<4} {len(arts):3}  {drapeau}')

    json.dump(sortie, open(f'{DIR}/textes.json', 'w'), ensure_ascii=False, indent=1)
    print('\nBlocs ÉCARTÉS (signalés, non versés) :')
    for nom, a, b, motif in ECARTES:
        print(f'  · {nom}  (¶{a}–{b - 1})\n      {motif}')
    print(f'\n→ {DIR}/textes.json')


if __name__ == '__main__':
    main()
