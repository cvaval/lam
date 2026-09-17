/**
 * L'appareil LISIBLE derrière un user-agent — pour le journal des connexions.
 *
 * Sans bibliothèque : les familles vues au journal de production tiennent en une table, et une
 * analyse d'UA complète est une surface de plus à maintenir pour neuf comptes. Ce que la table
 * ne reconnaît pas se dit « navigateur non reconnu » — jamais un nom plausible (règle 1 du
 * projet : le journal ne dit que ce qu'il sait) — et l'UA brut reste consultable à côté.
 *
 * ⚠️ L'ORDRE DES TESTS EST TOUTE LA DIFFICULTÉ. Un navigateur se réclame de ses ancêtres :
 * Edge se dit Chrome, Chrome se dit Safari, le navigateur intégré de l'application Claude se dit
 * Chrome ET Safari, un iPhone se dit « like Mac OS X », Android se dit Linux. On teste donc du
 * plus spécifique au plus général, et chaque test de la suite verrouille un de ces pièges.
 *
 * ⚠️ FIGÉ À LA CRÉATION. `Session.deviceLabel` est calculé quand la session naît et jamais
 * recalculé : si cette table s'améliore, les anciennes lignes gardent ce qui a été lu à
 * l'époque. Une description ne se réécrit pas rétroactivement.
 */
export interface Appareil {
  /** « Safari 26 », « Chrome 153 », « Claude (Electron) »… ou « navigateur non reconnu ». */
  navigateur: string
  /** « macOS », « Windows », « iPhone », « iPad », « Android », « Linux » ou « ? ». */
  systeme: string
  type: 'ordinateur' | 'mobile' | 'tablette' | 'inconnu'
  /** Phrase prête à afficher : « Chrome 153 sur Windows ». */
  libelle: string
  /** false → l'écran montre l'UA brut à côté. */
  reconnu: boolean
}

const NON_RECONNU: Appareil = { navigateur: 'navigateur non reconnu', systeme: '?', type: 'inconnu', libelle: 'Navigateur non reconnu', reconnu: false }

/** Version majeure après un jeton (« Chrome/153.0.0.0 » → « 153 »), ou null. */
function majeure(ua: string, jeton: string): string | null {
  const m = new RegExp(`${jeton}/(\\d+)`).exec(ua)
  return m ? m[1] : null
}
const avecVersion = (nom: string, v: string | null) => (v ? `${nom} ${v}` : nom)

export function decrireAppareil(userAgent: string | null | undefined): Appareil {
  const ua = (userAgent ?? '').trim()
  // Un UA qui ne commence pas par « Mozilla/5.0 » n'est pas un navigateur : « node »,
  // « curl/8.7.1 » (vus au journal, tests de fumée). On ne devine rien.
  if (!/^Mozilla\/5\.0 \(/.test(ua)) return NON_RECONNU

  // ── Système : du plus spécifique au plus général ──
  let systeme = '?'
  let type: Appareil['type'] = 'inconnu'
  if (/iPhone/.test(ua)) { systeme = 'iPhone'; type = 'mobile' }
  else if (/iPad/.test(ua)) { systeme = 'iPad'; type = 'tablette' }
  else if (/Android/.test(ua)) { systeme = 'Android'; type = /Mobile/.test(ua) ? 'mobile' : 'tablette' }
  else if (/Windows NT/.test(ua)) { systeme = 'Windows'; type = 'ordinateur' }
  else if (/Mac OS X/.test(ua)) { systeme = 'macOS'; type = 'ordinateur' }
  else if (/CrOS/.test(ua)) { systeme = 'ChromeOS'; type = 'ordinateur' }
  else if (/Linux/.test(ua)) { systeme = 'Linux'; type = 'ordinateur' }

  // ── Navigateur : du plus spécifique au plus général ──
  let navigateur: string | null = null
  if (/Claude\//.test(ua) && /Electron\//.test(ua)) navigateur = 'Claude (Electron)'
  else if (/Electron\//.test(ua)) navigateur = 'Electron'
  else if (/Edg(?:e|A|iOS)?\//.test(ua)) navigateur = avecVersion('Edge', majeure(ua, 'Edg(?:e|A|iOS)?'))
  else if (/OPR\//.test(ua)) navigateur = avecVersion('Opera', majeure(ua, 'OPR'))
  else if (/SamsungBrowser\//.test(ua)) navigateur = avecVersion('Samsung Internet', majeure(ua, 'SamsungBrowser'))
  else if (/Firefox\//.test(ua) || /FxiOS\//.test(ua)) navigateur = avecVersion('Firefox', majeure(ua, 'Firefox') ?? majeure(ua, 'FxiOS'))
  else if (/CriOS\//.test(ua)) navigateur = avecVersion('Chrome', majeure(ua, 'CriOS'))
  else if (/Chrome\//.test(ua)) navigateur = avecVersion('Chrome', majeure(ua, 'Chrome'))
  // Safari : « Version/26.5 … Safari/605 » — la version utile est celle de « Version/ ».
  else if (/Safari\//.test(ua) && /Version\//.test(ua)) navigateur = avecVersion('Safari', majeure(ua, 'Version'))

  if (!navigateur) return { ...NON_RECONNU, systeme, type }
  return { navigateur, systeme, type, libelle: systeme === '?' ? navigateur : `${navigateur} sur ${systeme}`, reconnu: true }
}
