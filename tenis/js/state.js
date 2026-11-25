// ===== Estado de la partida y guardado =====
function newPlayer(name, country = "España") {
  return {
    name, country,
    energy: 70, skill: 50, ovr: 50, ovrBonus: 0, fame: 10, money: 100, sponsor: 0,
    rank: RANKS[0].name, rankingPoints: 0,
    matchesWon: 0, matchesLost: 0,
    turn: 1, age: 18, season: 1,
    injuryMonths: 0, seasonsMissed: 0,
    seasonPoints: 0, seasonMatchesWon: 0, seasonMatchesLost: 0,
    seasonTournamentEntries: 0, seasonPointsExpired: 0,
    seasonNonTournamentPoints: 0, previousSeasonNonTournamentPoints: 0,
    seasonStartPosition: RANKS[0].position, seasonStartRankingPoints: 0,
    phase: "scenario",            // "scenario" | "tournament"
    currentScenarioId: null,
    usedScenarios: [], onceDone: [], flags: {},
    inventory: [],                // objetos comprados en la tienda
    trophies: [],                 // vitrina de torneos ganados
    medals: [],                   // medallas olímpicas (oro, plata, bronce)
    finals: [],                   // finales disputadas, se ganen o no
    headToHead: {},               // balance por rival
    experience: 0,                // mitiga el declive físico con los años
    workload: 0,                  // cargas seguidas: alimenta el riesgo de lesión
    lastSurface: "Dura",
    style: "Polivalente",         // estilo que encaja con cada raqueta
    wildcardUsed: false, olympicCalled: false
  };
}

let player = newPlayer("");
let rankingHistory = [];
let currentSeasonTournamentPoints = {};
let previousSeasonTournamentPoints = {};
let tournamentProcessed = {};
let tournamentResults = {};
let selectedTournamentId = TOURNAMENTS[0].id;
// Estado temporal (no se guarda)
let activeTournament = null;
let activeMatch = null;
let seasonSummaryPending = false;
let skipInjuryTick = false;

function resetState(name, country = "España") {
  player = newPlayer(name, country);
  rankingHistory = [];
  currentSeasonTournamentPoints = {};
  previousSeasonTournamentPoints = {};
  tournamentProcessed = {};
  tournamentResults = {};
  selectedTournamentId = TOURNAMENTS[0].id;
  activeTournament = null;
  activeMatch = null;
  seasonSummaryPending = false;
  skipInjuryTick = false;
}

function saveGame() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      version: 1, player, rankingHistory,
      currentSeasonTournamentPoints, previousSeasonTournamentPoints,
      tournamentProcessed, tournamentResults, selectedTournamentId
    }));
  } catch (error) { /* sin almacenamiento disponible: se juega igual */ }
}

function hasSave() {
  try { return Boolean(localStorage.getItem(SAVE_KEY)); } catch (error) { return false; }
}

function loadSave() {
  try {
    const data = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (!data || data.version !== 1) return false;
    resetState(data.player.name);
    player = Object.assign(newPlayer(data.player.name), data.player);
    rankingHistory = data.rankingHistory || [];
    currentSeasonTournamentPoints = data.currentSeasonTournamentPoints || {};
    previousSeasonTournamentPoints = data.previousSeasonTournamentPoints || {};
    tournamentProcessed = data.tournamentProcessed || {};
    tournamentResults = data.tournamentResults || {};
    // Los cuadros en curso no se guardan: se cierran como pasados para no bloquear la partida.
    Object.values(tournamentResults).forEach(result => {
      if (result.status === "in-progress") result.status = "passed";
    });
    player.inventory = Array.isArray(player.inventory) ? player.inventory : [];
    player.trophies = Array.isArray(player.trophies) ? player.trophies : [];
    player.medals = Array.isArray(player.medals) ? player.medals : [];
    player.finals = Array.isArray(player.finals) ? player.finals : [];
    player.headToHead = player.headToHead && typeof player.headToHead === "object" ? player.headToHead : {};
    player.experience = player.experience || 0;
    player.workload = player.workload || 0;
    player.lastSurface = player.lastSurface || "Dura";
    player.style = player.style || "Polivalente";
    player.country = player.country || "España";
    selectedTournamentId = data.selectedTournamentId || TOURNAMENTS[0].id;
    return true;
  } catch (error) { return false; }
}

function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch (error) { /* nada */ }
}
