#!/usr/bin/env python3
"""
Parseur du DÉCRET-LOI DU 27 NOVEMBRE 1969 harmonisant les dispositions de la Loi du
24 février 1919 sur le Notariat (Dr. François Duvalier).

Source : ~/Downloads/19691127_L_transcription_corrigee.docx — transcription OCR.

⚠️ L'OCR est DÉGRADÉ. Les 80 articles sont tous présents (vérifié), mais :
  · 8 têtes d'article sont COLLÉES au paragraphe précédent ou précédées d'un parasite
    (« LA Article 32 », « * Article 36 », « | Article 57 », « 'Article 58 ») → 22, 32,
    36, 49, 50, 57, 58, 64 ;
  · des mots sont coupés en fin de ligne par la mise en colonnes (« Hono- / raires ») ;
  · quelques lignes sont du bruit pur (filets de séparation, folios) ;
  · des coquilles subsistent dans le corps (« jes » pour « les », « séra », « dactygraphiés »).

Ce script répare ce qui est MÉCANIQUE et n'invente rien. Les coquilles résiduelles sont
signalées, jamais devinées : elles appellent une relecture sur le Journal Officiel.

Produit bodyOriginal.txt + structure.json dans ce dossier.
    python3 scripts/data/notariat-1969/parse_notariat.py
"""
import html
import json
import os
import re
import zipfile

SRC = os.path.expanduser('~/Downloads/19691127_L_transcription_corrigee.docx')
DIR = os.path.dirname(os.path.abspath(__file__))

# Charpente RÉTABLIE : les en-têtes du J.O. sont trop abîmés pour être détectés par motif
# (« TITRE Il », en-tête fondu dans l'article 50…). Bornes vérifiées contre la position
# réelle des articles — voir le contrôle en fin de script.
CHARPENTE = [
    ('TITRE PREMIER — RÉGIME DU NOTARIAT', 1, None),
    ('Section I — ATTRIBUTIONS ET RÉPARTITION DES NOTAIRES', 2, 1),
    ('Section II — CONDITIONS D’ACCÈS À LA FONCTION DE NOTAIRE', 2, 4),
    ('Section III — EXERCICE DE LA FONCTION DE NOTAIRE', 2, 18),
    ('TITRE II — CONDITIONS ESSENTIELLES À LA VALIDITÉ DES ACTES NOTARIÉS', 1, None),
    ('Section I — ACTES DRESSÉS EN MILIEUX URBAIN ET RURAL', 2, 26),
    ('Section II — DES MINUTES, GROSSES, EXPÉDITIONS ET RÉPERTOIRES', 2, 37),
    ('TITRE III — COMPÉTENCE DU MINISTÈRE PUBLIC RELATIVEMENT À LA DISCIPLINE DES NOTAIRES', 1, 50),
    ('TITRE IV — TARIF RELATIF AUX HONORAIRES DES NOTAIRES ET AU DROIT DE TIMBRE MOBILE SPÉCIAL', 1, 54),
    ('DISPOSITIONS SPÉCIALES', 1, 65),
]

# Lignes de bruit pur (filets, folios) — supprimées.
BRUIT = re.compile(r'^(?:[\s_—\-"°#|\'’‘*.]{4,}|[A-Z]?\s*[-—_]{3,}.*|°\s*-#\s*MONT|A\s+[—"]{5,}.*)$')

# Coquilles OCR sûres : la forme fautive n'existe pas en français et la correction est
# univoque. Toute correction douteuse est LAISSÉE et signalée en fin de script.
COQUILLES = [
    (r'\bjes\b', 'les'), (r'\bséra\b', 'sera'), (r'\bdactygraphiés\b', 'dactylographiés'),
    (r'pré\.,\s*parées', 'préparées'), (r'\bI1\b', 'Il'), (r'\bIi\b', 'Il'),
    (r'\bcongignation\b', 'consignation'), (r'\bäu\b', 'au'), (r'\bQuankile\b', 'Quand le'),
    (r'\bderneurent\b', 'demeurent'), (r'\bporiée\b', 'portée'), (r'\baéceptation\b', 'acceptation'),
    (r'\bHondraires\b', 'Honoraires'), (r'\bsurchargè\b', 'surcharge'), (r'\bcle\b', 'de'),
    (r'\bRepublique\b', 'République'), (r'\bSuspen', 'suspen'), (r'\bSoixante\b', 'soixante'),
    (r'\bS’associer\b', 's’associer'), (r'\bSubi\b', 'subi'), (r'\bdès fonct', 'des fonct'),
    (r'\bÆn\b', 'En'), (r'\[es\b', 'les'), (r'\bj’Étude\b', 'l’Étude'), (r'\bNo-\s*\'faire\b', 'Notaire'),
]


def paragraphes():
    x = zipfile.ZipFile(SRC).read('word/document.xml').decode('utf8')
    x = re.sub(r'<w:tab/>', ' ', x)
    x = re.sub(r'</w:p>', '\n', x)
    x = re.sub(r'<[^>]+>', '', x)
    # Apostrophe typographique unique (l'OCR mêle « ' » et « ’ »).
    return [re.sub(r'[ \t]+', ' ', p.strip()).replace("'", '\u2019')
            for p in html.unescape(x).split('\n') if p.strip()]


def main():
    ps = [p for p in paragraphes() if not BRUIT.match(p)]

    # ── 1. Recoller les mots coupés en fin de ligne (mise en colonnes du J.O.) ──
    recolles = 0
    fusion = []
    for p in ps:
        if fusion and re.search(r'[a-zà-ÿ]-$', fusion[-1]):
            fusion[-1] = fusion[-1][:-1] + p.lstrip()
            recolles += 1
        else:
            fusion.append(p)
    ps = fusion

    # ── 2. Détacher les têtes d'article incrustées — BALAYAGE SÉQUENTIEL GLOBAL ──
    # On cherche le numéro N à partir de la fin du numéro N-1 : une citation
    # (« l'Article 27 du Code Rural », « l'Article 22 du présent Décret ») ne peut donc
    # jamais être prise pour une tête, puisque la vraie tête a déjà été consommée.
    # Un même paragraphe peut porter DEUX têtes (l'article 49 était niché dans le 48) :
    # le balayage global les trouve toutes, là où un découpage paragraphe par paragraphe
    # n'en voyait qu'une.
    texte = '\n'.join(ps)
    reperes, curseur = [], 0
    for n in range(1, 81):
        m = re.compile(rf'(?<!l’)(?<!l\')(?<!du )Article\s+{n}(?:er)?\s*[.—-]+\s*').search(texte, curseur)
        if not m:
            raise SystemExit(f'tête de l’article {n} introuvable après la position {curseur} — annulé')
        reperes.append((n, m.start(), m.end()))
        curseur = m.end()

    # Parasite de FIN de bloc : ce qui précédait la tête suivante (« LA », « * », « | »,
    # « ' »). Le POINT et la VIRGULE en sont exclus : ils terminent légitimement une phrase
    # — les inclure amputait la ponctuation finale de chaque article.
    QUEUE = re.compile(r"(?:\s|^)(?:[_—\-*|'’‘\"«»+#°]+|LA)\s*$")

    def nettoyer_fin(bloc):
        net = bloc.rstrip()
        while True:
            m = QUEUE.search(net)
            if not m or m.start() == 0:
                return net
            net = net[: m.start()].rstrip()

    lignes, detaches = [], 0
    entete = texte[: reperes[0][1]].rstrip()
    if entete:
        lignes.extend(entete.split('\n'))
    for i, (n, _, fin_tete) in enumerate(reperes):
        fin = reperes[i + 1][1] if i + 1 < len(reperes) else len(texte)
        bloc = texte[fin_tete:fin]
        net = nettoyer_fin(bloc)
        if len(bloc.rstrip()) != len(net):
            detaches += 1
        # Le tiret d'introduction « Article 30. — » a pu échapper à la capture de la tête :
        # on l'ôte pour ne pas le doubler avec celui que l'on pose.
        morceaux = (f'Article {n}. — ' + net.lstrip(' \t—-')).split('\n')
        lignes.extend(m for m in (x.strip() for x in morceaux) if m)

    # ── 3. Coquilles sûres ──
    corrigees = 0
    out = []
    for l in lignes:
        avant = l
        for rx, rep in COQUILLES:
            l = re.sub(rx, rep, l)
        if l != avant:
            corrigees += 1
        out.append(l)

    # ── 4. Insérer la charpente devant l'article qui l'ouvre ──
    pos = {}
    for i, l in enumerate(out):
        m = re.match(r'^Article\s+(\d{1,3})\.\s*—', l)
        if m and int(m.group(1)) not in pos:
            pos[int(m.group(1))] = i
    corps, toc, insere = [], [], {}
    for titre, niveau, art in CHARPENTE:
        if art is not None:
            insere.setdefault(pos[art], []).append((titre, niveau))
        else:
            # TITRE sans article propre : rattaché à la 1ʳᵉ section qui suit
            suivant = next(a for t, n, a in CHARPENTE[CHARPENTE.index((titre, niveau, art)) + 1:] if a)
            insere.setdefault(pos[suivant], []).insert(0, (titre, niveau))
    for i, l in enumerate(out):
        for titre, niveau in insere.get(i, []):
            corps.append(titre)
            toc.append({'level': niveau, 'label': titre, 'anchor': f'sec-{len(toc) + 1}',
                        'kind': 'titre' if niveau == 1 else 'section'})
        corps.append(l)

    body = '\n'.join(corps) + '\n'
    labels = {f'art-{n}': ('Article 1er' if n == 1 else f'Article {n}') for n in sorted(pos)}
    struct = {'title': 'Décret-loi du 27 novembre 1969 sur le Notariat',
              'toc': toc, 'labels': labels}
    open(f'{DIR}/bodyOriginal.txt', 'w').write(body)
    json.dump(struct, open(f'{DIR}/structure.json', 'w'), ensure_ascii=False, indent=1)

    # ── Contrôles ──
    trouves = sorted(int(m.group(1)) for m in re.finditer(r'^Article\s+(\d{1,3})\.\s*—', body, re.M))
    manquants = sorted(set(range(1, 81)) - set(trouves))
    print(f'lignes recollées (mots coupés)   : {recolles}')
    print(f'têtes d’article détachées        : {detaches}')
    print(f'lignes à coquilles corrigées     : {corrigees}')
    print(f'en-têtes de charpente insérés    : {len(toc)}')
    print(f'articles                         : {len(trouves)}/80'
          + (f'  ⚠ manquants {manquants}' if manquants else '  ✓'))
    doublons = [n for n in set(trouves) if trouves.count(n) > 1]
    print(f'doublons de numéro               : {doublons or "0 ✓"}')
    # Coquilles résiduelles probables : signalées, JAMAIS corrigées d'office.
    # Motifs qui ne se rencontrent pas dans un texte français propre.
    SUSPECT = re.compile(
        r'[a-zà-öø-ÿ][A-ZÀ-ÖØ-Þ][a-zà-öø-ÿ]'  # majuscule au milieu d'un mot : « aéceptation »
        # (plage explicite : « À-Ÿ » engloberait les MINUSCULES accentuées — « Président » signalé à tort)
        r'|[A-Za-zÀ-ÿ]\d|\d[A-Za-zÀ-ÿ]{2,}'  # chiffre soudé à des lettres : « 5-00 », « 1o »
        r'|\|'                              # barre verticale (colonne mal lue)
        r'|\w\.{2,}\w'                      # points multiples dans un mot
        r'|\s[‘`]\s?\w'                     # apostrophe ouvrante parasite
        r'|\b[bcdfgjklmnpqrstvwxz]{4,}\b'   # amas de consonnes
    )
    suspects = [l for l in corps if SUSPECT.search(l)]
    print(f'lignes encore suspectes (à relire): {len(suspects)}')
    for l in suspects[:5]:
        print(f'    {l[:118]}')
    print(f'\n→ {DIR}/bodyOriginal.txt · structure.json')


if __name__ == '__main__':
    main()
