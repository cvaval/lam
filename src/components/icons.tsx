/**
 * ICÔNES — point de contact UNIQUE avec `lucide-react` (avenant AV-03, §3).
 *
 * Aucun autre fichier n'importe la bibliothèque : un changement de fournisseur se fait ici,
 * sans balayer le dépôt. Le motif du choix n'était ni le poids ni la forme — le jeu inline
 * était déjà dans l'idiome Lucide — mais la COHÉRENCE : un même rôle était dessiné de
 * plusieurs façons (deux entonnoirs, deux croix, deux tris, tous divergents).
 *
 * NOMMAGE — `Icon` + le rôle en français, en PascalCase. Le nom dit la FONCTION, jamais le
 * dessin : `IconSupprimer`, non `IconCorbeille`. Un dessin change, une fonction non. Le nom
 * Lucide d'origine reste visible dans l'alias, ce qui permet de retrouver la source.
 *
 * TAILLE — en classes Tailwind (`h-4 w-4` en tableau, `h-5 w-5` en bouton), jamais par
 * l'attribut `size`. GRAISSE — `strokeWidth={2}`. COULEUR — `currentColor` exclusivement :
 * une icône hérite de son contexte et ne porte jamais Wouj ni Sitwon en propre.
 *
 * ⚠ ACCESSIBILITÉ — deux cas, sans troisième. Décorative et doublée d'un texte visible :
 * `aria-hidden="true"`. Seule dans une cible cliquable : `aria-label` sur la CIBLE.
 * Et une icône ne porte JAMAIS seule un état — tout état s'accompagne de son libellé
 * (critère bloquant : Wouj et Vèt sont à 1,05:1 de luminance).
 */
export {
  // ── États et messages ──────────────────────────────────────────────────────
  /** Erreur de saisie et échec d'opération (AV-05, ch. 1). Jamais pour un avertissement. */
  CircleAlert as IconErreur,
  /** Avertissement non bloquant — l'action reste possible. */
  TriangleAlert as IconAvertissement,
  /** Succès, validation, confirmation de copie. Toujours accompagné de son libellé. */
  Check as IconSucces,
  /** En attente, différé. */
  Clock as IconAttente,

  // ── Recherche et navigation ────────────────────────────────────────────────
  Search as IconRechercher,
  TextSearch as IconRechercherTexte,
  History as IconRechercheRecente,
  ListFilter as IconFiltrer,
  ArrowUpWideNarrow as IconTrier,
  ChevronLeft as IconPrecedent,
  ChevronRight as IconSuivant,
  ChevronDown as IconDeplier,
  ArrowLeft as IconRetour,
  Menu as IconMenu,
  ExternalLink as IconOuvrirAilleurs,

  // ── Actions ────────────────────────────────────────────────────────────────
  /** Fermer, effacer, retirer — RÉVERSIBLE. Ne jamais l'employer pour supprimer. */
  X as IconFermer,
  /** Supprimer DÉFINITIVEMENT — irréversible. Porte toujours son libellé et une confirmation. */
  Trash2 as IconSupprimer,
  Plus as IconAjouter,
  Pencil as IconEditer,
  Copy as IconCopier,
  Upload as IconTeleverser,
  Download as IconTelecharger,
  Printer as IconImprimer,
  Save as IconEnregistrer,
  GripVertical as IconDeplacer,
  LogOut as IconDeconnexion,

  // ── Objets du corpus ───────────────────────────────────────────────────────
  FileText as IconDocument,
  Book as IconEdition,
  ScrollText as IconJournal,
  Landmark as IconJuridiction,
  Gavel as IconDecision,
  Quote as IconCiter,
  Star as IconMisEnAvant,
  Heart as IconFavori,
  Bell as IconVeille,
  BadgeCheck as IconVerifie,
  Ban as IconRevoquer,
  Ticket as IconCode,
  Calendar as IconDate,
  CalendarClock as IconEcheance,
  Map as IconCarte,
  MapPin as IconLocalisation,
  Image as IconImage,
  Table as IconTableau,
  User as IconUtilisateur,
  UserPlus as IconAjouterUtilisateur,
  UserX as IconSuspendre,
  Shield as IconHabilitation,
  Eye as IconPublier,
  EyeOff as IconDepublier,
  Activity as IconIndicateur,
} from 'lucide-react'
