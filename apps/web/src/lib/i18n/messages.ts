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
  // The day tab is ~44px wide. English fits "LIVE"; Spanish "EN VIVO" wraps to two lines inside it, so the
  // tab gets its own shorter word rather than the layout being stretched for one language.
  'leaderboard.liveShort': 'LIVE',
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
  'settings.title': 'SETTINGS',
  'settings.strapline': 'MAKE IT FEEL RIGHT',
  'settings.sound': 'SOUND',
  'settings.soundEffects': 'Sound effects',
  'settings.soundEffectsDetail': 'Engine, checkpoints, crashes and the finish',
  'settings.music': 'Music',
  'settings.controls': 'CONTROLS',
  'settings.vibration': 'Vibration',
  'settings.vibrationDetail':
    'Feedback on checkpoints, crashes and the finish. Only inside World App.',
  'settings.swapSides': 'Swap sides',
  'settings.swapSidesDetail': 'Gas and brake on the left',
  'settings.account': 'ACCOUNT',
  'settings.signedIn': 'Signed in',
  'settings.verifiedHuman': 'Verified human',
  'settings.notVerified': 'Not verified as human yet',
  'settings.signOut': 'Sign out',
  'settings.signOutDetail': 'Ends your RUSH 7 session. Your World App account is untouched.',
  'settings.signOutAction': 'SIGN OUT',
  'settings.signingOut': 'SIGNING OUT…',
  'settings.notSignedIn': 'Not signed in',
  'settings.notSignedInDetail': 'Sign in from the home screen to record times.',
  'settings.signOutFailed': 'Could not sign out. Check your connection and try again.',
  // The pads are small on-screen controls, not list items: these are the shortest words that still say what
  // the button does. The how-to-play tiles have room for the longer "GAS · GO" wording; the pads do not.
  'pad.gas': 'GAS',
  'pad.brake': 'BRAKE',
  'pad.leanBack': 'LEAN BACK',
  'pad.leanForward': 'LEAN FWD',
  'game.pause': 'Pause',
  'game.paused': 'PAUSED',
  'game.time': 'TIME',
  'game.timeStillRunning': 'TIME · STILL RUNNING',
  'game.yourBestToday': 'YOUR BEST TODAY',
  'game.resume': 'RESUME',
  'game.restart': 'RESTART RUN',
  'game.quit': 'QUIT TO HOME',
  'game.pauseNote': 'Pausing stops your run timer, not the day.',
  'game.raceEndsIn': 'RACE ENDS IN',
  'game.crash': 'CRASH!',
  'game.respawnStart': 'RESPAWN AT THE START',
  'game.respawnCheckpoint': 'RESPAWN AT CHECKPOINT {number}',
  'game.clockKeepsRunning': 'THE CLOCK KEEPS RUNNING',
  'game.crashCount': 'CRASH ×{count}',
  'game.checkpointChip': 'CP {number}',
  'game.finish': 'FINISH!',
  'game.yourTime': 'YOUR TIME',
  'game.newPersonalBest': 'NEW PERSONAL BEST {delta}',
  'game.bestOnThisDevice': 'BEST ON THIS DEVICE',
  'game.rank': 'RANK',
  'game.checking': 'CHECKING YOUR RUN WITH THE SERVER…',
  'game.verified': 'VERIFIED BY THE SERVER',
  'game.notSubmitted': 'TIME NOT SUBMITTED',
  'game.engineFailed': 'The game engine failed to load.',
  'unranked.notSignedIn': 'NOT RANKED · SIGN IN WITH WORLD APP TO SUBMIT TIMES',
  'unranked.offline': 'NOT RANKED · COULD NOT REACH THE SERVER. YOUR TIME IS SAFE ON THIS DEVICE',
  'unranked.rejected': 'NOT RANKED · THE SERVER COULD NOT VERIFY THIS RUN',
  'unranked.didNotFinish': 'NOT RANKED · THE SERVER DID NOT SEE THIS RUN REACH THE LINE',
  'unranked.duplicate': 'NOT RANKED · THIS RUN HAS ALREADY BEEN SUBMITTED',
  'unranked.windowClosed': 'NOT RANKED · TODAY’S RACE HAS CLOSED',
  'unranked.closed': 'NOT RANKED · THIS RUN WAS CLOSED BEFORE IT WAS SENT. RIDE IT AGAIN TO RANK',
  'unranked.otherMap': 'NOT RANKED · ONLY TODAY’S MAP HAS A LEADERBOARD',
  'warning.notSignedIn': 'PRACTICE RUN · SIGN IN WITH WORLD APP TO RANK',
  'warning.offline': 'PRACTICE RUN · NO CONNECTION TO THE SERVER',
  'warning.rejected': 'PRACTICE RUN · THE SERVER DID NOT OPEN A RANKED RUN',
  'warning.generic': 'PRACTICE RUN · THIS RUN WILL NOT BE RANKED',
  'warning.windowClosed': 'PRACTICE RUN · TODAY’S RACE HAS CLOSED',
  'warning.otherMap': 'PRACTICE RUN · ONLY TODAY’S MAP HAS A LEADERBOARD',

  'signIn.signIn': 'Sign in with World App',
  'signIn.signingIn': 'Signing in…',
  'signIn.needsWorldApp': "Open this inside World App to sign in — MiniKit isn't available here.",
  'signIn.failed': 'Sign-in failed.',
  'signIn.devSkip': 'Skip World App (local only)',
  'signIn.devOpening': 'Opening…',
  'signIn.devNote':
    'Development build. Mints a throwaway session so the game can be played without World App.',
  'signIn.devFailed': 'Local sign-in failed.',
  'signIn.signedInAs': 'Signed in as',
  'signIn.humanVerified': 'Human verified:',
  'signIn.yes': 'yes',
  'signIn.no': 'no',
  'signIn.verifyButton': "Verify you're human",
  'signIn.worldIdUnconfigured': 'World ID is not configured yet.',
  'signIn.verifyFailed': 'World ID verification failed ({code}).',

  'how.title': 'HOW TO PLAY',
  'how.strapline': 'BEAT THE CLOCK',
  'how.straplineDaily': 'BEAT THE CLOCK · ONE MAP A DAY',
  'how.allOpen': 'EVERY MAP IS OPEN RIGHT NOW',
  'how.allOpenBody':
    'While the game is being tested, all seven maps can be played whenever you like. Normally one opens each day at 00:00 UTC and its leaderboard freezes when the day ends.',
  'how.daily': 'ONE MAP EVERY DAY',
  'how.dailyBody':
    'A new map opens each day at 00:00 UTC. When the day ends, that leaderboard freezes for good.',
  'how.controls': 'CONTROLS',
  'how.controlsBody': 'Four buttons. Hold to keep them pressed.',
  'how.gas': 'GAS · GO',
  'how.brake': 'BRAKE · STOP',
  'how.leanBack': 'LEAN BACK',
  'how.leanForward': 'LEAN FWD',
  'how.bestTime': 'YOUR BEST TIME COUNTS',
  'how.bestTimeBody':
    'Crash and you respawn at the last checkpoint, with the clock still running. Retry as often as you like — only your fastest run counts.',
  'how.oneHuman': 'ONE HUMAN, ONE SPOT',
  'how.oneHumanBody':
    'World ID proves you are a real person, so one human gets one place on the board.',
  'how.serverTimes': 'THE SERVER TIMES YOUR RUN',
  'how.serverTimesBody':
    'Your run sends the buttons you pressed, not the time you got. The server replays them and works the time out itself, so a time only counts once it has been checked.',
  'how.sevenBoards': 'SEVEN BOARDS, SEVEN CHANCES',
  'how.sevenBoardsBody':
    'Every day has its own leaderboard, and each one closes for good when the day ends. Miss a day and nothing is lost — you simply are not on that day’s board.',

  'settings.about': 'ABOUT',
  'settings.version': 'Version {version} · provisional art and copy',

  'day.mon': 'MON',
  'day.tue': 'TUE',
  'day.wed': 'WED',
  'day.thu': 'THU',
  'day.fri': 'FRI',
  'day.sat': 'SAT',
  'day.sun': 'SUN',

  'dayName.mon': 'MONDAY',
  'dayName.tue': 'TUESDAY',
  'dayName.wed': 'WEDNESDAY',
  'dayName.thu': 'THURSDAY',
  'dayName.fri': 'FRIDAY',
  'dayName.sat': 'SATURDAY',
  'dayName.sun': 'SUNDAY',

  'map.sunset-canyon.name': 'SUNSET CANYON',
  'map.sunset-canyon.tagline': 'Speed through the rocks. Master the jumps. Beat the clock.',
  'map.coral-coast.name': 'CORAL COAST',
  'map.coral-coast.tagline': 'Ride the shoreline. Do not touch the water.',
  'map.emerald-woods.name': 'EMERALD WOODS',
  'map.emerald-woods.tagline': 'Roots, logs and long jumps between the pines.',
  'map.steel-yard.name': 'STEEL YARD',
  'map.steel-yard.tagline': 'Cranes, containers and tight landings.',
  'map.magma-ridge.name': 'MAGMA RIDGE',
  'map.magma-ridge.tagline': 'Hot rock. Cold nerves.',
  'map.frost-peak.name': 'FROST PEAK',
  'map.frost-peak.tagline': 'Slippery slopes and huge air.',
  'map.orbit-circuit.name': 'ORBIT CIRCUIT',
  'map.orbit-circuit.tagline': 'The final race of the week.',

  'home.playMapAria': 'Play map {number}, {name}',
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
  'leaderboard.liveShort': 'VIVO',
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
  'settings.title': 'AJUSTES',
  'settings.strapline': 'DÉJALO A TU GUSTO',
  'settings.sound': 'SONIDO',
  'settings.soundEffects': 'Efectos de sonido',
  'settings.soundEffectsDetail': 'Motor, checkpoints, choques y meta',
  'settings.music': 'Música',
  'settings.controls': 'CONTROLES',
  'settings.vibration': 'Vibración',
  'settings.vibrationDetail': 'Aviso en checkpoints, choques y meta. Solo dentro de World App.',
  'settings.swapSides': 'Cambiar lados',
  'settings.swapSidesDetail': 'Gas y freno a la izquierda',
  'settings.account': 'CUENTA',
  'settings.signedIn': 'Sesión iniciada',
  'settings.verifiedHuman': 'Humano verificado',
  'settings.notVerified': 'Todavía sin verificar como humano',
  'settings.signOut': 'Cerrar sesión',
  'settings.signOutDetail': 'Cierra tu sesión de RUSH 7. Tu cuenta de World App no se toca.',
  'settings.signOutAction': 'CERRAR SESIÓN',
  'settings.signingOut': 'CERRANDO…',
  'settings.notSignedIn': 'Sin sesión',
  'settings.notSignedInDetail': 'Inicia sesión desde la pantalla de inicio para registrar tiempos.',
  'settings.signOutFailed': 'No se pudo cerrar la sesión. Revisa tu conexión e inténtalo de nuevo.',
  'pad.gas': 'GAS',
  'pad.brake': 'FRENO',
  // Spanish for "lean back/forward" does not fit a pad, and the picture on it already says "lean".
  'pad.leanBack': 'ATRÁS',
  'pad.leanForward': 'ADELANTE',
  'game.pause': 'Pausa',
  'game.paused': 'EN PAUSA',
  'game.time': 'TIEMPO',
  'game.timeStillRunning': 'TIEMPO · SIGUE CORRIENDO',
  'game.yourBestToday': 'TU MEJOR DE HOY',
  'game.resume': 'CONTINUAR',
  'game.restart': 'REINICIAR VUELTA',
  'game.quit': 'SALIR AL INICIO',
  'game.pauseNote': 'La pausa para tu cronómetro, no el día.',
  'game.raceEndsIn': 'LA CARRERA TERMINA EN',
  'game.crash': '¡CAÍDA!',
  'game.respawnStart': 'VUELVES A LA SALIDA',
  'game.respawnCheckpoint': 'VUELVES AL CHECKPOINT {number}',
  'game.clockKeepsRunning': 'EL RELOJ NO SE PARA',
  'game.crashCount': 'CAÍDAS ×{count}',
  'game.checkpointChip': 'CP {number}',
  'game.finish': '¡META!',
  'game.yourTime': 'TU TIEMPO',
  'game.newPersonalBest': 'NUEVO RÉCORD PERSONAL {delta}',
  'game.bestOnThisDevice': 'MEJOR EN ESTE MÓVIL',
  'game.rank': 'PUESTO',
  'game.checking': 'COMPROBANDO TU VUELTA CON EL SERVIDOR…',
  'game.verified': 'VERIFICADA POR EL SERVIDOR',
  'game.notSubmitted': 'TIEMPO SIN ENVIAR',
  'game.engineFailed': 'No se pudo cargar el motor del juego.',
  'unranked.notSignedIn': 'SIN PUNTUAR · INICIA SESIÓN CON WORLD APP PARA ENVIAR TIEMPOS',
  'unranked.offline':
    'SIN PUNTUAR · NO SE PUDO CONECTAR CON EL SERVIDOR. TU TIEMPO ESTÁ GUARDADO EN ESTE MÓVIL',
  'unranked.rejected': 'SIN PUNTUAR · EL SERVIDOR NO PUDO VERIFICAR ESTA VUELTA',
  'unranked.didNotFinish': 'SIN PUNTUAR · EL SERVIDOR NO VIO QUE ESTA VUELTA LLEGARA A META',
  'unranked.duplicate': 'SIN PUNTUAR · ESTA VUELTA YA SE HABÍA ENVIADO',
  'unranked.windowClosed': 'SIN PUNTUAR · LA CARRERA DE HOY YA SE CERRÓ',
  'unranked.closed': 'SIN PUNTUAR · ESTA VUELTA SE CERRÓ ANTES DE ENVIARSE. CÓRRELA OTRA VEZ',
  'unranked.otherMap': 'SIN PUNTUAR · SOLO EL MAPA DE HOY TIENE CLASIFICACIÓN',
  'warning.notSignedIn': 'VUELTA DE PRÁCTICA · INICIA SESIÓN CON WORLD APP PARA PUNTUAR',
  'warning.offline': 'VUELTA DE PRÁCTICA · SIN CONEXIÓN CON EL SERVIDOR',
  'warning.rejected': 'VUELTA DE PRÁCTICA · EL SERVIDOR NO ABRIÓ UNA VUELTA PUNTUABLE',
  'warning.generic': 'VUELTA DE PRÁCTICA · ESTA VUELTA NO PUNTUARÁ',
  'warning.windowClosed': 'VUELTA DE PRÁCTICA · LA CARRERA DE HOY YA SE CERRÓ',
  'warning.otherMap': 'VUELTA DE PRÁCTICA · SOLO EL MAPA DE HOY TIENE CLASIFICACIÓN',

  'signIn.signIn': 'Iniciar sesión con World App',
  'signIn.signingIn': 'Iniciando sesión…',
  'signIn.needsWorldApp': 'Abre esto dentro de World App para iniciar sesión: aquí no hay MiniKit.',
  'signIn.failed': 'No se pudo iniciar sesión.',
  'signIn.devSkip': 'Saltar World App (solo local)',
  'signIn.devOpening': 'Abriendo…',
  'signIn.devNote':
    'Compilación de desarrollo. Crea una sesión desechable para poder jugar sin World App.',
  'signIn.devFailed': 'No se pudo iniciar sesión en local.',
  'signIn.signedInAs': 'Sesión iniciada como',
  'signIn.humanVerified': 'Humano verificado:',
  'signIn.yes': 'sí',
  'signIn.no': 'no',
  'signIn.verifyButton': 'Verifica que eres humano',
  'signIn.worldIdUnconfigured': 'World ID todavía no está configurado.',
  'signIn.verifyFailed': 'Falló la verificación de World ID ({code}).',

  'how.title': 'CÓMO JUGAR',
  'how.strapline': 'GANA AL RELOJ',
  'how.straplineDaily': 'GANA AL RELOJ · UN MAPA AL DÍA',
  'how.allOpen': 'AHORA MISMO ESTÁN TODOS ABIERTOS',
  'how.allOpenBody':
    'Mientras probamos el juego puedes jugar los siete mapas cuando quieras. Lo normal es que se abra uno cada día a las 00:00 UTC y que su clasificación se cierre al acabar el día.',
  'how.daily': 'UN MAPA CADA DÍA',
  'how.dailyBody':
    'Cada día se abre un mapa nuevo a las 00:00 UTC. Cuando el día acaba, esa clasificación se cierra para siempre.',
  'how.controls': 'CONTROLES',
  'how.controlsBody': 'Cuatro botones. Mantenlos pulsados.',
  'how.gas': 'GAS · ACELERA',
  'how.brake': 'FRENO · PARA',
  'how.leanBack': 'INCLINAR ATRÁS',
  'how.leanForward': 'INCLINAR ADELANTE',
  'how.bestTime': 'CUENTA TU MEJOR TIEMPO',
  'how.bestTimeBody':
    'Si te caes reapareces en el último checkpoint, y el reloj no se para. Reintenta las veces que quieras: solo cuenta tu vuelta más rápida.',
  'how.oneHuman': 'UN HUMANO, UN PUESTO',
  'how.oneHumanBody':
    'World ID demuestra que eres una persona real, así que cada humano ocupa un solo puesto en la tabla.',
  'how.serverTimes': 'EL SERVIDOR CRONOMETRA TU VUELTA',
  'how.serverTimesBody':
    'Tu vuelta envía los botones que pulsaste, no el tiempo que hiciste. El servidor los repite y calcula el tiempo por su cuenta, así que un tiempo solo cuenta cuando está comprobado.',
  'how.sevenBoards': 'SIETE TABLAS, SIETE OPORTUNIDADES',
  'how.sevenBoardsBody':
    'Cada día tiene su propia clasificación, y cada una se cierra para siempre al acabar el día. Si faltas un día no pierdes nada: simplemente no sales en la tabla de ese día.',

  'settings.about': 'ACERCA DE',
  'settings.version': 'Versión {version} · arte y textos provisionales',

  'day.mon': 'LUN',
  'day.tue': 'MAR',
  'day.wed': 'MIÉ',
  'day.thu': 'JUE',
  'day.fri': 'VIE',
  'day.sat': 'SÁB',
  'day.sun': 'DOM',

  'dayName.mon': 'LUNES',
  'dayName.tue': 'MARTES',
  'dayName.wed': 'MIÉRCOLES',
  'dayName.thu': 'JUEVES',
  'dayName.fri': 'VIERNES',
  'dayName.sat': 'SÁBADO',
  'dayName.sun': 'DOMINGO',

  'map.sunset-canyon.name': 'CAÑÓN DEL OCASO',
  'map.sunset-canyon.tagline': 'Vuela entre las rocas. Domina los saltos. Gana al reloj.',
  'map.coral-coast.name': 'COSTA DE CORAL',
  'map.coral-coast.tagline': 'Pega la rueda a la orilla. No toques el agua.',
  'map.emerald-woods.name': 'BOSQUE ESMERALDA',
  'map.emerald-woods.tagline': 'Raíces, troncos y saltos largos entre los pinos.',
  'map.steel-yard.name': 'PATIO DE ACERO',
  'map.steel-yard.tagline': 'Grúas, contenedores y aterrizajes justos.',
  'map.magma-ridge.name': 'CRESTA DE MAGMA',
  'map.magma-ridge.tagline': 'Roca ardiendo. Nervios fríos.',
  'map.frost-peak.name': 'PICO HELADO',
  'map.frost-peak.tagline': 'Laderas resbaladizas y vuelos enormes.',
  'map.orbit-circuit.name': 'CIRCUITO ORBITAL',
  'map.orbit-circuit.tagline': 'La última carrera de la semana.',

  'home.playMapAria': 'Jugar el mapa {number}, {name}',
};

export const MESSAGES: Record<Locale, Record<MessageKey, string>> = { en, es };

/** What each language calls itself — never translated, because that is how people recognise their own. */
export const LANGUAGE_NAMES: Record<Locale, string> = {
  en: 'ENGLISH',
  es: 'ESPAÑOL',
};
