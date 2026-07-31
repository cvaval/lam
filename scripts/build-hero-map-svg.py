#!/usr/bin/env python3
"""Génère l'illustration vectorielle du héros « Carte judiciaire ».

Le héros ne charge JAMAIS MapLibre (budget de performance, § 16) : la carte y est
un SVG statique. Mais elle n'est pas dessinée à main levée — elle dérive de la
MÊME géométrie officielle que la carte interactive (COD-AB Haïti, CNIGS/OCHA),
fortement simplifiée pour tenir en quelques kilo-octets.

Les points de juridiction proviennent du référentiel : centroïdes documentés des
communes-sièges. Aucune position inventée.

Sortie : src/components/home/hero-map-data.ts

    python3 scripts/build-hero-map-svg.py
"""
from __future__ import annotations

import json
import math
import os
import unicodedata

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEPTS = os.path.join(ROOT, "public", "maps", "hti", "hti-adm1-departments.geojson")
META = os.path.join(ROOT, "public", "maps", "hti", "metadata.json")
SEED = os.path.join(ROOT, "data", "judicial-map", "seed-v1.json")
OUT = os.path.join(ROOT, "src", "components", "home", "hero-map-data.ts")

# Le COD-AB nomme les départements en ANGLAIS ; le référentiel légal en français.
DEPT_EN_FR = {
    "North": "Nord", "North-East": "Nord-Est", "North-West": "Nord-Ouest",
    "West": "Ouest", "South": "Sud", "South-East": "Sud-Est",
    "Artibonite": "Artibonite", "Centre": "Centre", "Grande'Anse": "Grand'Anse",
    "Nippes": "Nippes",
}

W = 1000.0          # largeur du viewBox
TOL = 0.012         # simplification agressive : silhouette lisible, pas une carte de travail
LAT0 = math.radians(19.0)  # parallèle de référence (projection équirectangulaire)


def norm(s: str) -> str:
    s = unicodedata.normalize("NFKD", s.lower())
    return "".join(c for c in s if not unicodedata.combining(c))


def seg_dist(p, a, b) -> float:
    """Distance point→SEGMENT. ⚠ La distance à la DROITE s'effondre sur un anneau
    fermé (a == b) : toutes les distances valent 0 et la forme se réduit à deux
    points. C'est exactement ce qui avait vidé les dix départements."""
    dx, dy = b[0] - a[0], b[1] - a[1]
    L2 = dx * dx + dy * dy
    if L2 == 0:
        return math.hypot(p[0] - a[0], p[1] - a[1])
    t = max(0.0, min(1.0, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2))
    return math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy))


def rdp(pts: list[tuple[float, float]], tol: float) -> list[tuple[float, float]]:
    """Douglas-Peucker (sans dépendance : le script tourne partout)."""
    if len(pts) < 3:
        return pts
    a, b = pts[0], pts[-1]
    idx, far = 0, -1.0
    for i in range(1, len(pts) - 1):
        d = seg_dist(pts[i], a, b)
        if d > far:
            idx, far = i, d
    if far <= tol:
        return [a, b]
    return rdp(pts[: idx + 1], tol)[:-1] + rdp(pts[idx:], tol)


def main() -> None:
    gj = json.load(open(DEPTS))
    meta = json.load(open(META))
    seed = json.load(open(SEED))

    # ── Emprise et projection ────────────────────────────────────────────────
    xs, ys = [], []
    def walk(c, fn):
        if isinstance(c, list) and c and isinstance(c[0], (int, float)):
            fn(c)
        elif isinstance(c, list):
            for x in c:
                walk(x, fn)
    for f in gj["features"]:
        walk(f["geometry"]["coordinates"], lambda p: (xs.append(p[0]), ys.append(p[1])))
    minx, maxx, miny, maxy = min(xs), max(xs), min(ys), max(ys)
    k = math.cos(LAT0)  # correction de la convergence des méridiens
    sx = W / ((maxx - minx) * k)
    H = round((maxy - miny) * sx, 1)

    def proj(p):
        return (round((p[0] - minx) * k * sx, 1), round((maxy - p[1]) * sx, 1))

    # ── Contours des départements ────────────────────────────────────────────
    paths = []
    for f in gj["features"]:
        name = DEPT_EN_FR.get(f["properties"]["adm1_name"], f["properties"]["adm1_name"])
        geom = f["geometry"]
        polys = geom["coordinates"] if geom["type"] == "MultiPolygon" else [geom["coordinates"]]
        d = []
        for poly in polys:
            for ring in poly:
                pts = [proj(p) for p in ring]
                # on écarte les îlots minuscules : bruit visuel à cette échelle
                w = max(p[0] for p in pts) - min(p[0] for p in pts)
                h = max(p[1] for p in pts) - min(p[1] for p in pts)
                if w < 6 and h < 6:
                    continue
                simp = rdp(pts, TOL * sx * k)
                if len(simp) < 4:
                    continue
                d.append("M" + "L".join(f"{x},{y}" for x, y in simp) + "Z")
        if d:
            paths.append({"name": name, "d": "".join(d)})

    # ── Étiquettes de département (point représentatif de la plus grande boucle) ─
    labels = []
    for f in gj["features"]:
        geom = f["geometry"]
        polys = geom["coordinates"] if geom["type"] == "MultiPolygon" else [geom["coordinates"]]
        best, area = None, -1.0
        for poly in polys:
            ring = poly[0]
            a = abs(sum(ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1] for i in range(len(ring) - 1)) / 2)
            if a > area:
                area, best = a, ring
        cx = sum(p[0] for p in best) / len(best)
        cy = sum(p[1] for p in best) / len(best)
        x, y = proj((cx, cy))
        en = f["properties"]["adm1_name"]
        labels.append({"name": DEPT_EN_FR.get(en, en).upper(), "x": x, "y": y})

    # ── Points de juridiction : centroïdes DOCUMENTÉS des communes-sièges ────
    centro = {c["lamId"]: (c["centroidLng"], c["centroidLat"]) for c in meta["communeCorrespondence"]}
    by_dept_commune = {}
    for c in seed["communes"]:
        by_dept_commune[(norm(c["department"]), norm(c["commune"]))] = c["id"]

    def point_for(dept: str, commune: str):
        cid = by_dept_commune.get((norm(dept), norm(commune)))
        ll = centro.get(cid) if cid else None
        return proj(ll) if ll else None

    dots = []
    seen = set()
    def add(kind: str, dept: str, commune: str):
        p = point_for(dept, commune)
        if not p or (kind, p) in seen:
            return
        seen.add((kind, p))
        dots.append({"k": kind, "x": p[0], "y": p[1]})

    for a in seed["courts"]["appeal"]:
        add("appel", a["department"], a["city"])
    # Un TPI par département : la maquette montre une constellation lisible, pas les 23.
    tpi_dept: set[str] = set()
    for t in seed["courts"]["firstInstance"]:
        if t["department"] in tpi_dept:
            continue
        tpi_dept.add(t["department"])
        add("tpi", t["department"], t["seatCommune"])
    # Tribunaux de paix : un échantillon lisible (1 par département hors chefs-lieux déjà marqués)
    per_dept: dict[str, int] = {}
    for p in seed["courts"]["peace"]:
        c = p["associatedCommuneOrCity"]
        if not c:
            continue
        if per_dept.get(p["department"], 0) >= 1:
            continue
        pt = point_for(p["department"], c)
        if not pt or ("paix", pt) in seen:
            continue
        per_dept[p["department"]] = per_dept.get(p["department"], 0) + 1
        add("paix", p["department"], c)

    pap = point_for("Ouest", "Port-au-Prince")

    body = f"""/**
 * Illustration du héros « Carte judiciaire » — données GÉNÉRÉES, ne pas éditer à la main.
 *   npx tsx … non : python3 scripts/build-hero-map-svg.py
 *
 * Silhouette et limites départementales dérivées du COD-AB Haïti (CNIGS/OCHA,
 * CC BY-IGO), simplifiées pour le héros ; points de juridiction posés sur les
 * centroïdes DOCUMENTÉS des communes-sièges du référentiel. Aucune position inventée.
 * Le héros ne charge pas MapLibre : ce SVG statique tient en quelques kilo-octets.
 */

export const HERO_MAP_VIEWBOX = '0 0 {int(W)} {int(H)}'

/** Contours départementaux (path SVG fermés). */
export const HERO_MAP_DEPARTMENTS: ReadonlyArray<{{ name: string; d: string }}> = {json.dumps(paths, ensure_ascii=False)}

/** Ancres des étiquettes de département. */
export const HERO_MAP_LABELS: ReadonlyArray<{{ name: string; x: number; y: number }}> = {json.dumps(labels, ensure_ascii=False)}

/** Points de juridiction (k = paix | tpi | appel). */
export const HERO_MAP_DOTS: ReadonlyArray<{{ k: 'paix' | 'tpi' | 'appel'; x: number; y: number }}> = {json.dumps(dots, ensure_ascii=False)}

/** Port-au-Prince — siège de la Cour de cassation, mis en avant. */
export const HERO_MAP_FOCUS = {{ x: {pap[0]}, y: {pap[1]} }}
"""
    open(OUT, "w", encoding="utf-8").write(body)
    print(f"✓ {os.path.relpath(OUT, ROOT)} · viewBox 0 0 {int(W)} {int(H)} · "
          f"{len(paths)} départements · {len(labels)} étiquettes · {len(dots)} points · "
          f"{os.path.getsize(OUT) // 1024} Ko")


if __name__ == "__main__":
    main()
