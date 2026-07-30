#!/usr/bin/env python3
"""Index alphabétique — Circulaire BRH n° 117-1 (Pratiques de gouvernance).

Rédigé après lecture INTÉGRALE des 20 divisions. Produit _index.json.
Assertions bloquantes : 0 renvoi mort · couverture 20/20 · aucun doublon.
"""
from __future__ import annotations

import json
import os

OUT = os.path.dirname(os.path.abspath(__file__))
VALID = ["1", "2", "3", "4", "4.1", "4.2", "4.2.1", "4.2.2", "4.3",
         "5", "5.1", "5.2", "5.3", "6", "6.1", "6.2", "7", "8", "9", "10"]

IDX: dict[str, list[str]] = {
    # ── 1. Définitions ────────────────────────────────────────────────────────
    "Administrateur (définition)": ["1"],
    "Conseil d'administration (définition)": ["1", "4"],
    "Directeur général (définition)": ["1", "5"],
    "Dirigeant (définition)": ["1", "5"],
    "Gouvernance (définition)": ["1", "2"],
    "Organe de gouvernance (définition)": ["1"],
    "Textes fondant la circulaire (loi de 2012, décrets IMF et change)": ["1"],
    # ── 2. Système de gouvernance ─────────────────────────────────────────────
    "Système de gouvernance (mise en place et approbation)": ["2"],
    "Proportionnalité (taille, structure, complexité, profil de risque)": ["2", "4.2.1", "4.2.2", "6"],
    "Information annuelle des actionnaires": ["2", "4.1"],
    "Sécurité des systèmes d'information": ["2"],
    "Continuité d'activité (rétablissement du fonctionnement)": ["2"],
    "Séparation des fonctions d'administration et de direction": ["2", "4.2.2"],
    "Stratégies, politiques et procédures (formalisation)": ["2", "4.1", "5.1"],
    # ── 3. Rôle des administrateurs et dirigeants ─────────────────────────────
    "Devoirs des administrateurs et dirigeants": ["3"],
    "Obligation de loyauté": ["3"],
    "Obligation de diligence (prudence raisonnable)": ["3"],
    "Obligation de vigilance et de conformité": ["3"],
    "Obligation de prudence et d'indépendance": ["3", "4.2.1"],
    "Confidentialité des affaires de l'institution": ["3"],
    "Officier de conformité (nomination et suivi des recommandations)": ["3"],
    "Lutte contre le blanchiment et le financement du terrorisme": ["3", "6.2"],
    "Valeurs et mission de l'institution (objectifs sociaux et financiers)": ["3", "4.1"],
    # ── 4. Conseil d'administration ───────────────────────────────────────────
    "Attributions du conseil d'administration": ["4.1"],
    "Objectifs stratégiques (définition et suivi)": ["4.1", "5.1"],
    "Appétence pour le risque (déclaration et plafonds)": ["4.1"],
    "Nomination du directeur général et des dirigeants": ["4.1", "5.2"],
    "Surveillance de la performance des dirigeants": ["4.1"],
    "Organigramme et organisation administrative (approbation)": ["4.1", "6.1"],
    "Politique de contrôle et surveillance permanente de la gestion": ["4.1", "6.2"],
    "Comités spécialisés (création et fonctionnement)": ["4.1", "4.2.2"],
    "Culture d'entreprise et comportement éthique": ["4.1"],
    "Code de déontologie": ["4.1", "6.2"],
    "Fonction finances, comptabilité et données financières": ["4.1"],
    "États financiers annuels (approbation)": ["4.1"],
    "Reddition de comptes aux actionnaires": ["4.1", "4.2.2", "4.3"],
    "Politique de rémunération (surveillance)": ["4.1"],
    "Communication externe, notamment avec la BRH": ["4.1"],
    "Cadre de gouvernance (mise en œuvre et réexamen)": ["4.1"],
    # ── 4.2 Composition, qualification, responsabilités ───────────────────────
    "Composition du conseil d'administration": ["4.2", "4.2.1"],
    "Jugement indépendant des administrateurs": ["4.2.1"],
    "Connaissances bancaires ou financières des administrateurs": ["4.2.1"],
    "Intégrité et compétence minimale de l'administrateur": ["4.2.1"],
    "Renseignements à fournir à la BRH pour un administrateur": ["4.2.1"],
    "Casier judiciaire et certificat de police": ["4.2.1", "5.3"],
    "Curriculum vitae et parcours professionnel": ["4.2.1", "5.3"],
    "Actions souscrites et libérées": ["4.2.1"],
    "Rejet motivé d'une candidature par la BRH": ["4.2.1", "5.3"],
    "Délai de vingt (20) jours ouvrables de la BRH": ["4.2.1", "5.3"],
    "Vacance ou changement au sein du conseil ou des comités": ["4.2.1", "5.3"],
    "Cumul interdit dans deux institutions de même catégorie": ["4.2.1", "9"],
    "Comité d'audit": ["4.2.2"],
    "Comité de gestion des risques": ["4.2.2"],
    "Comité des nominations": ["4.2.2"],
    "Comité des rémunérations": ["4.2.2"],
    "Banques détenant 10 % ou plus des dépôts totaux": ["4.2.2"],
    "Registre des délibérations et décisions des comités": ["4.2.2"],
    "Personnes externes non apparentées au sein des comités": ["4.2.2"],
    "Conflits d'intérêts (prévention et traitement)": ["4.2.2", "5.1"],
    "Groupes, sociétés mères et filiales": ["4.2.2"],
    "Surveillance des filiales et standards du groupe": ["4.2.2"],
    "Transactions avec les personnes liées": ["4.2.2", "6.1"],
    "Droit à l'information des actionnaires": ["4.2.2"],
    "Non-cumul des fonctions de président et de directeur général": ["4.2.2"],
    "Indépendance du conseil vis-à-vis de la direction générale": ["4.2.2"],
    # ── 4.3 Réunions ──────────────────────────────────────────────────────────
    "Participation aux réunions du conseil d'administration": ["4.3"],
    "Visioconférence et modes de participation": ["4.3"],
    "Seuil de cinquante pour cent (50 %) de présence annuelle": ["4.3"],
    "Remplacement de l'administrateur défaillant par l'assemblée générale": ["4.3"],
    "Textes organiques de l'institution": ["4.3"],
    # ── 5. Direction générale et dirigeants ───────────────────────────────────
    "Responsabilités de la direction générale": ["5.1"],
    "Structure organisationnelle et mesures de contrôle": ["5.1", "6.1"],
    "Politique de risques et procédures de gestion des risques": ["5.1", "6.1"],
    "Contrôle permanent, conformité et gestion des risques": ["5.1", "6.2"],
    "Rapports réguliers au conseil d'administration": ["5.1"],
    "Prêts aux actionnaires, administrateurs et dirigeants": ["5.1"],
    "Désignation d'au moins deux (2) dirigeants (banques)": ["5.2"],
    "Répartition des fonctions entre dirigeants": ["5.2"],
    "Extension de l'obligation par la BRH à d'autres institutions": ["5.2"],
    "Qualification et formation continue des dirigeants": ["5.3"],
    "Renseignements à fournir à la BRH pour un dirigeant": ["5.3"],
    # ── 6. Cadre organisationnel ──────────────────────────────────────────────
    "Dispositif d'organisation d'entreprise": ["6"],
    "Évaluation périodique des organes d'administration et de direction": ["6"],
    "Plan d'affaires prévisionnel triennal": ["6.1"],
    "Suivi budgétaire": ["6.1"],
    "Définition des fonctions et des postes": ["6.1"],
    "Répartition des pouvoirs en matière de crédit et de placements": ["6.1"],
    "Cartographie des risques (évaluation et cotation)": ["6.1"],
    "Grands risques et concentration sectorielle et géographique": ["6.1"],
    "Adéquation des fonds propres et de la liquidité": ["6.1"],
    "Contrôle interne et maîtrise des risques": ["6.2"],
    "Identification de la clientèle et surveillance renforcée": ["6.2"],
    "Formation continue du personnel de conformité": ["6.2"],
    # ── 7. Risques de défaillance de la gouvernance ───────────────────────────
    "Risques liés à la défaillance de la gouvernance": ["7"],
    "Risques stratégiques (croissance, décisions, dérive)": ["7"],
    "Risque de non-conformité légale et réglementaire": ["7"],
    "Risque de blocage décisionnel du conseil": ["7"],
    "Risque de conflit d'intérêts (avantages personnels)": ["7"],
    "Risque d'insuffisance des compétences et talents": ["7"],
    # ── 8-10. Sanctions, transition, vigueur ──────────────────────────────────
    "Sanctions de la BRH": ["8"],
    "Redressement immédiat de la situation": ["8"],
    "Lettre d'avertissement au conseil d'administration": ["8"],
    "Suspension provisoire des administrateurs ou dirigeants": ["8"],
    "Destitution des administrateurs ou dirigeants": ["8"],
    "Cumul de sanctions selon la gravité": ["8"],
    "Disposition transitoire (prochaine assemblée générale)": ["9"],
    "Entrée en vigueur au 5 janvier 2026": ["10"],
    "Remplacement de la circulaire 117": ["10"],
}


def main() -> None:
    for subject, refs in IDX.items():
        for r in refs:
            assert r in VALID, f"renvoi mort « {r} » dans « {subject} »"
        assert len(refs) == len(set(refs)), f"doublon interne dans « {subject} »"
    covered = {r for refs in IDX.values() for r in refs}
    missing = [v for v in VALID if v not in covered]
    assert not missing, f"divisions non couvertes : {missing}"
    seen = set()
    for subject, refs in IDX.items():
        key = (subject.lower(), tuple(sorted(refs)))
        assert key not in seen, f"entrée en double : « {subject} »"
        seen.add(key)
    entries = [
        {"subject": s, "ctRefs": [r.replace(".", "-") for r in refs]}
        for s, refs in sorted(IDX.items(), key=lambda kv: kv[0].lower())
    ]
    json.dump(entries, open(f"{OUT}/_index.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"✓ index 117-1 : {len(entries)} sujets · couverture {len(covered)}/{len(VALID)} · 0 renvoi mort")


if __name__ == "__main__":
    main()
