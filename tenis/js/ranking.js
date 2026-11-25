// ===== Ranking, categorías, caducidad de puntos y calendario dinámico =====
function currentRankIndex() {
  return Math.max(0, RANKS.findIndex(rank => rank.name === player.rank));
}

function rankingPositionForPoints(points) {
  const score = Math.max(0, points);
  for (let i = 1; i < RANKS.length; i++) {
    if (score <= RANKS[i].minPoints) {
      const prev = RANKS[i - 1];
      const next = RANKS[i];
      const progress = (score - prev.minPoints) / (next.minPoints - prev.minPoints);
      return Math.max(1, Math.round(prev.position + (next.position - prev.position) * progress));
    }
  }
  return 1;
}

function updateRank() {
  const previousIndex = currentRankIndex();
  const current = RANKS.slice().reverse().find(rank => player.rankingPoints >= rank.minPoints) || RANKS[0];
  player.rank = current.name;
  const currentIndex = currentRankIndex();
  if (currentIndex !== previousIndex) {
    const promotion = currentIndex > previousIndex;
    addLog(`${promotion ? "📈 ¡Subiste" : "📉 Bajaste"} de categoría: ${player.rank}.`, promotion ? "positive" : "negative");
  }
}

// ----- Juegos Olímpicos: un ciclo de cuatro años y convocatoria del país -----
function isOlympicSeason() {
  return (player.season - 1) % 4 === 0;
}

function olympicHost() {
  const cycle = Math.floor((player.season - 1) / 4);
  return OLYMPIC_HOSTS[cycle % OLYMPIC_HOSTS.length];
}

// En tenis los Juegos no reparten puntos ATP: la recompensa es medalla, fama y patrocinio.
function olympicCountryQuota(country) {
  return ["España", "Argentina", "Serbia", "Alemania", "Francia", "Estados Unidos", "Reino Unido", "Italia", "Canadá", "Australia"].includes(country) ? 2 : 1;
}

function olympicSummoned() {
  return (player.rankingPoints >= 450 || player.fame >= 70) && olympicCountryQuota(player.country) >= 1;
}

function olympicEvent() {
  if (!isOlympicSeason()) return null;
  return {
    id: `olympics-${player.season}`,
    name: `Juegos Olímpicos · ${olympicHost()}`,
    tier: "Juegos Olímpicos",
    month: 7,
    surface: "Dura",
    minPoints: 450,
    awards: [0, 0, 0, 0],
    prizes: [0, 0, 0, 0],
    cost: 0,
    field: 84,
    pool: "elite",
    olympic: true,
    medals: ["Oro", "Plata", "Bronce"]
  };
}

// Puesto aproximado que da acceso directo al cuadro principal.
function entryPositionFor(event) {
  if (!event) return 2000;
  if (event.mastersCup) return 8;
  if (event.olympic) return 200;
  if (event.tier === "Grand Slam" || event.tier.startsWith("ATP Masters")) return 300;
  if (event.tier === "ATP 500") return 600;
  return 1500;
}

// Varios torneos al mes: el nivel decide qué categorías puedes inscribirte.
function eventsForTurn(turn) {
  const events = TOURNAMENTS.filter(event => event.month === turn - 1);
  const olympics = olympicEvent();
  if (olympics && olympics.month === turn - 1) events.push(olympics);
  return events;
}

function eventForTurn(turn) {
  return eventsForTurn(turn)[0] || null;
}

function eventsForSeason() {
  const events = [];
  for (let turn = 1; turn <= SEASON_LENGTH; turn++) events.push(...eventsForTurn(turn));
  return events;
}

function findEventById(id) {
  const base = TOURNAMENTS.find(event => event.id === id);
  if (base) return base;
  const olympics = olympicEvent();
  return olympics && olympics.id === id ? olympics : null;
}

// Al llegar el mes de un torneo caducan los puntos que ganaste en él hace un año
function expireEventPoints() {
  eventsForTurn(player.turn).forEach(event => {
    if (tournamentProcessed[event.id]) return;
    const expired = previousSeasonTournamentPoints[event.id] || 0;
    if (expired > 0) {
      player.rankingPoints = Math.max(0, player.rankingPoints - expired);
      player.seasonPointsExpired += expired;
      delete previousSeasonTournamentPoints[event.id];
      addLog(`⌛ Caducan ${expired} puntos de ${event.name}; toca defenderlos en esta edición.`, "negative");
      updateRank();
    }
    tournamentProcessed[event.id] = true;
  });
}

function recordSeasonRanking(missed = false) {
  const position = rankingPositionForPoints(player.rankingPoints);
  rankingHistory.push({
    season: player.season,
    age: player.age,
    rank: player.rank,
    points: missed ? -player.seasonPointsExpired : player.seasonPoints - player.seasonPointsExpired,
    earnedPoints: missed ? 0 : player.seasonPoints,
    expiredPoints: player.seasonPointsExpired,
    totalPoints: player.rankingPoints,
    wins: missed ? 0 : player.seasonMatchesWon,
    losses: missed ? 0 : player.seasonMatchesLost,
    position,
    positionChange: player.seasonStartPosition - position,
    missed
  });
}
