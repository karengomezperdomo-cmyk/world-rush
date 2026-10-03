import type { Locale } from './locale';

/**
 * Every word the app says, in every language it speaks.
 *
 * English is the source: its object defines the key set, and each other language is typed as
 * `Record<MessageKey, string>`, so a missing translation is a compile error rather than an English word
 * appearing mid-sentence on a Spanish screen.
 *
 * Two rules carried over from the English copy, because translating is where they usually get lost:
 *
 * - **Say only what is true.** The Spanish must make the same claim as the English, not a friendlier one.
 *   "Your time only counts once the server has checked it" cannot become "your time counts".
 * - **Nothing describes a feature that does not exist.** If a key disappears from English because the thing
 *   stopped being true, it disappears here too.
 *
 * Keys read `screen.thing`. `{name}` placeholders are filled by `t(key, { name })`; a key ending `.one` or
 * `.other` is a count, chosen with `plural()`.
 */

const en = {
  'common.rider': 'RIDER',
  'common.tryAgain': 'TRY AGAIN',
  'common.backToHome': 'BACK TO HOME',
  'common.loading': 'LOADING…',

  'tabs.home': 'HOME',
  'tabs.leaderboard': 'LEADERBOARD',
  'tabs.howToPlay': 'HOW TO PLAY',
  'tabs.settings': 'SETTINGS',

  'offline.strip': 'OFFLINE · YOU CAN STILL RIDE, BUT NO TIME WILL BE RANKED',

  'boot.unreachable': 'Could not reach the game. Check your connection.',

  'home.todaysRace': "TODAY'S RACE",
  'home.map': 'MAP {number}',
  'home.raceEndsIn': 'RACE ENDS IN',
  'home.playNow': 'PLAY NOW',
  'home.viewLeaderboard': 'VIEW LEADERBOARD',
  'home.thisWeek': 'THIS WEEK',
  'home.sevenMapsSevenDays': '7 MAPS · 7 DAYS',
  'home.sevenLeaderboards': '7 LEADERBOARDS',
  'home.today': 'TODAY',
  'home.locked': 'LOCKED',
  'home.closed': 'CLOSED',
  'home.open': 'OPEN',

  'leaderboard.title': 'LEADERBOARD',
  'leaderboard.thisWeek': 'THIS WEEK',
  'leaderboard.live': 'LIVE',
  'leaderboard.final': 'FINAL',
  'leaderboard.freezesIn': 'FREEZES IN',
  'leaderboard.noLongerChanges': 'THIS BOARD NO LONGER CHANGES',
  'leaderboard.racers.one': '{count} RACER · ONE BEST TIME EACH',
  'leaderboard.racers.other': '{count} RACERS · ONE BEST TIME EACH',
  'leaderboard.behind': '{gap} BEHIND #{rank}',
  'leaderboard.you': 'YOU',
  'leaderboard.loadFailed': 'COULD NOT LOAD THE BOARD',
  'leaderboard.loadFailedDetail': 'Check your connection and try again.',
  'leaderboard.nobodyFinished': 'NOBODY FINISHED',
  'leaderboard.nobodyFinishedDetail': 'No verified time was set on this map before the day ended.',
  'leaderboard.nobodyYet': 'NOBODY HAS FINISHED YET',
  'leaderboard.nobodyYetDetail':
    'No verified time has been set on this map. The first one could be yours.',

  'settings.language': 'LANGUAGE',
  'settings.languageDetail': 'The app follows your phone unless you choose one here.',
  'settings.languageAuto': 'AUTO',
} as const;

export type MessageKey = keyof typeof en;

/**
 * Spanish. Decision A6 ships it alongside English from day one; World's guidelines list it second among the
 * languages their users speak.
 *
 * The register is deliberately the same as the English: short, blunt, no exclamation marks the English does
 * not have. Spanish is a longer language, so where a line has to fit a button or a chip the wording is cut
 * rather than the meaning.
 */
const es: Record<MessageKey, string> = {
  'common.rider': 'PILOTO',
  'common.tryAgain': 'REINTENTAR',
  'common.backToHome': 'VOLVER AL INICIO',
  'common.loading': 'CARGANDO…',

  'tabs.home': 'INICIO',
  'tabs.leaderboard': 'CLASIFICACIÓN',
  'tabs.howToPlay': 'CÓMO JUGAR',
  'tabs.settings': 'AJUSTES',

  'offline.strip': 'SIN CONEXIÓN · PUEDES CORRER, PERO NINGÚN TIEMPO PUNTUARÁ',

  'boot.unreachable': 'No se pudo conectar con el juego. Revisa tu conexión.',

  'home.todaysRace': 'CARRERA DE HOY',
  'home.map': 'MAPA {number}',
  'home.raceEndsIn': 'TERMINA EN',
  'home.playNow': 'JUGAR AHORA',
  'home.viewLeaderboard': 'VER CLASIFICACIÓN',
  'home.thisWeek': 'ESTA SEMANA',
  'home.sevenMapsSevenDays': '7 MAPAS · 7 DÍAS',
  'home.sevenLeaderboards': '7 CLASIFICACIONES',
  'home.today': 'HOY',
  'home.locked': 'BLOQUEADO',
  'home.closed': 'CERRADO',
  'home.open': 'ABIERTO',

  'leaderboard.title': 'CLASIFICACIÓN',
  'leaderboard.thisWeek': 'ESTA SEMANA',
  'leaderboard.live': 'EN VIVO',
  'leaderboard.final': 'FINAL',
  'leaderboard.freezesIn': 'SE CIERRA EN',
  'leaderboard.noLongerChanges': 'ESTA TABLA YA NO CAMBIA',
  'leaderboard.racers.one': '{count} PILOTO · SU MEJOR TIEMPO',
  'leaderboard.racers.other': '{count} PILOTOS · EL MEJOR TIEMPO DE CADA UNO',
  'leaderboard.behind': '{gap} DETRÁS DEL #{rank}',
  'leaderboard.you': 'TÚ',
  'leaderboard.loadFailed': 'NO SE PUDO CARGAR LA TABLA',
  'leaderboard.loadFailedDetail': 'Revisa tu conexión e inténtalo de nuevo.',
  'leaderboard.nobodyFinished': 'NADIE TERMINÓ',
  'leaderboard.nobodyFinishedDetail':
    'Nadie marcó un tiempo verificado en este mapa antes de que acabara el día.',
  'leaderboard.nobodyYet': 'TODAVÍA NO HA TERMINADO NADIE',
  'leaderboard.nobodyYetDetail':
    'Aún no hay ningún tiempo verificado en este mapa. El primero puede ser el tuyo.',

  'settings.language': 'IDIOMA',
  'settings.languageDetail': 'La app sigue el idioma de tu móvil salvo que elijas uno aquí.',
  'settings.languageAuto': 'AUTO',
};

export const MESSAGES: Record<Locale, Record<MessageKey, string>> = { en, es };

/** What each language calls itself — never translated, because that is how people recognise their own. */
export const LANGUAGE_NAMES: Record<Locale, string> = {
  en: 'ENGLISH',
  es: 'ESPAÑOL',
};
