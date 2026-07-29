#!/usr/bin/env python3
# INDEX ALPHABÉTIQUE DÉTAILLÉ — Loi portant prévention et répression de la corruption
# (Loi du 12 mars 2014, Le Moniteur n° 87 du 9 mai 2014). Index rédigé après lecture
# INTÉGRALE des 41 unités (26 articles + 5.1 à 5.14 + 22.1).
# Produit _index.json. Assertions : 0 renvoi mort, couverture 41/41.
from __future__ import annotations

import json
import os

OUT = os.path.dirname(os.path.abspath(__file__))
VALID = [str(n) for n in range(1, 27)] + [f"5-{i}" for i in range(1, 15)] + ["22-1"]

IDX: dict[str, list[str]] = {
    # ── Titre I, chap. I-II : objet, champ, définitions ────────────────────────
    "Objet de la loi et harmonisation avec les conventions internationales": ["1"],
    "Champ d'application (personnes physiques, morales, ONG, secteur privé)": ["2"],
    "Auteur, co-auteur, instigateur, complice et receleur": ["2", "7"],
    "Offres, promesses, dons et avantages indus": ["2", "5-6", "14"],
    "Corruption (définition)": ["3"],
    "Définitions": ["4"],
    "Administration publique nationale (définition)": ["4"],
    "Agent public (définition)": ["4"],
    "Agent public étranger et fonctionnaire international": ["4", "6"],
    "Fonctionnaire (définition)": ["4"],
    "Biens (définition)": ["4"],
    "Confiscation (définition)": ["4", "5-6", "5-7", "5-8"],
    "Gel ou saisie (définition)": ["4"],
    "Magistrat (définition et forfaiture)": ["4", "15"],
    "Organisation non gouvernementale (ONG)": ["4", "5-14"],
    "Personne proche (définition et protection)": ["4", "18"],
    "Produit du crime (définition)": ["4", "5-3"],
    "Bénéfice déloyal (définition et peine)": ["4"],
    "Force publique (définition)": ["4"],
    "Employé et fonction publique (définitions)": ["4"],
    # ── Titre I, chap. III : incriminations ───────────────────────────────────
    "Actes de corruption (énumération)": ["5"],
    "Concussion (perception indue de droits, taxes ou deniers)": ["5-1"],
    "Exonération ou franchise illégale de droits et taxes": ["5-1"],
    "Abrogation de l'article 135 du Code pénal": ["5-1"],
    "Enrichissement illicite (augmentation disproportionnée du patrimoine)": ["5-2"],
    "Recel d'enrichissement illicite": ["5-2"],
    "Blanchiment du produit du crime (renvoi à la loi sur le blanchiment)": ["5-3"],
    "Détournement de biens publics": ["5-4"],
    "Abus de fonction": ["5-5"],
    "Pot-de-vin (sollicitation ou acceptation)": ["5-6"],
    "Commissions illicites": ["5-7"],
    "Surfacturation": ["5-8"],
    "Trafic d'influence": ["5-9"],
    "Favoritisme et népotisme": ["5-10"],
    "Délit d'initié (informations privilégiées, marchés publics)": ["5-11"],
    "Passation illégale de marché public": ["5-12"],
    "Marchés publics (réglementation et sanctions)": ["5-11", "5-12", "10"],
    "Prise illégale d'intérêts": ["5-13"],
    "Abus de biens sociaux (sociétés, ONG, fondations, coopératives)": ["5-14"],
    "Corruption d'agents publics étrangers et de fonctionnaires internationaux": ["6"],
    "Responsabilité pénale des personnes morales": ["7", "8", "22-1"],
    "Amende des personnes morales (un à dix millions de gourdes)": ["8"],
    "Pratiques commerciales et comptables interdites (répression)": ["9", "25"],
    "Faux et usage de faux": ["9", "25"],
    "Pratiques bancaires illicites (garanties, lettres de crédit)": ["10"],
    "Institutions financières et compagnies d'assurances (sanctions)": ["10"],
    # ── Titre I, chap. IV : modifications du Code pénal ───────────────────────
    "Modification du Code pénal (forfaiture des fonctionnaires publics)": ["11", "12", "13", "14", "15"],
    "Article 137 du Code pénal modifié (agréation d'offres ou présents)": ["11"],
    "Article 138 du Code pénal modifié (abstention d'un acte du devoir)": ["12"],
    "Article 139 du Code pénal modifié (concours avec un fait criminel)": ["13"],
    "Article 140 du Code pénal modifié (contrainte et corruption active)": ["14"],
    "Article 144 du Code pénal modifié (forfaiture du magistrat)": ["15"],
    "Dégradation civique": ["15"],
    # ── Titre I, chap. V : règles communes ────────────────────────────────────
    "Réduction de peine en cas de coopération du prévenu": ["16"],
    "Prescription de l'action publique (vingt ans)": ["17"],
    "Imprescriptibilité des peines et amendes": ["17"],
    "Protection des dénonciateurs, témoins et experts": ["18"],
    "Vengeance, intimidation et menaces contre témoins": ["18"],
    "Techniques d'investigation (renvoi à la loi sur le blanchiment)": ["19"],
    "Secret bancaire ou professionnel (inopposabilité)": ["20"],
    "Unité de lutte contre la corruption (ULCC, décret du 8 septembre 2004)": ["20"],
    "Entrave au bon fonctionnement de la justice": ["21"],
    "Subornation de témoin et faux témoignage": ["21"],
    "Refus de fournir informations et documents en cours d'enquête": ["21"],
    "Peines complémentaires des personnes physiques": ["22"],
    "Interdiction d'exercer une fonction publique (cinq ans)": ["5-10", "22", "22-1"],
    "Affichage et diffusion de la décision par voie de presse": ["22", "22-1"],
    "Peines complémentaires des personnes morales": ["22-1"],
    # ── Titre II : prévention ─────────────────────────────────────────────────
    "Code d'éthique des agents de l'administration publique": ["23"],
    "Conflits d'intérêts (prévention)": ["23"],
    "Transparence dans les relations avec le public": ["24"],
    "Droit d'accès à l'information (loi à adopter)": ["24"],
    "Normes comptables et d'audit du secteur privé": ["25"],
    "Comptes hors livres et opérations non identifiées": ["25"],
    "Destruction de documents comptables et dépenses inexistantes": ["25"],
    # ── Titre III : dispositions finales ──────────────────────────────────────
    "Clause abrogatoire et exécution": ["26"],
    # ── Entrées transversales ─────────────────────────────────────────────────
    "Peines de réclusion": ["5-1", "5-2", "5-4", "5-5", "5-7", "5-8", "5-12", "5-13", "5-14", "6"],
    "Amendes (montants par infraction)": ["5-5", "5-8", "5-9", "5-11", "5-13", "6", "8", "9", "10"],
    "Restitution et dommages-intérêts": ["5-1", "5-2", "5-4", "5-14"],
    "Tentative (répression)": ["5-1", "5-3"],
    "Ministre de l'Économie et des Finances, de la Justice et des Affaires Étrangères": ["26"],
}

for s, refs in IDX.items():
    for r in refs:
        assert r in VALID, f"renvoi mort {r} dans « {s} »"
covered = {r for refs in IDX.values() for r in refs}
missing = [v for v in VALID if v not in covered]
assert not missing, f"articles non couverts : {missing}"
entries = [{"subject": s, "ctRefs": refs} for s, refs in sorted(IDX.items(), key=lambda kv: kv[0].lower())]
json.dump(entries, open(f"{OUT}/_index.json", "w"), ensure_ascii=False, indent=1)
print(f"✓ index corruption : {len(entries)} sujets · couverture {len(covered)}/{len(VALID)} · 0 renvoi mort")
