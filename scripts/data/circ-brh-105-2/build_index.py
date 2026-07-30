#!/usr/bin/env python3
"""Index alphabétique — Circulaire BRH n° 105-2 (transmission des crédits au BIC).

Rédigé après lecture INTÉGRALE des 12 points et des 3 annexes. Produit _index.json.

Deux natures de renvois :
  ctRefs  → divisions du corps (ancres art-…), liens directs du panneau Index ;
  secRefs → en-têtes d'annexe (ancres sec-…). Le panneau Index ne sait construire que
            « #art-N » : ces renvois passent donc par `docRefs`, que l'import résout
            vers le document lui-même une fois son id connu.

Assertions bloquantes : 0 renvoi mort · couverture 17/17 points ET 25/25 annexes.
"""
from __future__ import annotations

import json
import os

OUT = os.path.dirname(os.path.abspath(__file__))
POINTS = ["1", "2", "3", "4", "5", "6", "7", "8", "9",
          "9.1", "9.2", "9.3", "9.4", "9.5", "10", "11", "12"]
# sec-N ↔ libellé, dans l'ordre du corps (cf. ANNEX_TOC de parse_105_2.py).
SECS = {
    "sec-1": "Annexe 1", "sec-2": "Annexe 1 — Transfert des fichiers",
    "sec-3": "Annexe 1, §1 — Introduction", "sec-4": "Annexe 1, §2 — Connectivité SFTP",
    "sec-5": "Annexe 1, §3 — Processus de transmission", "sec-6": "Annexe 1, §4 — Répertoires",
    "sec-7": "Annexe 2", "sec-8": "Annexe 2 — Fichiers de collecte",
    "sec-9": "Annexe 2, fichier 1 — Entreprise/Responsable/Actionnaire/Crédit",
    "sec-10": "Annexe 2, fichier 2 — Individu/Emploi/Crédit",
    "sec-11": "Annexe 2, fichier 3 — Crédit/Garantie",
    "sec-12": "Annexe 2, fichier 4 — Crédit/Activité",
    "sec-13": "Annexe 2, fichier 5 — Entreprise/Chèques retournés",
    "sec-14": "Annexe 2, fichier 6 — Individu/Chèques retournés",
    "sec-15": "Annexe 3", "sec-16": "Annexe 3, tableau 1 — Secteurs d'activités",
    "sec-17": "Annexe 3, tableau 2 — Communes", "sec-18": "Annexe 3, tableau 3 — Pays",
    "sec-19": "Annexe 3, tableau 4 — Formes juridiques", "sec-20": "Annexe 3, tableau 5 — Types de sûreté",
    "sec-21": "Annexe 3, tableau 6 — Nature des garanties", "sec-22": "Annexe 3, tableau 7 — Codes postaux",
    "sec-23": "Annexe 3, tableau 8 — Professions", "sec-24": "Annexe 3, tableau 9 — Statuts de crédit",
    "sec-25": "Annexe 3, tableau 10 — Responsabilité envers le crédit",
}

# sujet → (renvois au corps, renvois aux annexes)
IDX: dict[str, tuple[list[str], list[str]]] = {
    # ── Objet, champ, définitions ─────────────────────────────────────────────
    "Bureau d'Information sur le Crédit (BIC)": (["1", "2", "3"], ["sec-1"]),
    "Institution financière (définition)": (["1"], []),
    "Filiale de banque (définition)": (["1", "9.1", "9.2"], []),
    "Coopératives d'épargne et de crédit (CEC)": (["1"], []),
    "Institutions de microfinance (IMF)": (["1"], []),
    "Sociétés de carte de crédit, de crédit-bail, financières de développement": (["1"], []),
    "Affiliation au BIC": (["1", "11"], []),
    "Textes fondant la circulaire (loi de 2012, décret IMF, loi CEC)": (["1"], []),
    # ── Obligations de transmission ───────────────────────────────────────────
    "Transmission mensuelle des informations de crédit": (["2", "4"], ["sec-8"]),
    "Délai du dix (10) de chaque mois": (["2", "3"], []),
    "Portefeuille de crédit (prêts, avances, acceptations, créances)": (["2"], []),
    "Engagements de bilan et hors-bilan": (["2"], []),
    "Format électronique des transmissions": (["2", "4"], ["sec-2", "sec-8"]),
    "Chèques retournés pour insuffisance de fonds": (["3"], ["sec-13", "sec-14"]),
    "Notification automatique au BIC": (["3"], []),
    "Rapport mensuel sur les chèques retournés": (["3"], []),
    "Informations obligatoires de l'annexe 2": (["4"], ["sec-7", "sec-8"]),
    # ── Obligations de qualité et de sécurité ─────────────────────────────────
    "Correction des renseignements erronés (cinq jours ouvrables)": (["5", "9.2"], []),
    "Utilisation des données en bon père de famille": (["5"], []),
    "Bonnes pratiques internationales": (["5"], []),
    "Frais de collecte et de traitement à la charge de l'institution": (["5"], []),
    "Mise à jour des informations de crédit": (["5", "6"], []),
    "Sécurisation des informations collectées et transmises": (["5"], []),
    "Exactitude et exhaustivité des informations": (["6"], []),
    "Informations fausses, inexactes ou périmées (sanctions)": (["6"], []),
    "Transmission partielle assimilée à un défaut de transmission": (["6", "9.1"], []),
    # ── Consentement et rapport de crédit ─────────────────────────────────────
    "Consentement signé de l'emprunteur": (["7", "9.4"], []),
    "Clause de consentement dans le contrat de crédit": (["7"], []),
    "Durée du consentement (jusqu'à extinction des obligations)": (["7"], []),
    "Bureaux de crédit habilités en Haïti ou à l'étranger": (["7"], []),
    "Date du 15 octobre 2025 (consentement et entrée en vigueur)": (["7", "12"], []),
    "Consultation obligatoire du rapport de crédit": (["8", "9.3"], []),
    "Conservation d'une copie du rapport de crédit": (["8"], []),
    "Octroi, renouvellement, suivi et prolongation de crédit": (["8"], []),
    "Modification des termes d'un contrat de crédit": (["8"], []),
    "Attribution des moyens de paiement": (["8"], []),
    "Interdiction d'usage à des fins de prospection ou de marketing": (["8"], []),
    "Validité d'un (1) mois du rapport de crédit": (["8"], []),
    # ── Pénalités ─────────────────────────────────────────────────────────────
    "Pénalités et amendes (régime général)": (["9", "10"], []),
    "Retard de transmission (amendes journalières)": (["9.1"], []),
    "Amende de cent mille gourdes (HTG 100 000) par jour": (["9.1"], []),
    "Amende de cinquante mille gourdes (HTG 50 000) par jour": (["9.1", "9.2"], []),
    "Amende de cent cinquante mille gourdes (HTG 150 000) par jour": (["9.1"], []),
    "Amende de soixante-quinze mille gourdes (HTG 75 000) par jour": (["9.1"], []),
    "Aggravation au-delà du quinzième jour du mois": (["9.1"], []),
    "Retard de correction (amendes journalières)": (["9.2"], []),
    "Amende de vingt-cinq mille gourdes (HTG 25 000) par jour": (["9.2"], []),
    "Absence de rapport de crédit constatée en inspection": (["9.3"], []),
    "Absence de consentement au partage d'information": (["9.4"], []),
    "Amende de deux cent mille gourdes (HTG 200 000) par cas": (["9.3", "9.4", "9.5"], []),
    "Autres infractions (cessation immédiate de la pratique)": (["9.5"], []),
    "Lettre de blâme": (["9.5"], []),
    "Inspection de la BRH": (["9.3", "9.4", "9.5"], []),
    "Prélèvement automatique de l'amende sur le compte à la BRH": (["10"], []),
    "Paiement par chèque de direction (institution sans compte à la BRH)": (["10"], []),
    "Pénalité de deux mille cinq cents gourdes (HTG 2 500) par jour de retard": (["10"], []),
    "Période de grâce de quatre (4) mois des nouvelles affiliées": (["11"], []),
    # ── Abrogation et vigueur ─────────────────────────────────────────────────
    "Abrogation de la circulaire 105-1 du 3 avril 2017": (["12"], []),
    "Entrée en vigueur au 15 octobre 2025": (["12"], []),
    # ── Annexe 1 : transfert des fichiers ─────────────────────────────────────
    "Spécifications de transfert des fichiers": ([], ["sec-2", "sec-3"]),
    "Protocole SFTP/SSH et adresse IP du serveur": ([], ["sec-4"]),
    "Liaison VPN, WIMAX, fibre optique ou VSAT": ([], ["sec-4"]),
    "Routage et règles d'accès certifiés par la BRH": ([], ["sec-4"]),
    "Nomenclature des noms de fichiers": ([], ["sec-4", "sec-8"]),
    "Logiciels de transfert (WinSCP, FileZilla, SSH Secure File Transfer)": ([], ["sec-5"]),
    "Authentification et registre des accès (log)": ([], ["sec-5"]),
    "Répertoires dédiés par institution (cloisonnement)": ([], ["sec-6"]),
    # ── Annexe 2 : fichiers de collecte ───────────────────────────────────────
    "Fichier ent_resp_act_credit (entreprise, responsable, actionnaire, crédit)": ([], ["sec-9"]),
    "Fichier ind_emp_credit (individu, emploi, crédit)": ([], ["sec-10"]),
    "Fichier credit_surete (crédit et garanties)": ([], ["sec-11"]),
    "Fichier credit_activite (crédit et activité)": ([], ["sec-12"]),
    "Fichier ent_cheque (chèques des entreprises)": ([], ["sec-13"]),
    "Fichier ind_cheque (chèques des individus)": ([], ["sec-14"]),
    "Abréviations des types de crédit (PT, LC, MC, CC, MCL)": ([], ["sec-9", "sec-10"]),
    "Segments obligatoires et optionnels": ([], ["sec-9", "sec-10", "sec-11", "sec-12"]),
    "Numéro d'identification fiscale (NIF)": ([], ["sec-9", "sec-10"]),
    "Carte d'identification nationale (CIN)": ([], ["sec-9", "sec-10"]),
    "Numéro de patente": ([], ["sec-9"]),
    "Permis de conduire et passeport (identifiants admis)": ([], ["sec-9", "sec-10"]),
    "Personne autorisée à engager l'entreprise": ([], ["sec-9"]),
    "Actionnaires (données collectées)": ([], ["sec-9"]),
    "Types de prêt (PCN, PLT, PCL, LC, PC-CC, PC-ED, PL-AG, PL-CB, PRI)": ([], ["sec-9"]),
    "Classification des prêts (courant, à signaler, faible, douteux, perte, fermé)": ([], ["sec-9", "sec-24"]),
    "Date d'octroi, date de maturité et périodicité": ([], ["sec-9"]),
    "Montant autorisé et devise (HTG, USD)": ([], ["sec-9"]),
    "Période de grâce du crédit (sursis d'amortissement)": ([], ["sec-9"]),
    # ── Annexe 3 : données de référence ───────────────────────────────────────
    "Données de référence (nomenclatures)": ([], ["sec-15"]),
    "Secteurs d'activités (codes)": ([], ["sec-16"]),
    "Communes (codes IHSI)": ([], ["sec-17"]),
    "Pays (codes ISO)": ([], ["sec-18"]),
    "Formes juridiques (codes)": ([], ["sec-19"]),
    "Types de sûreté": ([], ["sec-20"]),
    "Nature des garanties": ([], ["sec-21"]),
    "Codes postaux": ([], ["sec-22"]),
    "Professions (nomenclature)": ([], ["sec-23"]),
    "Statuts des crédits (codes)": ([], ["sec-24"]),
    "Responsabilité envers le crédit (codes R01 à R-Z)": ([], ["sec-25"]),
    "Client décédé, relation terminée, effacement du client": ([], ["sec-25"]),
    "Crédit solidaire et responsabilité commerciale": ([], ["sec-25"]),
}


def main() -> None:
    for subject, (ct, sec) in IDX.items():
        assert ct or sec, f"entrée sans renvoi : « {subject} »"
        for r in ct:
            assert r in POINTS, f"renvoi mort « {r} » dans « {subject} »"
        for r in sec:
            assert r in SECS, f"renvoi mort « {r} » dans « {subject} »"
    cov_ct = {r for ct, _ in IDX.values() for r in ct}
    cov_sec = {r for _, sec in IDX.values() for r in sec}
    miss_ct = [p for p in POINTS if p not in cov_ct]
    miss_sec = [s for s in SECS if s not in cov_sec]
    assert not miss_ct, f"points non couverts : {miss_ct}"
    assert not miss_sec, f"annexes non couvertes : {miss_sec}"
    seen = set()
    for subject, (ct, sec) in IDX.items():
        key = (subject.lower(), tuple(sorted(ct)), tuple(sorted(sec)))
        assert key not in seen, f"entrée en double : « {subject} »"
        seen.add(key)

    entries = []
    for s, (ct, sec) in sorted(IDX.items(), key=lambda kv: kv[0].lower()):
        e: dict = {"subject": s, "ctRefs": [r.replace(".", "-") for r in ct]}
        if sec:
            # docId injecté à l'import (le document ne s'identifie qu'une fois créé).
            e["secRefs"] = [{"label": SECS[a], "anchor": a} for a in sec]
        entries.append(e)
    json.dump(entries, open(f"{OUT}/_index.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"✓ index 105-2 : {len(entries)} sujets · corps {len(cov_ct)}/{len(POINTS)} · "
          f"annexes {len(cov_sec)}/{len(SECS)} · 0 renvoi mort")


if __name__ == "__main__":
    main()
