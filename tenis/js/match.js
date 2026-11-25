// ===== Partidos: saque, resto, sets, tie-break, superficies y táctica =====
const MATCH_FORMATS = {
  scenario: { setsToWin: 1, gamesPerSet: 4, tieAt: 4, label: "set corto a 4 juegos" },
  tour:     { setsToWin: 2, gamesPerSet: 6, tieAt: 6, label: "mejor de 3 sets, sets a 6 juegos" },
  highStakes:{ setsToWin: 2, gamesPerSet: 6, tieAt: 6, label: "mejor de 3 sets a 6 juegos" },
  final:    { setsToWin: 2, gamesPerSet: 6, tieAt: 6, label: "final a mejor de 3 sets" },
  slam:     { setsToWin: 3, gamesPerSet: 6, tieAt: 6, label: "mejor de 5 sets (el quinto, acortado a 4 juegos)" }
};

function pickRival(highStakes) {
  const rankIndex = currentRankIndex();
  const base = RANKS[rankIndex].rivalOvr + (highStakes ? 4 : -2);
  const pool = (rankIndex < 2 ? LOCAL_RIVALS : PRO_RIVALS).filter(rival => rival.name !== player.name);
  const rival = randomItem(pool);
  return {
    name: rival.name,
    ovr: clamp(base + randInt(-3, 3), 35, 95),
    style: rival.style || randomItem(RIVAL_STYLES),
    brand: rival.brand || randomItem(TENNIS_BRANDS),
    country: rival.country || "Internacional"
  };
}

function matchFormatFor(format = "scenario") {
  return MATCH_FORMATS[format] || MATCH_FORMATS.scenario;
}

function surfaceInfo(surface) {
  return SURFACE_STYLES[surface] || SURFACE_STYLES["Dura"];
}

function startMatch({ title, rival, highStakes = false, tournamentRound = null, intro = "", surface = null, format = "scenario" }) {
  const event = eventForTurn(player.turn);
  const fmt = matchFormatFor(format);
  activeMatch = {
    highStakes, tournamentRound, rival, format,
    surface: surface || (event ? event.surface : randomItem(SURFACES)),
    setsToWin: fmt.setsToWin, gamesPerSet: fmt.gamesPerSet, tieAt: fmt.tieAt, formatLabel: fmt.label,
    server: Math.random() < 0.5 ? "player" : "rival", serveNumber: 1,
    playerPoints: 0, rivalPoints: 0, playerGames: 0, rivalGames: 0,
    setsPlayer: 0, setsRival: 0, setIndex: 1, tieBreak: false, setHistory: [],
    pointNumber: 1, lastStrategyId: null, repeatCount: 0, styleCount: {},
    streak: { owner: "", count: 0 }
  };
  document.getElementById("scenario-box").hidden = true;
  document.getElementById("choices-container").hidden = true;
  document.getElementById("match-screen").hidden = false;
  document.getElementById("match-title").textContent = title;
  document.getElementById("match-player-name").textContent = player.name;
  document.getElementById("court-player-name").textContent = player.name;
  document.getElementById("match-rival-name").textContent = rival.name;
  document.getElementById("court-rival-name").textContent = rival.name;
  document.getElementById("match-message").textContent = intro ||
    `${fmt.label} sobre ${surface || activeMatch.surface}. ${surfaceInfo(activeMatch.surface).hint} Elige cómo jugar cada punto.`;
  renderMatch();
}

// Marcador de tenis: 0 / 15 / 30 / 40 y ventaja. En tie-break se cuentan puntos.
function tennisScore(points, opponentPoints, tieBreak = false) {
  if (tieBreak) return String(points);
  if (points >= 3 && opponentPoints >= 3) {
    if (points === opponentPoints) return "40";
    return points > opponentPoints ? "AD" : "40";
  }
  return ["0", "15", "30", "40"][Math.min(points, 3)];
}

function currentGamesPerSet(match) {
  // En un Gran Slam el set decisivo se acorta para no hacer interminable la partida.
  if (match.format === "slam" && match.setIndex === 5) return 4;
  return match.gamesPerSet;
}

function pointSituation(match) {
  const youServe = match.server === "player";
  const p = match.playerPoints, r = match.rivalPoints;
  if (match.tieBreak) {
    if (p >= 6 && p - r >= 1) return "¡Punto de set!";
    if (r >= 6 && r - p >= 1) return "Punto de set en contra";
    return "Desempate";
  }
  const breakFor = !youServe && p >= 3 && p > r;
  const breakAgainst = youServe && r >= 3 && r > p;
  const setPointFor = match.playerGames >= currentGamesPerSet(match) - 1 && p >= 3 && p > r;
  const setPointAgainst = match.rivalGames >= currentGamesPerSet(match) - 1 && r >= 3 && r > p;
  if (breakFor) return "¡Punto de break!";
  if (breakAgainst) return "Punto de break en contra";
  if (setPointFor) return "Bola de set";
  if (setPointAgainst) return "Bola de set en contra";
  if (match.setsPlayer === match.setsToWin - 1 && match.setsRival === match.setsToWin - 1) return "Set decisivo";
  return "";
}

// La bola de cada punto cambia: superficie, marcador y tipo de saque deciden la situación.
function currentShotSituation(match) {
  if (!match) return SHOT_SITUATIONS[0];
  if (match.server === "player" && match.serveNumber === 2) {
    return SHOT_SITUATIONS.find(situation => situation.id === "second-serve");
  }
  if (/en contra/.test(pointSituation(match))) {
    return SHOT_SITUATIONS.find(situation => situation.id === "pressure");
  }
  const pool = SHOT_SITUATIONS.filter(situation =>
    !situation.manual && (!situation.surfaces || situation.surfaces.includes(match.surface)));
  return pool[(match.pointNumber - 1) % pool.length] || SHOT_SITUATIONS[2];
}

// Cuánto ha aprendido el rival de tu patrón: se acumula al repetir y decae al variar.
function patternRead(match) {
  const repeated = clamp((match.repeatCount - 1) * 30, 0, 90);
  const total = Object.values(match.styleCount).reduce((sum, value) => sum + value, 0);
  const dominant = Math.max(0, ...Object.values(match.styleCount));
  const habit = total >= 3 ? Math.round((dominant / total) * 25) : 0;
  return clamp(repeated + habit, 0, 100);
}

function patternMessage(read) {
  if (read >= 75) return "Te tienen leído: cambia de golpe ya.";
  if (read >= 50) return "El rival anticipa tu patrón: varía el juego.";
  if (read >= 25) return "El rival empieza a leer tu patrón.";
  return "El rival todavía no te lee.";
}

const STYLE_HINTS = {
  Defensivo: "Devuelve casi todo: cambia el ritmo del intercambio.",
  Agresivo: "Busca el ganador: quítale ritmo fácil.",
  Fondista: "Vive al fondo de la pista: muestra la red."
};

function renderMatch() {
  if (!activeMatch) return;
  const match = activeMatch;
  const court = document.getElementById("court");
  court.classList.remove("court-clay", "court-grass", "court-indoor");
  if (match.surface === "Tierra batida") court.classList.add("court-clay");
  if (match.surface === "Hierba") court.classList.add("court-grass");
  if (match.surface === "Dura cubierta") court.classList.add("court-indoor");
  document.getElementById("match-ovr").textContent = `OVR ${player.ovr} vs ${match.rival.ovr}`;
  document.getElementById("match-player-ovr").textContent = player.ovr;
  document.getElementById("match-rival-ovr").textContent = match.rival.ovr;
  document.getElementById("match-rival-style").textContent =
    `Estilo: ${match.rival.style} (${STYLE_INFO[match.rival.style]}) · Raqueta: ${match.rival.brand || "Wilson"} · ${match.rival.country || "Internacional"}`;
  document.getElementById("match-player-games").textContent = match.playerGames;
  document.getElementById("match-rival-games").textContent = match.rivalGames;
  document.getElementById("match-player-score").textContent = tennisScore(match.playerPoints, match.rivalPoints, match.tieBreak);
  document.getElementById("match-rival-score").textContent = tennisScore(match.rivalPoints, match.playerPoints, match.tieBreak);
  document.getElementById("match-player-serve").textContent = match.server === "player" ? "•" : "";
  document.getElementById("match-rival-serve").textContent = match.server === "rival" ? "•" : "";
  document.getElementById("match-sets").textContent = `Sets ${match.setsPlayer} - ${match.setsRival}`;
  document.getElementById("match-set-label").textContent =
    `Set ${match.setIndex} · ${match.formatLabel} · ${surfaceInfo(match.surface).hint}`;
  document.getElementById("match-serve-label").textContent =
    `${match.server === "player" ? "Saque" : "Resto"}${match.serveNumber === 2 ? " · segundo saque" : ""}`;
  document.getElementById("match-break-alert").textContent = pointSituation(match);
  document.getElementById("match-turn-label").textContent = `Punto ${match.pointNumber}`;

  const situation = currentShotSituation(match);
  document.getElementById("match-situation").textContent =
    `${situation.icon} ${situation.title}: ${situation.detail}`;
  const read = patternRead(match);
  const bar = document.getElementById("pattern-bar");
  bar.style.width = `${read}%`;
  bar.classList.toggle("pattern-high", read >= 50);
  document.getElementById("pattern-label").textContent = patternMessage(read);

  const container = document.getElementById("match-choices");
  container.replaceChildren();
  matchStrategies.forEach(strategy => {
    const favored = (situation.swing[strategy.id] || 0) > 0.02;
    const button = document.createElement("button");
    button.className = `choice-btn${favored ? " favored" : ""}`;
    const title = document.createElement("strong");
    title.textContent = (favored ? "⭐ " : "") +
      (match.server === "player" ? strategy.serveTitle : strategy.title);
    const detail = document.createElement("small");
    const serveTip = match.server === "player"
      ? (match.serveNumber === 2 ? " Segundo saque: entra más lento y tienes menos opciones." : " Primer saque: más velocidad, pero mayor riesgo de falta.")
      : "";
    detail.textContent = `${match.server === "player" ? strategy.serveDetail : strategy.detail} ${serveTip} ${STYLE_HINTS[match.rival.style] || ""}` +
      (favored ? ` Buena opción con ${situation.title.toLowerCase()}.` : "");
    button.append(title, detail);
    button.addEventListener("click", () => playMatchPoint(strategy));
    container.appendChild(button);
  });
}

// La superficie cambia la eficacia de cada golpe y el desgaste del punto.
function surfaceEffect(surface, strategyId) {
  const styles = surfaceInfo(surface).swing || {};
  return styles[strategyId] || 0;
}

function racketStyleBonus() {
  const racket = bestOwnedShopItem(item => item.type === "racket", "advantage");
  return racket && racket.style && racket.style === (player.style || "Polivalente") ? 0.04 : 0;
}

function pointWinChance(strategy, situation = null) {
  const match = activeMatch;
  const ratingAdvantage = (player.ovr - match.rival.ovr) * 0.012;
  const energyAdvantage = (player.energy - 50) * 0.002;
  const materialAdvantage = equipmentBonusForSurface(match.surface);
  // Repetir siempre el mismo golpe vuelve predecible al jugador y penaliza el resultado.
  const predictabilityPenalty = clamp((match.repeatCount - 1) * 0.05, 0, 0.15);
  const activeSituation = situation || currentShotSituation(match);
  const situationBonus = activeSituation.swing[strategy.id] || 0;
  const serveAdvantage = match.server === "player" ? 0.04 : -0.07;
  const secondServePenalty = match.server === "player" && match.serveNumber === 2 ? -0.05 : 0;
  return clamp(
    0.5 + ratingAdvantage + energyAdvantage + strategy.vs[match.rival.style]
      + surfaceEffect(match.surface, strategy.id) + situationBonus + materialAdvantage + racketStyleBonus()
      + serveAdvantage + secondServePenalty - predictabilityPenalty,
    0.10, 0.90
  );
}

function serveFaultChance(strategy, match) {
  const base = match.serveNumber === 1 ? (strategy.fault || 0.12) : 0.02;
  return clamp(base + surfaceInfo(match.surface).fault, 0.01, 0.35);
}

function energyCostFor(strategy, match) {
  const surfaceStamina = surfaceInfo(match.surface).stamina || 1;
  return (strategy.energy - racketStyleBonus()) * surfaceStamina;
}

function updateStyleCount(strategy) {
  activeMatch.styleCount[strategy.id] = (activeMatch.styleCount[strategy.id] || 0) + 1;
}

function playMatchPoint(strategy) {
  if (!activeMatch || modalOpen) return;
  const match = activeMatch;
  const situation = currentShotSituation(match);
  if (match.lastStrategyId === strategy.id) match.repeatCount++;
  else {
    match.lastStrategyId = strategy.id;
    match.repeatCount = 0;
  }
  const predictable = match.repeatCount >= 2;
  updateStyleCount(strategy);
  applyEffects({ energy: energyCostFor(strategy, match) });
  renderStats();
  match.pointNumber++;

  // 1) El saque puede fallar. Primera falta → segundo saque; segunda → doble falta.
  const playerServing = match.server === "player";
  const faultChance = playerServing ? serveFaultChance(strategy, match) : (match.serveNumber === 1 ? 0.22 : 0.05);
  if (Math.random() < faultChance) {
    if (match.serveNumber === 1) {
      match.serveNumber = 2;
      document.getElementById("match-message").textContent = playerServing
        ? "Primer saque fuera. Tienes una segunda oportunidad: asegura el punto."
        : `El rival falla el primer saque. Viene el segundo: ${predictable ? "lee su patrón y remonta." : "prepárate para devolver."}`;
      renderMatch();
      return;
    }
    match.serveNumber = 1;
    const message = playerServing
      ? `¡Doble falta! Punto para ${match.rival.name}.`
      : `¡Doble falta del rival! Punto para ti.`;
    awardPoint(!playerServing, strategy, message, false);
    return;
  }

  // 2) Punto normal, con saque/resto, superficie, material y penalización por patrón.
  const wonPoint = Math.random() < pointWinChance(strategy, situation);
  const court = document.getElementById("court");
  court.classList.toggle("ball-to-you", wonPoint);
  court.classList.toggle("ball-to-rival", !wonPoint);
  let message = wonPoint ? `¡Punto para ti! ${strategy.winText}` : `Punto para el rival. ${strategy.lossText}`;
  message += ` Situación: ${situation.title}.`;
  if (predictable) message += wonPoint ? " Aun así, tu patrón es fácil de leer." : " Tu rival lee tu patrón: varía el golpe.";
  awardPoint(wonPoint, strategy, message, true);
}

function awardPoint(wonPoint, strategy, message, playNormal) {
  const match = activeMatch;
  if (!match) return;
  if (wonPoint) match.playerPoints++; else match.rivalPoints++;
  const owner = wonPoint ? "player" : "rival";
  if (match.streak.owner === owner) match.streak.count++;
  else match.streak = { owner, count: 1 };
  const streakText = match.streak.count >= 2
    ? ` ${wonPoint ? "Llevas" : "El rival encadena"} ${match.streak.count} puntos seguidos.`
    : "";
  const p = match.playerPoints, r = match.rivalPoints;
  let gameWinner = null;

  if (match.tieBreak) {
    if (p >= 7 && p - r >= 2) gameWinner = "player";
    else if (r >= 7 && r - p >= 2) gameWinner = "rival";
    if (gameWinner) {
      const loserPoints = gameWinner === "player" ? r : p;
      match.setHistory.push(gameWinner === "player" ? `7-6(${loserPoints})` : `6-7(${loserPoints})`);
      endSet(gameWinner === "player", `¡Tie-break para ti por 7-${loserPoints}!${streakText}`);
      return;
    }
  } else if (p >= 4 && p - r >= 2) {
    gameWinner = "player";
  } else if (r >= 4 && r - p >= 2) {
    gameWinner = "rival";
  }

  if (gameWinner) {
    if (gameWinner === "player") match.playerGames++; else match.rivalGames++;
    match.playerPoints = 0;
    match.rivalPoints = 0;
    match.serveNumber = 1;
    match.server = match.server === "player" ? "rival" : "player";
    message = gameWinner === "player" ? "¡Juego para ti! Sigue presionando." : "Juego para el rival. Todavía puedes remontar.";

    const games = gameWinner === "player" ? match.playerGames : match.rivalGames;
    const other = gameWinner === "player" ? match.rivalGames : match.playerGames;
    const limit = currentGamesPerSet(match);
    if (games >= limit && games - other >= 2) {
      match.setHistory.push(`${Math.max(games, other)}-${Math.min(games, other)}`);
      endSet(gameWinner === "player", message + streakText);
      return;
    }
    if (match.playerGames >= match.tieAt && match.rivalGames >= match.tieAt && match.playerGames === match.rivalGames) {
      match.tieBreak = true;
      match.playerPoints = 0;
      match.rivalPoints = 0;
      message = `Empate a ${match.tieAt} juegos: se juega el tie-break. ${pointSituation(match)}`;
    }
  }

  document.getElementById("match-message").textContent = message + streakText;
  renderMatch();
}

function endSet(wonSet, message) {
  const match = activeMatch;
  if (wonSet) match.setsPlayer++; else match.setsRival++;
  document.getElementById("match-message").textContent = `${message} Set ${match.setIndex}: ${match.setsPlayer}-${match.setsRival}.`;
  if (match.setsPlayer >= match.setsToWin || match.setsRival >= match.setsToWin) {
    finishMatch(match.setsPlayer >= match.setsToWin);
    return;
  }
  match.setIndex++;
  match.playerGames = 0;
  match.rivalGames = 0;
  match.playerPoints = 0;
  match.rivalPoints = 0;
  match.tieBreak = false;
  match.serveNumber = 1;
  renderMatch();
}

function matchScoreSummary() {
  if (!activeMatch) return "";
  const sets = activeMatch.setHistory.slice();
  const current = `${activeMatch.playerGames}-${activeMatch.rivalGames}`;
  if (activeMatch.tieBreak) sets.push(`7-6(${Math.min(activeMatch.playerPoints, activeMatch.rivalPoints)})`);
  else if (activeMatch.playerGames || activeMatch.rivalGames) sets.push(current);
  return sets.join(" · ");
}

function updateHeadToHead(rivalName, won) {
  const record = player.headToHead[rivalName] || { wins: 0, losses: 0 };
  if (won) record.wins++; else record.losses++;
  player.headToHead[rivalName] = record;
}

function finishMatch(won) {
  const match = activeMatch;
  const score = matchScoreSummary();
  const dominant = Object.entries(match.styleCount).sort((a, b) => b[1] - a[1])[0];
  if (dominant) player.style = dominant[0] === "attack" ? "Agresivo" : dominant[0] === "control" ? "Control" : dominant[0] === "net" ? "Agresivo" : player.style;
  player.experience += won ? 3 : 2;
  updateHeadToHead(match.rival.name, won);
  activeMatch = null;
  document.getElementById("match-screen").hidden = true;
  document.getElementById("scenario-box").hidden = false;
  document.getElementById("choices-container").hidden = false;
  applyEffects({ energy: -4 });

  if (match.tournamentRound) {
    if (won) { player.matchesWon++; player.seasonMatchesWon++; }
    else { player.matchesLost++; player.seasonMatchesLost++; }
    applyEffects({ skill: 1, ovr: won ? 1 : 0 });
    advanceTournament(won, match.tournamentRound, score);
    return;
  }

  if (won) {
    player.matchesWon++;
    player.seasonMatchesWon++;
    // Los partidos amistosos dan algo de ranking, pero el grueso se gana en los cuadros.
    const pointsEarned = match.highStakes ? 15 : 10;
    applyEffects({ skill: 2, ovr: 2, fame: match.highStakes ? 12 : 7, money: match.highStakes ? 40 : 20 });
    player.rankingPoints += pointsEarned;
    player.seasonPoints += pointsEarned;
    player.seasonNonTournamentPoints += pointsEarned;
    addLog(`🏆 ¡Victoria ante ${match.rival.name} (${score})! +${pointsEarned} puntos de ranking y +2 OVR.`, "positive");
    showModal({
      icon: "🏆",
      title: "¡Victoria!",
      message: `Has derrotado a ${match.rival.name} sobre ${match.surface}. Marcador: ${score}. Tu juego sigue creciendo.`,
      stats: [
        { label: "Ranking", value: `+${pointsEarned} puntos` },
        { label: "OVR", value: "+2" },
        { label: "Dinero", value: `+$${match.highStakes ? 40 : 20}` }
      ],
      actions: [{ label: "Seguir con la carrera", primary: true, onClick: finishScenario }]
    });
  } else {
    player.matchesLost++;
    player.seasonMatchesLost++;
    applyEffects({ skill: 3, ovr: -1, fame: -3, money: 5 });
    addLog(`💔 Derrota ante ${match.rival.name} (${score}). Aprendes de la experiencia; OVR -1.`, "negative");
    showModal({
      icon: "💔",
      title: "Derrota",
      message: `${match.rival.name} se impone sobre ${match.surface} (${score}). La experiencia también entrena.`,
      stats: [
        { label: "Técnica", value: "+3" },
        { label: "OVR", value: "-1" },
        { label: "Dinero", value: "+$5" }
      ],
      actions: [{ label: "Volver al menú", primary: true, onClick: finishScenario }]
    });
  }
}
