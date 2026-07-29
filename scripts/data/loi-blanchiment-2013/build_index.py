#!/usr/bin/env python3
# INDEX ALPHABÉTIQUE DÉTAILLÉ — Loi sanctionnant le blanchiment de capitaux et le
# financement du terrorisme (Loi du 11 novembre 2013, Le Moniteur n° 212 du
# 14 novembre 2013). Index rédigé après lecture INTÉGRALE des 88 articles
# (86 articles + 82.1 et 82.2) ; aucun sujet n'est tiré d'un intitulé seul.
# Produit _index.json. Assertions : 0 renvoi mort, couverture 88/88.
from __future__ import annotations

import json
import os

OUT = os.path.dirname(os.path.abspath(__file__))
VALID = [str(n) for n in range(1, 87)] + ["82-1", "82-2"]

IDX: dict[str, list[str]] = {
    # ── Titre 1er : généralités, champ d'application, définitions ──────────────
    "Objet de la loi (prévention et répression)": ["1"],
    "Institutions financières assujetties (banques, assurances, cartes de crédit, coopératives, agents de change, maisons de transfert)": ["2", "4"],
    "Entreprises et professions non financières assujetties (casinos, ONG, immobilier, notaires, avocats, comptables)": ["3", "4"],
    "Casinos, loteries, borlette et établissements de jeux": ["3", "29"],
    "Notaires, avocats et comptables (obligations)": ["3", "19"],
    "Négociants en métaux et pierres précieuses": ["3"],
    "Concessionnaires de véhicules": ["3"],
    "Prestataires de services aux sociétés et fiducies": ["3"],
    "Définitions": ["4"],
    "Acte terroriste (définition et conventions internationales)": ["4"],
    "Biens (définition)": ["4"],
    "Confiscation (définition)": ["4", "64"],
    "Saisie (définition)": ["4", "55"],
    "Gel (définition)": ["4", "47"],
    "Haute direction (définition et autorisations)": ["4", "15", "24"],
    "Infraction grave (définition)": ["4"],
    "Infraction sous-jacente": ["4", "6", "8"],
    "Organismes à but non lucratif (définition et obligations)": ["4", "27", "28"],
    "Organisation terroriste (définition)": ["4", "47", "66"],
    "Personne politiquement exposée (PPE)": ["4", "15"],
    "Produit d'une activité criminelle": ["4", "5", "65"],
    "Terroriste (définition)": ["4", "47"],
    "Virement électronique (définition et obligations)": ["4", "21", "22"],
    # ── Titre II : incriminations ─────────────────────────────────────────────
    "Blanchiment de capitaux (définition)": ["5"],
    "Conversion ou transfert de biens d'origine criminelle": ["5"],
    "Dissimulation ou déguisement de l'origine des biens": ["5"],
    "Acquisition, détention ou utilisation de biens illicites": ["5"],
    "Élément intentionnel (déduction de circonstances factuelles)": ["5", "6"],
    "Financement du terrorisme (définition)": ["6"],
    "Tentative, complicité et incitation": ["6", "57"],
    "Absence de justification politique, religieuse ou idéologique": ["7"],
    "Origine illicite des capitaux (infractions sous-jacentes énumérées)": ["8"],
    "Trafic illicite de stupéfiants": ["8"],
    "Trafic illicite d'armes": ["8"],
    "Traite des êtres humains et trafic de migrants": ["8"],
    "Exploitation sexuelle, y compris des enfants": ["8"],
    "Corruption et détournement de fonds publics (infraction sous-jacente)": ["8"],
    "Contrefaçon de monnaie et de titres": ["8"],
    "Trafic d'organes humains": ["8"],
    "Enlèvement, séquestration et prise d'otages": ["8"],
    "Contrebande, extorsion et pillage des richesses": ["8"],
    "Compétence territoriale (lieu de commission indifférent)": ["9"],
    # ── Titre II, chap. III : prévention ──────────────────────────────────────
    "Déclaration d'espèces aux frontières (entrée et sortie du territoire)": ["10", "50", "54"],
    "Administration Générale des Douanes (transmission à l'UCREF)": ["10", "51", "56"],
    "Déclaration des transactions en espèces à l'UCREF": ["11", "33"],
    "Montant règlementaire fixé par la BRH": ["12", "17", "20", "33"],
    "Vigilance permanente sur les relations d'affaires": ["13"],
    "Comptes anonymes ou sous noms fictifs (interdiction)": ["13"],
    "Pays appliquant insuffisamment les normes internationales": ["13"],
    "Client non physiquement présent (relations à distance)": ["14"],
    "Systèmes de gestion des risques": ["15", "26"],
    "Programmes internes de prévention (politiques, procédures, contrôles)": ["16"],
    "Officier ou agent de conformité": ["16"],
    "Formation continue des employés": ["16"],
    "Identification et vérification de l'identité des clients": ["17", "18", "25"],
    "Opérations occasionnelles et transferts de fonds": ["17"],
    "Transactions multiples liées entre elles": ["11", "17"],
    "Identification d'une personne physique (documents exigés)": ["18"],
    "Identification d'une personne morale (dénomination, siège, dirigeants)": ["18"],
    "Bénéficiaire effectif et véritable donneur d'ordre": ["19", "21"],
    "Secret professionnel inopposable pour l'identification du donneur d'ordre": ["19"],
    "Opérations complexes ou sans justification économique (rapport confidentiel)": ["20"],
    "Virements électroniques (mentions obligatoires)": ["21"],
    "Virements reçus incomplets (obtention des informations manquantes)": ["22"],
    "Conservation des documents (cinq ans)": ["23", "28", "29"],
    "Correspondant bancaire transfrontalier": ["24"],
    "Banque fictive (interdiction de relation)": ["24"],
    "Filiales à l'étranger (mesures compatibles)": ["24"],
    "Assurance vie (identification des souscripteurs)": ["25"],
    "Obligations simplifiées ou réduites (approche par les risques)": ["26"],
    "Organismes à but non lucratif (surveillance et transparence)": ["27", "28"],
    "États financiers publiés annuellement (OBNL)": ["28"],
    "Casinos (registre des joueurs et des transferts, jetons)": ["29"],
    "Opérations immobilières (identification des parties)": ["30"],
    # ── Titre II, chap. IV : détection ────────────────────────────────────────
    "Déclaration de soupçon à l'UCREF": ["31", "32", "44"],
    "Opérations refusées (déclaration obligatoire)": ["19", "31"],
    "Forme et procédure des déclarations (règlement de l'UCREF)": ["32"],
    "Outils informatiques de détection et rapports automatiques": ["33", "60"],
    "Opposition de l'UCREF (quarante-huit heures)": ["34"],
    "Gel ordonné par l'UCREF (dix jours)": ["34", "43"],
    "Rapport de l'UCREF au Commissaire du Gouvernement": ["35"],
    "Protection de l'identité du déclarant": ["35"],
    "Communication des renseignements aux autorités judiciaires et à la BRH": ["36"],
    "Interdiction de divulgation au client (tipping off)": ["37"],
    # ── Titre III : enquêtes et secret professionnel ──────────────────────────
    "Techniques spéciales d'enquête (juge d'instruction)": ["38", "39"],
    "Surveillance des comptes bancaires": ["38"],
    "Accès aux systèmes, réseaux et serveurs informatiques": ["38"],
    "Interception et saisie du courrier": ["38"],
    "Enregistrement audio, vidéo et photographie": ["38"],
    "Immunité des fonctionnaires enquêteurs et sanctions en cas de détournement": ["39"],
    "Protection et anonymat des témoins": ["40"],
    "Faux témoignage (levée de l'anonymat)": ["40"],
    "Exonération de poursuite pour violation du secret bancaire": ["41", "45"],
    "Irresponsabilité civile et pénale du déclarant de bonne foi": ["42", "43", "44"],
    "Secret professionnel des agents de l'UCREF (article 323 du Code pénal)": ["45"],
    # ── Titre IV : mesures conservatoires ─────────────────────────────────────
    "Mesures conservatoires du juge d'instruction et mainlevée": ["46", "81"],
    "Gel des fonds des terroristes (Conseil de sécurité des Nations Unies)": ["47"],
    "Arrêté ministériel de gel (conditions et durée)": ["47", "48"],
    "Interdictions attachées au gel (mise à disposition, services)": ["48"],
    "Contrats antérieurs au gel (fonds dus, fruits et intérêts)": ["49"],
    "Déclaration écrite de transport international de monnaies": ["50"],
    "Pouvoirs des agents des douanes (immobilisation, perquisition, retenue)": ["51"],
    "Visite des personnes (interrogatoire, fouille des bagages)": ["52"],
    "Visite corporelle (agent du même sexe, hygiène et décence)": ["53"],
    "Déclaration inexacte ou incomplète (non exécutée)": ["54"],
    "Saisie douanière des espèces et procès-verbal": ["55"],
    "Caisse des Dépôts et Consignations (dépôt des espèces saisies)": ["56"],
    # ── Titre IV, chap. II : sanctions ────────────────────────────────────────
    "Peines du blanchiment et du financement du terrorisme (3 à 15 ans)": ["57", "61"],
    "Amendes (500 000 à 100 000 000 de gourdes)": ["57"],
    "Personnes morales (amende quintuple et peines complémentaires)": ["58"],
    "Interdiction d'activité, fermeture et dissolution (personnes morales)": ["58"],
    "Diffusion de la décision par la presse": ["58"],
    "Défaut de vigilance et carence des procédures internes": ["59"],
    "Sanctions administratives de l'autorité de contrôle": ["59", "60"],
    "Omission de déclaration de soupçon (sanction)": ["60"],
    "Règlements en espèces au-delà du montant autorisé": ["60"],
    "Manquements aux obligations de transfert international de fonds": ["60"],
    "Circonstances atténuantes": ["62"],
    "Réduction de peine pour coopération avec la justice": ["63"],
    "Confiscation après condamnation définitive": ["64"],
    "Confiscation en valeur et biens non représentés": ["64"],
    "Confiscation sans condamnation (auteurs inconnus ou non poursuivis)": ["65"],
    "Confiscation des biens d'une organisation criminelle ou terroriste": ["66"],
    "Nullité des actes visant à soustraire des biens à la confiscation": ["67"],
    "Dévolution à l'État des biens confisqués et droits des tiers": ["68"],
    "Fonds spécial de lutte contre le crime organisé": ["68", "69"],
    "Vente aux enchères des biens saisis": ["69"],
    # ── Titre IV, chap. III : juridiction ─────────────────────────────────────
    "Substituts spécialisés en infractions financières": ["70", "71", "73", "75"],
    "Tribunaux correctionnels (compétence)": ["72"],
    "Saisine (dénonciation, plainte, demande de l'UCREF)": ["73"],
    "Juge d'instruction spécialisé en infractions financières": ["74", "76", "77"],
    "Réquisitoire d'informer": ["75"],
    "Mandats et ordonnance motivée": ["77"],
    "Appel et pourvoi en cassation": ["78"],
    # ── Titre V : entraide judiciaire ─────────────────────────────────────────
    "Entraide judiciaire (demandes des États étrangers)": ["79", "80"],
    "Mesures conservatoires sur demande étrangère": ["81"],
    "Confiscation sur demande étrangère": ["82", "83"],
    "Sauvegarde constitutionnelle et indépendance des pouvoirs": ["82-1"],
    "Secret professionnel de l'avocat et inviolabilité du cabinet": ["82-1"],
    "Juge doyen (contrôle de la légalité des arrestations et détentions)": ["82-2"],
    "Sursis aux mesures privatives de liberté": ["82-2"],
    "Extradition": ["84"],
    # ── Titre VI : dispositions transitoires et finales ───────────────────────
    "Délais de mise en conformité (UCREF et BRH)": ["85"],
    "Clause abrogatoire et exécution": ["86"],
    # ── Institutions et acteurs (entrées transversales) ───────────────────────
    "UCREF — Unité Centrale de Renseignements Financiers": ["10", "11", "31", "32", "34", "35", "45", "73", "77", "85"],
    "BRH — Banque de la République d'Haïti": ["10", "12", "26", "36", "85"],
    "Ministère de la Justice et de la Sécurité Publique": ["47", "71", "86"],
    "Ministère de l'Économie et des Finances": ["25", "29", "47", "86"],
    "Commissaire du Gouvernement": ["35"],
    "Ministère public (mainlevée, confiscation)": ["46", "65"],
}

for s, refs in IDX.items():
    for r in refs:
        assert r in VALID, f"renvoi mort {r} dans « {s} »"
covered = {r for refs in IDX.values() for r in refs}
missing = [v for v in VALID if v not in covered]
assert not missing, f"articles non couverts : {missing}"
entries = [{"subject": s, "ctRefs": refs} for s, refs in sorted(IDX.items(), key=lambda kv: kv[0].lower())]
json.dump(entries, open(f"{OUT}/_index.json", "w"), ensure_ascii=False, indent=1)
print(f"✓ index blanchiment : {len(entries)} sujets · couverture {len(covered)}/{len(VALID)} · 0 renvoi mort")
