#!/usr/bin/env python3
"""Prétraitement cartographique de la carte judiciaire (hors navigateur, §9.5).

Entrée  : archive GeoJSON du COD-AB Haïti (CNIGS, diffusé par OCHA/ITOS sur HDX,
          licence CC BY-IGO) — téléchargée UNE FOIS, épinglée par empreinte SHA-256.
Sorties : public/maps/hti/hti-adm1-departments.geojson   (10 départements)
          public/maps/hti/hti-adm2-communes.geojson      (140 communes, jointes aux clés Lam)
          public/maps/hti/hti-adm3-sections.geojson      (570 sections, simplifiées)
          public/maps/hti/hti-arrondissements.geojson    (dissolution des communes jointes)
          public/maps/hti/metadata.json                  (source, licence, jointure, manquants)
          data/judicial-map/rapport-jointure.md          (rapport lisible)

Règles : ne JAMAIS fabriquer les polygones des communes absentes du COD-AB ;
         un arrondissement n'est dissous que si TOUTES ses communes ont une
         géométrie ; les centroïdes sont des points représentatifs DÉRIVÉS de la
         géométrie officielle (documentés comme tels), jamais inventés.

    python3 scripts/build-judicial-map-geo.py --zip <hti_admin_boundaries.geojson.zip>
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
import unicodedata
import zipfile
from collections import defaultdict

from shapely.geometry import mapping, shape
from shapely.ops import unary_union

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "public", "maps", "hti")
SEED = os.path.join(ROOT, "data", "judicial-map", "seed-v1.json")
SOURCE_URL = (
    "https://data.humdata.org/dataset/777e8b06-337f-4295-80bc-ca1515244215/"
    "resource/1d89a0d5-897d-4c83-ab37-f363a0dca850/download/hti_admin_boundaries.geojson.zip"
)

# Tolérances Douglas-Peucker (degrés ; ~110 m par 0.001) — coordonnées arrondies à 5 décimales.
TOL = {"adm1": 0.0012, "adm2": 0.0008, "adm3": 0.0015, "arr": 0.0008}


def norm(s: str) -> str:
    s = unicodedata.normalize("NFKD", s.lower())
    s = "".join(c for c in s if not unicodedata.combining(c))
    for ch in "'’-–—_./":
        s = s.replace(ch, " ")
    return "".join(s.split())


# Le COD-AB nomme les départements en ANGLAIS (adm1_name) ; le référentiel légal
# en français. Correspondance vérifiée sur hti_admin1.geojson (adm1_name1 = français).
DEPT_EN_FR = {
    "North": "Nord", "North-East": "Nord-Est", "North-West": "Nord-Ouest",
    "West": "Ouest", "South": "Sud", "South-East": "Sud-Est",
    "Artibonite": "Artibonite", "Centre": "Centre", "Grande'Anse": "Grand'Anse",
    "Nippes": "Nippes",
}

# COD-AB (adm2_name) → commune du référentiel légal, quand la normalisation ne suffit pas.
# Chaque entrée est justifiée dans le rapport de jointure.
OVERRIDES: dict[str, str] = {
    # Variantes d'orthographe COD-AB → référentiel légal (même département, 1-à-1) :
    "Sud-Est|Anse-a-Pitre": "commune-sud-est-anse-a-pitres",  # singulier au COD
    "Nord-Ouest|Chamsolme": "commune-nord-ouest-chansolme",  # coquille du COD (« m » pour « n »)
    "Ouest|Cornillon / Grand Bois": "commune-ouest-cornillon",  # double dénomination
    "Sud|Coteaux": "commune-sud-les-coteaux",  # article omis
    "Artibonite|Gonaives": "commune-artibonite-les-gonaives",  # article omis
    "Nord-Ouest|La Tortue": "commune-nord-ouest-ile-de-la-tortue",  # variante courte
    "Sud-Est|La Vallee": "commune-sud-est-la-vallee-de-jacmel",  # variante courte
}


def rounded(geom, tol: float):
    g = geom.simplify(tol, preserve_topology=True)
    return json.loads(json.dumps(mapping(g)), parse_float=lambda x: round(float(x), 5))


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--zip", required=True)
    args = ap.parse_args()

    os.makedirs(OUT, exist_ok=True)
    raw = open(args.zip, "rb").read()
    sha = hashlib.sha256(raw).hexdigest()
    z = zipfile.ZipFile(args.zip)
    seed = json.load(open(SEED))

    def layer(name: str):
        return json.loads(z.read(name))

    adm1 = layer("hti_admin1.geojson")
    adm2 = layer("hti_admin2.geojson")
    adm3 = layer("hti_admin3.geojson")

    # ── Jointure adm2 ↔ 149 communes du référentiel ──────────────────────────
    seed_by_key: dict[tuple[str, str], dict] = {}
    for c in seed["communes"]:
        seed_by_key[(norm(c["department"]), norm(c["commune"]))] = c
    matched: dict[str, dict] = {}  # commune.id → {pcode, kreyol}
    cod_unmatched: list[str] = []
    for f in adm2["features"]:
        p = f["properties"]
        dept, name = DEPT_EN_FR.get(p["adm1_name"], p["adm1_name"]), p["adm2_name"]
        target = OVERRIDES.get(f"{dept}|{name}")
        c = (
            next((x for x in seed["communes"] if x["id"] == target), None)
            if target
            else seed_by_key.get((norm(dept), norm(name)))
        )
        if not c:
            cod_unmatched.append(f"{dept} | {name} ({p['adm2_pcode']})")
            continue
        if c["id"] in matched:
            cod_unmatched.append(f"{dept} | {name} ({p['adm2_pcode']}) — DOUBLE jointure sur {c['id']}")
            continue
        f["properties"] = {
            "adm2_pcode": p["adm2_pcode"],
            "adm2_name": name,
            "adm1_name": dept,
            "name_ht": p.get("adm2_name2"),
            "lamId": c["id"],
            "lamKey": c["key"],
            "arrondissement": c["arrondissement"],
        }
        geom = shape(f["geometry"])
        rep = geom.representative_point()
        matched[c["id"]] = {
            "pcode": p["adm2_pcode"],
            "kreyol": p.get("adm2_name2"),
            "centroidLat": round(rep.y, 6),
            "centroidLng": round(rep.x, 6),
            "geom": geom,
        }
    seed_unmatched = [c for c in seed["communes"] if c["id"] not in matched]

    # ── Simplification + écriture des couches ────────────────────────────────
    def write(name: str, features: list, tol_key: str, keep=None) -> int:
        out = {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "properties": {k: v for k, v in f["properties"].items() if keep is None or k in keep},
                    "geometry": rounded(shape(f["geometry"]), TOL[tol_key]),
                }
                for f in features
            ],
        }
        path = os.path.join(OUT, name)
        json.dump(out, open(path, "w"), ensure_ascii=False, separators=(",", ":"))
        print(f"  {name}: {len(out['features'])} entités · {os.path.getsize(path) // 1024} Ko")
        return len(out["features"])

    n1 = write("hti-adm1-departments.geojson", adm1["features"], "adm1", keep={"adm1_name", "adm1_pcode"})
    n2 = write("hti-adm2-communes.geojson", adm2["features"], "adm2")
    n3 = write(
        "hti-adm3-sections.geojson", adm3["features"], "adm3",
        keep={"adm3_name", "adm3_pcode", "adm2_name", "adm1_name"},
    )

    # ── Arrondissements : dissolution des communes JOINTES (jamais partielles) ─
    by_arr: dict[tuple[str, str], list] = defaultdict(list)
    for c in seed["communes"]:
        by_arr[(c["department"], c["arrondissement"])].append(c)
    arr_features, arr_skipped = [], []
    for (dept, arr), communes in sorted(by_arr.items()):
        geoms = [matched[c["id"]]["geom"] for c in communes if c["id"] in matched]
        if len(geoms) != len(communes):
            missing = [c["commune"] for c in communes if c["id"] not in matched]
            arr_skipped.append(f"{dept} / {arr} — géométrie absente pour : {', '.join(missing)}")
            if not geoms:
                continue
        arr_features.append(
            {
                "type": "Feature",
                "properties": {
                    "arrondissement": arr,
                    "adm1_name": dept,
                    "complete": len(geoms) == len(communes),
                    "communeCount": len(communes),
                },
                "geometry": mapping(unary_union(geoms)),
            }
        )
    n_arr = write("hti-arrondissements.geojson", arr_features, "arr")

    # ── metadata.json (exigences §9.3) ───────────────────────────────────────
    correspondence = [
        {
            "lamId": cid,
            "lamKey": next(c["key"] for c in seed["communes"] if c["id"] == cid),
            "adm2_pcode": m["pcode"],
            "aliasKreyol": m["kreyol"],
            "centroidLat": m["centroidLat"],
            "centroidLng": m["centroidLng"],
        }
        for cid, m in sorted(matched.items())
    ]
    metadata = {
        "title": "Haiti - Subnational Administrative Boundaries (COD-AB HTI)",
        "organization": "CNIGS (Centre National de l'Information Géo-Spatiale) — diffusé par OCHA/ITOS via HDX",
        "sourceUrl": SOURCE_URL,
        "sourceSha256": sha,
        "downloadedAt": "2026-07-31",
        "license": "Creative Commons Attribution for Intergovernmental Organisations (CC BY-IGO)",
        "attribution": "Limites administratives : CNIGS / OCHA (COD-AB Haïti, CC BY-IGO)",
        "originalProjection": "EPSG:4326 (WGS 84)",
        "transformedAt": "2026-07-31",
        "transformation": (
            "Simplification Douglas-Peucker préservant la topologie par entité "
            f"(tolérances {TOL}), coordonnées arrondies à 5 décimales ; centroïdes = points "
            "représentatifs Shapely DÉRIVÉS de la géométrie officielle ; arrondissements "
            "dissous par union des communes jointes (jamais sur des géométries partielles)."
        ),
        "featureCounts": {"adm1": n1, "adm2": n2, "adm3": n3, "arrondissements": n_arr},
        "communeCorrespondence": correspondence,
        "unmatchedLegalCommunes": [
            {"lamId": c["id"], "lamKey": c["key"], "note": "Limite cartographique à confirmer — commune absente du COD-AB (140 communes)."}
            for c in seed_unmatched
        ],
        "unmatchedCodFeatures": cod_unmatched,
        "incompleteArrondissements": arr_skipped,
    }
    json.dump(metadata, open(os.path.join(OUT, "metadata.json"), "w"), ensure_ascii=False, indent=1)

    # ── Rapport de jointure lisible ──────────────────────────────────────────
    lines = [
        "# Rapport de jointure — 149 communes légales ↔ géométries COD-AB (140)",
        "",
        f"Source : COD-AB HTI (HDX, CC BY-IGO), SHA-256 `{sha[:16]}…`, téléchargé le 2026-07-31.",
        "",
        f"| Mesure | Valeur |",
        f"|---|---:|",
        f"| Communes légales | {len(seed['communes'])} |",
        f"| Géométries COD-AB (adm2) | {len(adm2['features'])} |",
        f"| Jointes | {len(matched)} |",
        f"| Communes légales SANS géométrie | {len(seed_unmatched)} |",
        f"| Géométries COD-AB sans commune légale | {len(cod_unmatched)} |",
        f"| Arrondissements dissous | {n_arr} (dont incomplets : {len(arr_skipped)}) |",
        "",
        "## Communes légales sans polygone (« Limite cartographique à confirmer »)",
        "",
    ]
    for c in seed_unmatched:
        lines.append(f"- **{c['commune']}** ({c['department']}, arr. {c['arrondissement']}) — `{c['id']}`" +
                     (f" · {c['observation']}" if c.get("observation") else ""))
    lines += ["", "## Géométries COD-AB non appariées", ""]
    lines += [f"- {x}" for x in cod_unmatched] or ["- aucune"]
    lines += ["", "## Arrondissements à géométrie incomplète (non dissous intégralement)", ""]
    lines += [f"- {x}" for x in arr_skipped] or ["- aucun"]
    open(os.path.join(ROOT, "data", "judicial-map", "rapport-jointure.md"), "w").write("\n".join(lines) + "\n")

    print(f"\njointure : {len(matched)}/{len(seed['communes'])} · sans géométrie : {len(seed_unmatched)} · COD orphelines : {len(cod_unmatched)}")
    for c in seed_unmatched:
        print("   ∅", c["department"], "|", c["commune"])
    for x in cod_unmatched:
        print("   ?", x)
    if len(matched) + len(seed_unmatched) != len(seed["communes"]):
        sys.exit("incohérence de jointure — abandon")


if __name__ == "__main__":
    main()
