#!/usr/bin/env python3
"""
Fond de rues de la carte judiciaire — tuiles vectorielles des ROUTES d'Haïti (OpenStreetMap),
en un seul fichier PMTiles servi par agora.ht (aucune origine externe).

    python3 scripts/build-routes-haiti.py --pbf /chemin/hors-depot/haiti-and-domrep-latest.osm.pbf

Source : extrait Geofabrik « Haiti and Dominican Republic »
(https://download.geofabrik.de/central-america/haiti-and-domrep-latest.osm.pbf), téléchargé
HORS du dépôt ; sa date et son SHA-256 sont consignés dans public/maps/hti/routes-metadata.json.
Licence ODbL : « © contributeurs OpenStreetMap » obligatoire partout où la carte s'affiche.

Pourquoi les routes SEULES : limites, communes et marqueurs existent déjà ; un fond OSM complet
(bâtiments, occupation du sol) pèserait des centaines de Mo pour Haïti, très cartographiée en
bâtiments depuis 2010.

Étapes :
  1. ne garder que les voies (`osmium tags-filter … w/highway`) ;
  2. découper sur HAÏTI SEULE — union des départements COD-AB (la République dominicaine sort) ;
  3. ne garder que `name`, `ref` et une CLASSE dérivée de `highway` (majeure, secondaire, locale,
     service) ; les voies `service` et `track` sans nom sont écartées ;
  4. tuiler (`tippecanoe`) en PMTiles, zooms 11 à 15 ; `locale` et `service` à partir du zoom 13.

Outils : osmium-tool, tippecanoe (Homebrew) ; shapely (Python).
"""
import argparse
import hashlib
import json
import os
import shutil
import subprocess
import sys
import tempfile
from datetime import datetime, timezone

from shapely.geometry import mapping, shape
from shapely.ops import unary_union

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEPARTEMENTS = os.path.join(RACINE, 'public/maps/hti/hti-adm1-departments.geojson')
SORTIE = os.path.join(RACINE, 'public/maps/hti/routes-hti.pmtiles')
METADONNEES = os.path.join(RACINE, 'public/maps/hti/routes-metadata.json')
SOURCE_URL = 'https://download.geofabrik.de/central-america/haiti-and-domrep-latest.osm.pbf'

# Budget de taille du fichier versionné (voir docs/carte-judiciaire.md).
BUDGET_OCTETS = 15 * 1024 * 1024

CLASSES = {
    'motorway': 'majeure', 'trunk': 'majeure', 'primary': 'majeure',
    'motorway_link': 'majeure', 'trunk_link': 'majeure', 'primary_link': 'majeure',
    'secondary': 'secondaire', 'tertiary': 'secondaire',
    'secondary_link': 'secondaire', 'tertiary_link': 'secondaire',
    'residential': 'locale', 'unclassified': 'locale', 'living_street': 'locale', 'road': 'locale',
    'pedestrian': 'locale',
    'service': 'service', 'track': 'service',
}
# Zoom minimal d'apparition par classe (le tuilage commence à 11).
MINZOOM = {'majeure': 11, 'secondaire': 11, 'locale': 13, 'service': 13}


def lancer(cmd):
    print('  $', ' '.join(cmd), flush=True)
    subprocess.run(cmd, check=True)


def sha256(chemin):
    h = hashlib.sha256()
    with open(chemin, 'rb') as f:
        for bloc in iter(lambda: f.read(1 << 20), b''):
            h.update(bloc)
    return h.hexdigest()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--pbf', required=True, help='extrait Geofabrik, HORS du dépôt')
    ap.add_argument('--extrait-date', default=None, help='date de l’extrait (Last-Modified), AAAA-MM-JJ')
    args = ap.parse_args()
    for outil in ('osmium', 'tippecanoe'):
        if not shutil.which(outil):
            sys.exit(f'✗ {outil} absent — brew install osmium-tool tippecanoe')

    with tempfile.TemporaryDirectory() as tmp:
        # 2a. Polygone d'Haïti : union des départements COD-AB.
        with open(DEPARTEMENTS, encoding='utf-8') as f:
            depts = json.load(f)
        haiti = unary_union([shape(ft['geometry']) for ft in depts['features']]).buffer(0.002)
        poly = os.path.join(tmp, 'haiti.geojson')
        with open(poly, 'w', encoding='utf-8') as f:
            json.dump({'type': 'Feature', 'properties': {}, 'geometry': mapping(haiti)}, f)

        voies = os.path.join(tmp, 'voies.osm.pbf')
        haiti_voies = os.path.join(tmp, 'haiti-voies.osm.pbf')
        brut = os.path.join(tmp, 'voies.geojsonseq')
        propre = os.path.join(tmp, 'routes.geojsonseq')

        lancer(['osmium', 'tags-filter', args.pbf, 'w/highway', '-o', voies, '--overwrite'])
        lancer(['osmium', 'extract', '-p', poly, voies, '-o', haiti_voies, '--overwrite'])
        lancer(['osmium', 'export', haiti_voies, '-f', 'geojsonseq', '-o', brut, '--overwrite',
                '--geometry-types=linestring'])

        # 3. Propriétés minimales et classe.
        comptes = {}
        nommees = {}
        with open(brut, encoding='utf-8') as src, open(propre, 'w', encoding='utf-8') as dst:
            for ligne in src:
                ligne = ligne.strip().lstrip('\x1e')
                if not ligne:
                    continue
                ft = json.loads(ligne)
                tags = ft.get('properties') or {}
                classe = CLASSES.get(tags.get('highway'))
                if not classe:
                    continue
                nom = (tags.get('name') or '').strip() or None
                if classe == 'service' and not nom:
                    continue
                props = {'classe': classe}
                if nom:
                    props['name'] = nom
                if tags.get('ref'):
                    props['ref'] = tags['ref']
                dst.write(json.dumps({
                    'type': 'Feature', 'geometry': ft['geometry'], 'properties': props,
                    'tippecanoe': {'minzoom': MINZOOM[classe]},
                }, ensure_ascii=False) + '\n')
                comptes[classe] = comptes.get(classe, 0) + 1
                if nom:
                    nommees[classe] = nommees.get(classe, 0) + 1

        # 4. Tuilage.
        lancer(['tippecanoe', '-o', SORTIE, '--force', '-l', 'routes', '-Z11', '-z15',
                '--simplification=4', '--drop-densest-as-needed', '--no-tile-size-limit',
                '-y', 'classe', '-y', 'name', '-y', 'ref', propre])

    taille = os.path.getsize(SORTIE)
    meta = {
        'description': 'Routes d’Haïti (OpenStreetMap) pour le fond de rues de la carte judiciaire',
        'source': SOURCE_URL,
        'extractDate': args.extrait_date,
        'sourceSha256': sha256(args.pbf),
        'sourceBytes': os.path.getsize(args.pbf),
        'license': 'ODbL 1.0 — © contributeurs OpenStreetMap',
        'builtAt': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
        'tool': 'scripts/build-routes-haiti.py (osmium, tippecanoe)',
        'zooms': [11, 15],
        'classes': {c: {'features': comptes.get(c, 0), 'named': nommees.get(c, 0), 'minzoom': MINZOOM[c]} for c in MINZOOM},
        'file': 'public/maps/hti/routes-hti.pmtiles',
        'bytes': taille,
        'sha256': sha256(SORTIE),
    }
    with open(METADONNEES, 'w', encoding='utf-8') as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)
        f.write('\n')
    print(f'\n  {SORTIE}\n  {taille / 1024 / 1024:.1f} Mo (budget {BUDGET_OCTETS / 1024 / 1024:.0f} Mo)')
    for c in MINZOOM:
        print(f'  {c:<10} {comptes.get(c, 0):>7} voies, dont {nommees.get(c, 0):>6} nommées (dès le zoom {MINZOOM[c]})')
    if taille > BUDGET_OCTETS:
        sys.exit('✗ au-delà du budget : descendre le zoom maximal à 14 ou retirer des classes')


if __name__ == '__main__':
    main()
