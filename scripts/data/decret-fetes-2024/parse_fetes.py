#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Extraction du fac-similé « Le Moniteur, Spécial n° 66-A du mercredi 11 décembre 2024 »
(Décret du 11 décembre 2024 déterminant les Fêtes Légales) → source.json.

Produit un REGISTRE EXHAUSTIF : chacun des paragraphes du .docx est soit versé au corps,
soit écarté AVEC SON MOTIF. Aucun n'est perdu en silence — le script d'import refuse
d'écrire si la somme des deux ne fait pas le compte des paragraphes du fac-similé.

Deux pièges du .docx, déjà payés ailleurs sur ce corpus :
  · <w:tab/> — les tabulations séparent « Article 2.- » de son texte et indentent les
    onze fêtes. Les ignorer collerait les mots (bug commun à tous mes extracteurs docx,
    corrigé sur la loi UCREF) : elles deviennent une espace ;
  · les SIGNATURES sont dans deux TABLEAUX (fonction | nom), pas dans des paragraphes.
    Une extraction qui ne lit que <w:p> perdrait les vingt signataires.

    python3 scripts/data/decret-fetes-2024/parse_fetes.py <chemin du .docx>
"""
import hashlib
import json
import re
import sys
from pathlib import Path
from xml.etree import ElementTree as ET
from zipfile import ZipFile

W = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'

# Paragraphes ÉCARTÉS, par index dans le fac-similé, avec le motif. Le reste est versé.
ECARTES = {
    29: 'titre courant de page (« page 2 ») — artefact de pagination, tombé au milieu des visas',
    59: 'titre courant de page (« page 3 ») — artefact de pagination, tombé au milieu des signatures',
    61: 'titre courant de page (« page 4 ») — artefact de pagination',
}
# Bornes de l'avis d'abonnement des Presses Nationales et de ses deux coupons (inclusives).
AVIS = (62, 102)
AVIS_MOTIF = "avis relatif au tarif de l'abonnement annuel 2025 et ses deux coupons — publicité de l'éditeur, ce n'est pas le décret"
# Ours de l'imprimeur, après l'avis : achevé d'imprimer, ISSN, dépôt légal, adresse, tirage.
OURS = (103, 110)
OURS_MOTIF = "ours des Presses Nationales (achevé d'imprimer, ISSN, dépôt légal, adresse, tirage) — mention d'imprimeur du fascicule, ce n'est pas le décret"


def texte_paragraphe(p):
    """Texte d'un <w:p>, tabulations et sauts de ligne rendus (et non avalés)."""
    bouts = []
    for n in p.iter():
        if n.tag == W + 't':
            bouts.append(n.text or '')
        elif n.tag == W + 'tab':
            bouts.append(' ')
        elif n.tag == W + 'br':
            bouts.append(' ')
    return ''.join(bouts)


def normaliser(s: str) -> str:
    """Espace insécable → espace, suites d'espaces → une seule, marges retirées.

    Le corpus n'emploie aucune espace insécable (mesuré : 0 sur le décret IMF, la loi
    UCREF, l'arrêté PDP, la Constitution) ; l'espace fine avant « ; » y est une espace
    ordinaire. On s'aligne, sans toucher aux apostrophes courbes du Journal officiel.
    """
    return re.sub(r'[ \t  ]+', ' ', s.replace(' ', ' ')).strip()


def main() -> int:
    if len(sys.argv) < 2:
        print(__doc__)
        return 2
    chemin = Path(sys.argv[1])
    brut = chemin.read_bytes()
    with ZipFile(chemin) as z:
        racine = ET.fromstring(z.read('word/document.xml'))
    corps_xml = racine.find(W + 'body')

    blocs = []  # (index, kind, texte)
    i = 0
    for enfant in corps_xml:
        if enfant.tag == W + 'p':
            blocs.append((i, 'p', normaliser(texte_paragraphe(enfant))))
            i += 1
        elif enfant.tag == W + 'tbl':
            lignes = []
            for tr in enfant.findall(W + 'tr'):
                cellules = [
                    normaliser(' '.join(texte_paragraphe(p) for p in tc.findall(W + 'p')))
                    for tc in tr.findall(W + 'tc')
                ]
                # « Le Ministre de X » + « NOM » → une ligne, comme l'arrêté du 30 avril 2018.
                lignes.append(normaliser(' '.join(c for c in cellules if c)))
            blocs.append((i, 'tbl', '\n'.join(lignes)))
            i += 1

    corps, ecartes, signatures = [], [], []
    for idx, kind, texte in blocs:
        motif = ECARTES.get(idx)
        if motif is None and AVIS[0] <= idx <= AVIS[1]:
            motif = AVIS_MOTIF
        if motif is None and OURS[0] <= idx <= OURS[1]:
            motif = OURS_MOTIF
        if motif is None and not texte:
            motif = 'paragraphe vide'
        if motif is not None:
            ecartes.append({'i': idx, 'kind': kind, 'motif': motif, 'texte': texte[:160]})
            continue
        lignes = texte.split('\n')
        corps.extend(lignes)
        if kind == 'tbl':
            signatures.extend(lignes)

    # Les onze fêtes, telles qu'IMPRIMÉES : « 1°) le Lundi Gras, à partir de midi ; »
    fetes = []
    for ligne in corps:
        m = re.match(r'^(\d{1,2})°\)\s*(.+?)\s*(?:;\s*et|;|\.)$', ligne)
        if m:
            fetes.append({'rang': int(m.group(1)), 'ligne': ligne, 'designation': m.group(2)})

    sortie = {
        'facsimile': {
            'fichier': chemin.name,
            'sha256': hashlib.sha256(brut).hexdigest(),
            'octets': len(brut),
            'blocs': len(blocs),
            # Un tableau vaut UN bloc du fac-similé mais plusieurs lignes de corps :
            # sans ce compte, le registre du script d'import ne tomberait jamais juste.
            'tableaux': sum(1 for _, k, _ in blocs if k == 'tbl'),
        },
        'corps': corps,
        'ecartes': ecartes,
        'signatures': signatures,
        'fetes': fetes,
    }
    dest = Path(__file__).with_name('source.json')
    dest.write_text(json.dumps(sortie, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    print(f'{dest} — {len(blocs)} blocs : {len(corps)} lignes versées, {len(ecartes)} écartés, '
          f'{len(fetes)} fêtes, {len(signatures)} signatures')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
