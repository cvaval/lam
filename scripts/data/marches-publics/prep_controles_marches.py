#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Contrôles de la tâche 2 (lecteur annoté) — s'exécute APRÈS `prep_lecteur_marches.py`.

Quatre contrôles, tous en assertions (un échec arrête le script) :
 1. LOI-MÈRE — confrontation du `toc` LU DU CORPS avec la table des matières fournie
    par la cliente : la table sert de CONTRÔLE, jamais de source. Produit en outre les
    PLAGES D'ARTICLES de chaque rubrique, dérivées du corps (assertions réversibles).
 2. HORS-CORPUS — aucune des sentinelles des actes non versés (arrêté Delmas,
    nominations BNC/BNDA/CNAL, commissions municipales, circulaire 009 CIN, Extraits
    du Registre des Marques) n'apparaît dans un corps préparé.
 3. SICS — les sentinelles verbatim exigées au § 11.11 sont présentes là où elles
    doivent l'être et absentes ailleurs.
 4. TYPOGRAPHIE — apostrophes et exposants Unicode mesurés PAR CORPS (§ 9.3).
 5. VERBATIM — toute ligne du corps préparé, hors en-têtes joints, figure TELLE QUELLE
    dans l'extraction source ; et le compte des lignes s'explique exactement par
    segments − retraits − lignes absorbées par les jointures (tabulations comprises).
"""
import glob
import json
import os
import re
import unicodedata

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = HERE  # pièces canoniques `piece-*.txt`


def norm(s: str) -> str:
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", " ", s).strip()


def fiches():
    out = []
    for f in sorted(glob.glob(os.path.join(HERE, "prep-[0-9][0-9]-*.json"))):
        if f.endswith("-confrontation-tdm.json"):
            continue
        d = json.load(open(f, encoding="utf-8"))
        d["_corps"] = open(f[:-5] + "-corps.txt", encoding="utf-8").read()
        out.append(d)
    return out


# ── 1. LOI-MÈRE : la table des matières de la cliente comme CONTRÔLE ───────────────
def controle_loi(loi):
    tdm = [l.strip() for l in open(os.path.join(SRC, "piece-00-loi-2009-table-matieres.txt"),
                                   encoding="utf-8").read().split("\n") if l.strip()]
    rubriques = [l for l in tdm if re.match(r"^(TITRE|CHAPITRE|Section)\s", l)]
    toc = loi["toc"]
    assert len(rubriques) == len(toc), (
        f"loi-mère : {len(rubriques)} rubriques à la table de la cliente contre "
        f"{len(toc)} en-têtes lus du corps")
    ecarts = [(i, toc[i]["label"], rubriques[i]) for i in range(len(toc))
              if norm(toc[i]["label"]) != norm(rubriques[i])]
    assert not ecarts, f"loi-mère : rubriques discordantes (hors casse/accents) : {ecarts[:3]}"

    # plages d'articles par rubrique, DÉRIVÉES DU CORPS (la table de la cliente n'en
    # porte aucune : une seule colonne « Rubrique », mesuré sur le .docx)
    lignes = loi["_corps"].split("\n")
    labels_par_ancre = loi["labels"]
    plages, courant, vus = [], None, []
    ordre_toc = [e["label"] for e in toc]
    ptr = 0
    for ligne in lignes:
        t = ligne.strip()
        if ptr < len(ordre_toc) and re.sub(r"\s+", " ", t) == re.sub(r"\s+", " ", ordre_toc[ptr]):
            if courant is not None:
                plages.append({"rubrique": courant, "articles": vus[0] if vus else None,
                               "jusqu_a": vus[-1] if vus else None, "nombre": len(vus)})
            courant, vus, ptr = ordre_toc[ptr], [], ptr + 1
            continue
        m = re.match(r"^(Articles?\s+[^\s.\-:]+(?:[.\-]\d+)*)", t)
        if m and courant is not None:
            vus.append(m.group(1).rstrip(".-").strip())
    if courant is not None:
        plages.append({"rubrique": courant, "articles": vus[0] if vus else None,
                       "jusqu_a": vus[-1] if vus else None, "nombre": len(vus)})
    total = sum(p["nombre"] for p in plages)
    assert total == len(labels_par_ancre), (
        f"loi-mère : {total} articles répartis dans les rubriques contre "
        f"{len(labels_par_ancre)} ancres — des articles tombent hors rubrique")
    return {"rubriques_table_cliente": len(rubriques), "entetes_lus_du_corps": len(toc),
            "discordances": ecarts,
            "table_cliente_porte_des_plages_d_articles": False,
            "note": "la table des matières fournie ne comporte QU'UNE colonne « Rubrique » "
                    "(mesuré sur word/document.xml : 1 tableau, 54 lignes, 1 cellule par "
                    "ligne) : aucune plage d'articles n'y figure. Les plages ci-dessous "
                    "sont DÉRIVÉES DU CORPS et valent assertion réversible.",
            "plages": plages}


# ── 2. HORS-CORPUS ────────────────────────────────────────────────────────────────
SENTINELLES_HORS_CORPUS = [
    ("Delmas — arrêté d'utilité publique", "Est déclaré d’utilité publique un terrain"),
    ("Delmas — objet", "Avenue Maïs Gâté"),
    ("nomination BNC", "Conseil d’Administration a.i. de la Banque Nationale de Crédit"),
    ("nomination BNDA", "Banque Nationale de Développement Agricole (BNDA)"),
    ("nomination CNAL", "Judy BAZILE"),
    ("commission municipale Grand-Bassin", "Commune de Grand-Bassin"),
    ("commission municipale Pointe-à-Raquette", "Pointe-à-Raquette"),
    ("commission municipale St Raphaël", "Commune de St Raphaël"),
    ("commission municipale Verrettes", "Commune de Verrettes"),
    ("circulaire 009 CIN", "CIRCULAIRE NO 009"),
    ("Registre des Marques (n° 221)", "Registre des Marques de Fabrique"),
    ("AVIS commercial des Presses Nationales (n° 221)", "l’Abonnement est fixé à vingt-cinq mille"),
]


def controle_hors_corpus(fs):
    trouve = []
    for d in fs:
        for nom, s in SENTINELLES_HORS_CORPUS:
            if s in d["_corps"]:
                trouve.append((d["id"], nom))
    assert not trouve, f"hors-corpus présent dans un corps préparé : {trouve}"
    return {"sentinelles_testees": len(SENTINELLES_HORS_CORPUS), "occurrences": 0}


# ── 3. SICS — sentinelles verbatim ────────────────────────────────────────────────
SICS = [
    ("04", "Articles 30.-", True, "pluriel sic du J.O. (§ 9.1) — ancré art-30"),
    ("19", "227.1", True, "graphie à POINT du modificatif (§ 9.3)"),
    ("02", "227-1", True, "graphie à TRAIT D'UNION du texte de base (§ 9.3)"),
    ("01", "Article 19.1-", True, "décimale à point du décret de 2004"),
    ("04", "Article 15.1", True, "décimale à point, seule de l'arrêté org/fonct"),
    ("09", "Article 5.1", True, "décimale à point de la Charte annexée"),
    ("21", "Article 16.1.-", True, "décimale à point du décret de 2021"),
    ("23", "l’Arrêté du 21 octobre 2021 fixant les seuils de passation des marchés publics "
           "et les seuils d’intervention de la Commission Nationale des Marchés Publics", True,
     "art. 7-1 : intitulé DIVERGENT de celui du Spécial 52 (§ 6, énigme non tranchée) — "
     "jamais normalisé"),
    ("23", "l’Arrêté du 21 octobre 2021 fixant les seuils de passation des marchés publics "
           "en dessous des seuils d’intervention de la CNMP", True,
     "visa du même arrêté, intitulé EXACT — la divergence est interne au texte n° 23"),
    ("00", "notamment la Loi du 16 septembre 1953 sur l'adjudication, le Décret du "
           "3 décembre 2004 fixant la réglementation des Marchés Publics", True,
     "art. 99 : la clause d'abrogation NOMMÉE, fondement des trois arêtes ABROGE (§ 5) — "
     "apostrophes DROITES dans ce corps"),
    ("00", "Donnée à la Chambre des Députés à Port-au-Prince, le mercredi 10 juin 2009", True,
     "bloc « Donné » de la Chambre — le « 10 juin 2009 » du nom d'usage"),
    ("00", "Donnée au Palais National, à Port-au-Prince, le 12 juin 2009", True,
     "promulgation présidentielle du 12 juin — NON retenue comme adoptionDate (décision "
     "expresse de Me Vaval, § 5)"),
    ("00", "(Reproduction pour erreurs matérielles)", True,
     "la pièce est la reproduction n° 78 ; le renvoi au n° 60 reste mentionné, non tranché"),
]


def controle_sics(fs):
    par_id = {d["id"]: d for d in fs}
    res = []
    for tid, frag, exige, note in SICS:
        d = par_id[tid]
        n = d["_corps"].count(frag)
        if exige:
            assert n >= 1, f"sic absent du texte {tid} : « {frag} »"
        res.append({"texte": tid, "fragment": frag, "occurrences": n, "note": note})
    return res


# ── 4. TYPOGRAPHIE ────────────────────────────────────────────────────────────────
def controle_typo(fs):
    out = []
    for d in fs:
        c = d["_corps"]
        out.append({
            "texte": d["id"], "slug": d["slug"],
            "apostrophe_droite": c.count("'"), "apostrophe_courbe": c.count("’"),
            "mixte": c.count("'") > 0 and c.count("’") > 0,
            "exposants_unicode": {x: c.count(x) for x in ("ᵉ", "ʳ", "º", "ᴱ") if c.count(x)},
            "tabulations": c.count("\t"), "nbsp": c.count(" "),
        })
    return out


# ── 5. VERBATIM ───────────────────────────────────────────────────────────────────
def controle_verbatim(fs):
    out = []
    for d in fs:
        src = open(os.path.join(SRC, d["source"]["fichier"]), encoding="utf-8").read().split("\n")
        corps = d["_corps"].split("\n")
        joints = {j["libelle"] for j in d["jointures_entetes"]}
        dans_segment = set()
        for a, b in d["decoupe"]["segments"]:
            dans_segment.update(range(a, min(b, len(src)) + 1))
        n_seg = len(dans_segment)
        n_ret = len([r for r in d["decoupe"]["retraits"] if r["ligne_source"] in dans_segment])
        n_join = sum(j["lignes_jointes"] - 1 for j in d["jointures_entetes"])
        attendu = n_seg - n_ret - n_join
        assert attendu == len(corps), (
            f"texte {d['id']} : {len(corps)} lignes de corps, {attendu} attendues "
            f"({n_seg} segmentées − {n_ret} retraits − {n_join} absorbées par jointure)")
        connus = set(src)
        absentes = [l for l in corps if l not in connus and l not in joints]
        assert not absentes, (
            f"texte {d['id']} : {len(absentes)} ligne(s) de corps absentes de la source "
            f"(ex. « {absentes[0][:70]} »)")
        tab_src = sum(src[n - 1].count("\t") for n in sorted(dans_segment))
        tab_corps = sum(l.count("\t") for l in corps)
        assert tab_src == tab_corps, (
            f"texte {d['id']} : {tab_corps} tabulations au corps contre {tab_src} à la source")
        out.append({"texte": d["id"], "lignes_corps": len(corps), "lignes_segmentees": n_seg,
                    "retraits": n_ret, "absorbees_par_jointure": n_join, "tabulations": tab_corps})
    return out


# ── Tableau des comptes, texte par texte ──────────────────────────────────────────
def tableau(fs):
    rows = []
    for d in fs:
        donne = [l.strip() for l in d["_corps"].split("\n")
                 if re.match(r"^\s*Donn[ée]e?\b", l.strip())]
        rows.append({
            "id": d["id"], "slug": d["slug"], "titre_provisoire": d["titre_provisoire"],
            "piece_source": d["source"]["fichier"], "md5_piece": d["source"]["md5_txt"],
            "md5_corps": d["md5_corps"],
            "lignes_corps": d["comptes"]["lignes_corps"],
            "toc": d["comptes"]["toc"], "labels": d["comptes"]["labels"],
            "ancres_emises": d["comptes"]["ancres_emises"],
            "tetes_sans_ancre": d["comptes"]["tetes_article_sans_ancre_annexe_ou_doublon"],
            "navToc_groupes": d["comptes"]["navToc_groupes"],
            "blocs_Donne": len(donne),
            "retraits_editeur": len(d["decoupe"]["retraits"]),
            "jointures_entetes": len(d["jointures_entetes"]),
            "apostrophes": d["apostrophes"],
            "gardes_toutes_vertes": all(d["gardes"].values()),
        })
    return rows


def main():
    fs = fiches()
    loi = next(d for d in fs if d["id"] == "00")
    conf = controle_loi(loi)
    with open(os.path.join(HERE, "prep-00-loi-mere-2009-confrontation-tdm.json"), "w",
              encoding="utf-8") as f:
        json.dump(conf, f, ensure_ascii=False, indent=1)
    rapport = {
        "loi_mere": {k: v for k, v in conf.items() if k != "plages"},
        "hors_corpus": controle_hors_corpus(fs),
        "sics": controle_sics(fs),
        "typographie": controle_typo(fs),
        "verbatim": controle_verbatim(fs),
    }
    tab = tableau(fs)
    with open(os.path.join(HERE, "prep-tableau-comptes.json"), "w", encoding="utf-8") as f:
        json.dump(tab, f, ensure_ascii=False, indent=1)
    with open(os.path.join(HERE, "prep-controles.json"), "w", encoding="utf-8") as f:
        json.dump(rapport, f, ensure_ascii=False, indent=1)
    print(f"✓ loi-mère : {conf['rubriques_table_cliente']} rubriques de la table cliente "
          f"= {conf['entetes_lus_du_corps']} en-têtes du corps, 0 discordance ; "
          f"{len(conf['plages'])} plages d'articles dérivées du corps")
    print(f"✓ hors-corpus : {rapport['hors_corpus']['sentinelles_testees']} sentinelles testées, "
          f"0 occurrence dans les 25 corps préparés")
    print("✓ sics :")
    for s in rapport["sics"]:
        print(f"    texte {s['texte']} · « {s['fragment'][:52]} » × {s['occurrences']}")
    mixtes = [t["slug"] for t in rapport["typographie"] if t["mixte"]]
    print(f"✓ typographie : corps à apostrophes MIXTES = {mixtes or 'aucun'}")
    exp = [(t["slug"], t["exposants_unicode"]) for t in rapport["typographie"] if t["exposants_unicode"]]
    print(f"  exposants Unicode : {exp or 'aucun'}")
    v = rapport["verbatim"]
    print(f"✓ verbatim : {len(v)} corps, 0 ligne étrangère à la source, "
          f"{sum(x['tabulations'] for x in v)} tabulations conservées, "
          f"{sum(x['retraits'] for x in v)} lignes d'éditeur retirées, "
          f"{sum(x['absorbees_par_jointure'] for x in v)} lignes absorbées par les jointures d'en-tête")
    print("\nTableau des comptes (prep-tableau-comptes.json)")
    print(f"{'#':<3} {'slug':<36} {'lgn':>5} {'toc':>4} {'lbl':>4} {'anc':>4} {'s/anc':>5} "
          f"{'nav':>4} {'Don':>3} {'ret':>3} {'jnt':>3}")
    for r in tab:
        print(f"{r['id']:<3} {r['slug']:<36} {r['lignes_corps']:>5} {r['toc']:>4} "
              f"{r['labels']:>4} {r['ancres_emises']:>4} {r['tetes_sans_ancre']:>5} "
              f"{r['navToc_groupes']:>4} {r['blocs_Donne']:>3} {r['retraits_editeur']:>3} "
              f"{r['jointures_entetes']:>3}")
    assert all(r["gardes_toutes_vertes"] for r in tab), "une garde de segmentation est rouge"


if __name__ == "__main__":
    main()
