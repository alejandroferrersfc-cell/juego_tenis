// ===== Flujo del juego: turnos, escenarios, temporadas y fin de carrera =====
function computeOvr() {
  // El OVR sale de la técnica más un bonus por material, victorias y lesiones
  return clamp(Math.round(player.skill * 0.6 + 20 + player.ovrBonus), 1, 99);
}

function applyEffects(effects) {
  const energyChange = effects.energy || 0;
  player.energy = clamp(player.energy + (energyChange > 0 ? energyChange * (1 + recoveryBonus()) : energyChange), 0, 100);
  // Rendimientos decrecientes: cuanto más técnica tienes, menos subes entrenando
  const skillChange = effects.skill > 0
    ? Math.round(effects.skill * 0.4 * (1 - player.skill / 120) * coachMultiplier())
    : (effects.skill || 0);
  player.skill = clamp(player.skill + skillChange, 0, 100);
  if (effects.ovr) player.ovrBonus = clamp(player.ovrBonus + effects.ovr, -12, 12);
  player.ovr = computeOvr();
  player.fame = clamp(player.fame + (effects.fame || 0), 0, 100);
  player.money = Math.max(0, player.money + (effects.money || 0));
  if (effects.sponsor !== undefined) player.sponsor = effects.sponsor;
  if (effects.flags) Object.assign(player.flags, effects.flags);
  if (effects.injuryMonths) {
    player.injuryMonths = effects.injuryMonths;
    skipInjuryTick = true;
    addLog(`🏥 Lesión grave: ${player.injuryMonths} meses de baja. No podrás competir hasta recuperarte.`, "negative");
  }
}

// El riesgo de lesión crece con cargas seguidas, poca energía y pistas duras.
function injuryRisk() {
  const surfaceRisk = player.lastSurface === "Dura cubierta" ? 0.06 : player.lastSurface === "Dura" ? 0.03 : 0;
  return clamp(Math.max(0, player.workload - 1) * 0.09 + (player.energy < 25 ? 0.22 : 0) + surfaceRisk, 0, 0.75);
}

function registerWorkload(surface, intense = false) {
  player.workload = clamp(player.workload + (intense ? 2 : 1), 0, 6);
  player.lastSurface = surface;
}

// ----- Selección del escenario del mes -----
function isScenarioEligible(scenario) {
  if (scenario.onlyFirst || scenario.month !== undefined) return false;
  if (scenario.once && player.onceDone.includes(scenario.id)) return false;
  return !scenario.when || scenario.when(player);
}

function pickScenarioId() {
  if (player.season === 1 && player.turn === 1) return "primera-semana";
  const fixed = SCENARIOS.find(scenario => scenario.month === player.turn - 1);
  if (fixed) return fixed.id;
  const eligible = SCENARIOS.filter(isScenarioEligible);
  const urgent = eligible.find(scenario => scenario.priority);
  let chosen = urgent;
  if (!chosen) {
    let pool = eligible.filter(scenario => !player.usedScenarios.includes(scenario.id));
    if (!pool.length) { player.usedScenarios = []; pool = eligible; }
    chosen = randomItem(pool);
    player.usedScenarios.push(chosen.id);
  }
  if (chosen.once) player.onceDone.push(chosen.id);
  return chosen.id;
}

// ----- Turnos -----
function beginTurn() {
  expireEventPoints();
  player.energy = clamp(player.energy + 8 * (1 + recoveryBonus()), 0, 100); // descanso natural entre meses
  player.experience += 1;
  const income = monthlyIncome();
  player.money += income;
  if (player.turn > 1 || player.season > 1) addLog(`💶 Ingresos del mes: +$${income}.`);
  player.currentScenarioId = pickScenarioId();
  player.phase = "scenario";
  if (olympicEvent() && !player.olympicCalled) {
    player.olympicCalled = true;
    addLog(olympicSummoned()
      ? `🇪🇸 ${player.country} te convoca para los Juegos Olímpicos de ${olympicHost()} en agosto. ¡A por la medalla!`
      : `🇪🇸 este año hay Juegos Olímpicos en ${olympicHost()}, pero ${player.country} no te convoca todavía (450 puntos o 70 de fama).`,
      olympicSummoned() ? "positive" : "");
  }
  saveGame();
  renderAll();
}

function handleChoice(index) {
  if (modalOpen || seasonSummaryPending || activeMatch || tournamentInProgress() || player.phase !== "scenario") return;
  const scenario = getScenario(player.currentScenarioId);
  const choice = scenario?.choices[index];
  if (!choice) return;

  const cost = Math.max(0, -(choice.effects.money || 0));
  if (player.money < cost) {
    addLog(`No tienes fondos suficientes. Necesitas $${cost}.`, "negative");
    renderScenario();
    return;
  }
  if (player.injuryMonths > 0 && choice.effects.match) {
    addLog(`No puedes competir hasta completar la rehabilitación (${player.injuryMonths} meses restantes).`, "negative");
    return;
  }

  applyEffects(choice.effects);
  if (choice.log) addLog(choice.log);

  if (choice.effects.match) {
    const surface = (eventForTurn(player.turn) || {}).surface || randomItem(SURFACES);
    registerWorkload(surface, Boolean(choice.effects.highStakes));
    startMatch({
      title: scenario.title,
      rival: pickRival(choice.effects.highStakes),
      highStakes: choice.effects.highStakes,
      surface,
      format: choice.effects.highStakes ? "highStakes" : "scenario"
    });
    renderStats();
    return;
  }
  if (choice.effects.risk && (player.energy < 20 || Math.random() < injuryRisk())) {
    applyEffects({ energy: -25, skill: -10, fame: -5 });
    addLog("⚠️ ¡Colapso físico! Jugar agotado tuvo consecuencias graves.", "negative");
  }
  finishScenario();
}

// Tras el escenario del mes: ¿hay torneos a los que puedas apuntarte?
function finishScenario() {
  const events = eventsForTurn(player.turn);
  const available = events.filter(event => !tournamentResults[event.id] && tournamentEligibility(event).ok);
  if (available.length) {
    player.phase = "tournament";
    selectedTournamentId = available[0].id;
    renderAll();
    return;
  }
  events.forEach(event => {
    if (tournamentResults[event.id]) return;
    tournamentResults[event.id] = {
      status: player.injuryMonths > 0 ? "lesion" : "ineligible",
      winner: "", points: 0, name: event.name
    };
  });
  endTurn();
}

function endTurn() {
  updateRank();
  if (player.injuryMonths > 0 && !skipInjuryTick) {
    player.injuryMonths--;
    if (player.injuryMonths === 0) {
      player.ovrBonus = clamp(player.ovrBonus + 4, -12, 12);
      player.ovr = computeOvr();
      addLog("✅ Has completado la rehabilitación, recuperas parte de tu nivel y puedes volver a competir.", "positive");
    }
  }
  skipInjuryTick = false;
  if (player.turn < SEASON_LENGTH) {
    player.turn++;
    beginTurn();
  } else {
    showSeasonSummary();
  }
}

// ----- Temporadas -----
function showSeasonSummary() {
  if (seasonSummaryPending) return;
  seasonSummaryPending = true;
  if (player.previousSeasonNonTournamentPoints > 0) {
    const expired = player.previousSeasonNonTournamentPoints;
    player.rankingPoints = Math.max(0, player.rankingPoints - expired);
    player.seasonPointsExpired += expired;
    addLog(`⌛ Caducan ${expired} puntos de partidos de la temporada anterior.`, "negative");
    updateRank();
  }
  const endingPosition = rankingPositionForPoints(player.rankingPoints);
  const positionChange = player.seasonStartPosition - endingPosition;
  const netPoints = player.rankingPoints - player.seasonStartRankingPoints;
  recordSeasonRanking();

  document.getElementById("season-summary-title").textContent = `¡Se acabó la temporada ${player.season}!`;
  document.getElementById("season-summary-message").textContent =
    `Has cerrado el año en la categoría ${player.rank}, puesto simulado ${endingPosition}.`;
  document.getElementById("summary-record").textContent = `${player.seasonMatchesWon}V - ${player.seasonMatchesLost}D`;
  document.getElementById("summary-ranking-change").textContent = positionChange > 0 ? `↑ ${positionChange} puestos`
    : positionChange < 0 ? `↓ ${Math.abs(positionChange)} puestos` : "Sin cambios";
  document.getElementById("summary-points-change").textContent =
    `${netPoints > 0 ? "+" : ""}${netPoints} (${player.seasonPoints} ganados · ${player.seasonPointsExpired} caducados)`;
  document.getElementById("summary-tournaments").textContent = `${player.seasonTournamentEntries} / ${SEASON_LENGTH}`;
  const winners = Object.values(tournamentResults)
    .filter(result => result.status === "completed" && result.winner === player.name)
    .map(result => result.name);
  document.getElementById("summary-tournament-winners").textContent = winners.length
    ? `🏆 Tus títulos de la temporada: ${winners.join(" · ")}`
    : "No ganaste ningún torneo esta temporada.";
  const seasonMedals = player.medals.filter(medal => medal.season === player.season);
  if (seasonMedals.length) {
    document.getElementById("summary-tournament-winners").textContent +=
      ` 🥇 Medallas olímpicas: ${seasonMedals.map(medal => medal.medal).join(" · ")}.`;
  }

  document.getElementById("career-tabs").hidden = true;
  ["career-panel", "ranking-panel", "calendar-panel", "shop-panel"].forEach(id => { document.getElementById(id).hidden = true; });
  document.getElementById("season-summary").hidden = false;
  renderStats();
  renderRanking();
}

function continueAfterSeasonSummary() {
  if (!seasonSummaryPending) return;
  seasonSummaryPending = false;
  document.getElementById("season-summary").hidden = true;
  document.getElementById("career-tabs").hidden = false;
  startNextSeason();
}

function startNextSeason() {
  if (player.age + 1 > MAX_AGE) {
    endGame(`Con ${player.age} años, tu cuerpo dice basta y cierras tu carrera por edad.`);
    return;
  }
  player.previousSeasonNonTournamentPoints = player.seasonNonTournamentPoints;
  previousSeasonTournamentPoints = { ...currentSeasonTournamentPoints };
  currentSeasonTournamentPoints = {};
  player.season++;
  player.age++;
  player.turn = 1;
  player.seasonPoints = 0;
  player.seasonMatchesWon = 0;
  player.seasonMatchesLost = 0;
  player.seasonTournamentEntries = 0;
  player.seasonPointsExpired = 0;
  player.seasonNonTournamentPoints = 0;
  player.seasonStartPosition = rankingPositionForPoints(player.rankingPoints);
  player.seasonStartRankingPoints = player.rankingPoints;
  player.wildcardUsed = false;
  player.olympicCalled = false;
  player.usedScenarios = [];
  tournamentResults = {};
  tournamentProcessed = {};
  activeTournament = null;
  selectedTournamentId = TOURNAMENTS[0].id;
  player.energy = clamp(player.energy + 25 * (1 + recoveryBonus()), 0, 100);
  player.workload = Math.max(0, player.workload - 2);
  addLog(`📅 Empieza la temporada ${player.season}. Cumples ${player.age} años y recuperas energía.`, "positive");

  if (player.age >= 31) {
    // La veteranía compensa parte del declive físico: experiencia == lectura del juego.
    const drop = Math.max(0, player.age - 30 - Math.floor(player.experience / 40));
    player.skill = clamp(player.skill - drop, 0, 100);
    player.ovr = computeOvr();
    if (drop > 0) addLog(`⏳ El paso de los años pesa: pierdes ${drop} de técnica, pero tu experiencia compensa el resto.`, "negative");
  }

  // Temporadas completas perdidas por una lesión larga
  while (player.injuryMonths >= SEASON_LENGTH) {
    player.injuryMonths -= SEASON_LENGTH;
    player.seasonsMissed++;
    Object.entries(previousSeasonTournamentPoints).forEach(([eventId, points]) => {
      player.rankingPoints = Math.max(0, player.rankingPoints - points);
      player.seasonPointsExpired += points;
      delete previousSeasonTournamentPoints[eventId];
    });
    player.rankingPoints = Math.max(0, player.rankingPoints - player.previousSeasonNonTournamentPoints);
    player.seasonPointsExpired += player.previousSeasonNonTournamentPoints;
    player.previousSeasonNonTournamentPoints = 0;
    updateRank();
    recordSeasonRanking(true);
    const remaining = player.injuryMonths;
    addLog(`🏥 Te pierdes la temporada ${player.season} completa por la lesión. Queda${remaining === 1 ? "" : "n"} ${remaining} ${remaining === 1 ? "mes" : "meses"} de recuperación y caducan los puntos no defendidos.`, "negative");
    player.seasonPointsExpired = 0;
    player.season++;
    player.age++;
    player.seasonStartPosition = rankingPositionForPoints(player.rankingPoints);
    player.seasonStartRankingPoints = player.rankingPoints;
  }

  if (player.age > MAX_AGE) {
    endGame("La lesión te ha mantenido tanto tiempo fuera que ya no hay vuelta atrás: te retiras.");
    return;
  }
  showCareerTab("career");
  beginTurn();
}

// ----- Inicio, carga y final -----
function prepareGameScreen() {
  document.getElementById("match-screen").hidden = true;
  document.getElementById("scenario-box").hidden = false;
  document.getElementById("choices-container").hidden = false;
  document.getElementById("career-tabs").hidden = false;
  document.getElementById("season-summary").hidden = true;
  closeModal();
  document.getElementById("log").replaceChildren();
  document.getElementById("start-screen").classList.remove("active");
  document.getElementById("end-screen").classList.remove("active");
  document.getElementById("game-screen").classList.add("active");
  showCareerTab("career");
}

function startGame() {
  const name = document.getElementById("player-name").value.trim();
  if (!name) { alert("Por favor, ingresa un nombre o apodo."); return; }
  const country = document.getElementById("player-country").value || "España";
  const style = document.getElementById("player-style").value || "Polivalente";
  resetState(name, country);
  player.style = style;
  prepareGameScreen();
  addLog(`🎾 Comienza la carrera de ${player.name}. ¡Mucho éxito!`, "positive");
  beginTurn();
}

function continueGame() {
  if (!loadSave()) { clearSave(); alert("No se pudo cargar la partida guardada."); return; }
  prepareGameScreen();
  addLog(`📂 Carrera de ${player.name} cargada.`, "positive");
  renderAll();
}

function retireCareer() {
  if (modalOpen || !document.getElementById("game-screen").classList.contains("active") || activeMatch) return;
  if (!confirm("¿Seguro que quieres retirarte? Tu carrera terminará aquí.")) return;
  endGame(`Te retiras a los ${player.age} años, después de ${player.season} temporadas como profesional.`);
}

function endGame(message) {
  clearSave();
  document.getElementById("game-screen").classList.remove("active");
  document.getElementById("end-screen").classList.add("active");
  document.getElementById("end-title").textContent = "🏁 Retiro del tenis";
  document.getElementById("end-message").textContent = message;
  document.getElementById("end-stats").textContent = [
    `🏅 Rango final: ${player.rank}`,
    `⭐ OVR: ${player.ovr}`,
    `🎂 Edad al retirarte: ${player.age} años`,
    `📅 Temporadas de carrera: ${player.season} · Temporadas perdidas por lesión: ${player.seasonsMissed}`,
    `📈 Puntos de ranking: ${player.rankingPoints}`,
    `⚡ Energía: ${Math.round(player.energy)} | 🎯 Técnica: ${player.skill}`,
    `🌟 Fama: ${player.fame} | 💰 Dinero: $${player.money}`,
    `📊 Partidos: ${player.matchesWon}V - ${player.matchesLost}D`,
    `🏆 Títulos en tu vitrina: ${(player.trophies || []).length}`,
    `🥇 Medallas olímpicas: ${(player.medals || []).length}`,
    `🧠 Experiencia: ${player.experience} · Estilo: ${player.style}`,
    `🎾 Material comprado: ${(player.inventory || []).length} artículos`
  ].join("\n");
}
