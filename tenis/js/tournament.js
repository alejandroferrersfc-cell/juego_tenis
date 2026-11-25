// ===== Torneos: inscripción, clasificatoria, cuadros, rondas y premios =====
const ROUND_NAMES = ["Cuartos de final", "Semifinal", "Final"];
const ROUND_NAMES_R16 = ["Dieciseisavos de final", "Cuartos de final", "Semifinal", "Final"];
const ROUND_NAMES_R32 = ["Treintaydosavos de final", "Dieciseisavos de final", "Cuartos de final", "Semifinal", "Final"];
const QUALIFY_NAMES = ["Clasificatoria 1", "Clasificatoria 2"];
const GROUP_NAMES = ["Fase de grupos · Jornada 1", "Fase de grupos · Jornada 2", "Fase de grupos · Jornada 3"];
const PLACEMENT_NAMES = ["campeón", "finalista", "semifinalista", "cuartofinalista", "dieciseisavos de final", "treintaydosavos de final"];

function tournamentInProgress() {
  return Boolean(activeTournament && !activeTournament.finished);
}

function tournamentEligibility(event) {
  if (!event) return { ok: false, reason: "No hay torneo." };
  if (player.injuryMonths > 0) {
    return { ok: false, reason: `Lesionado: ${player.injuryMonths} meses de baja.` };
  }
  if (event.olympic && !olympicSummoned()) {
    return { ok: false, reason: `${player.country} no te convoca: necesitas 450 puntos o 70 de fama (cupo de ${olympicCountryQuota(player.country)} por país).` };
  }
  const position = rankingPositionForPoints(player.rankingPoints);
  const limit = entryPositionFor(event);
  let qualifying = false;
  let wildcard = false;
  if (!event.olympic) {
    const needed = event.minPoints > 0 ? event.minPoints : 250;
    if (position > limit) {
      wildcard = !player.wildcardUsed && player.fame >= 60 && position <= limit * 2;
      qualifying = !wildcard && position <= limit * 3 &&
        player.rankingPoints >= (event.minPoints > 0 ? needed * 0.35 : 0);
      if (!wildcard && !qualifying) {
        return { ok: false, reason: `Necesitas estar cerca del puesto ${limit} (ahora ${position}) o pasar por la clasificatoria.` };
      }
    }
  }
  if (event.mastersCup && player.rankingPoints < event.minPoints && position > 8) {
    return { ok: false, reason: "La Copa de Maestros está reservada al top 8 o a quienes tienen 3500 puntos." };
  }
  if (player.money < event.cost) {
    return { ok: false, reason: `Necesitas $${event.cost} para la inscripción.` };
  }
  return { ok: true, qualifying, wildcard };
}

// ----- Utilidades del cuadro -----
function makeRivals(event, count) {
  let source = event.pool === "local" ? LOCAL_RIVALS
    : event.pool === "pro" ? PRO_RIVALS
    : PRO_RIVALS.concat(STAR_RIVALS);
  if (event.olympic) {
    // Cupo por país: como máximo un rival de la misma nación del jugador.
    const same = source.filter(rival => rival.country === player.country).slice(0, olympicCountryQuota(player.country) - 1);
    source = same.concat(source.filter(rival => rival.country !== player.country));
  }
  const rivals = shuffle(source.filter(rival => rival.name !== player.name)).slice(0, count).map(rival => ({
    name: rival.name,
    ovr: clamp(event.field + rival.seed + randInt(-2, 2), 35, 95),
    style: rival.style || randomItem(RIVAL_STYLES),
    brand: rival.brand || randomItem(TENNIS_BRANDS),
    country: rival.country || "Internacional"
  }));
  for (let n = 1; rivals.length < count; n++) {
    rivals.push({ name: `Clasificado ${n}`, ovr: event.field, style: randomItem(RIVAL_STYLES), brand: randomItem(TENNIS_BRANDS), country: "Internacional" });
  }
  return rivals;
}

function pendingMatch(a, b) {
  // El jugador siempre ocupa el lado "a" para que startTournamentMatch use "b" como rival.
  if (b && b.you && !(a && a.you)) return { a: b, b: a, winner: null, score: "" };
  return { a, b, winner: null, score: "" };
}

function assignSeeds(rivals) {
  rivals.slice().sort((a, b) => b.ovr - a.ovr).slice(0, Math.min(8, rivals.length))
    .forEach((rival, index) => { rival.drawSeed = index + 1; });
  return rivals;
}

function simulateSetScore(a, b, bestOf = 2) {
  const need = bestOf === 3 ? 2 : 2;
  let winsA = 0, winsB = 0;
  const sets = [];
  const chance = clamp(0.5 + (a.ovr - b.ovr) * 0.02, 0.2, 0.8);
  while (winsA < need && winsB < need) {
    const aWins = Math.random() < chance;
    const games = randInt(4, 6);
    if (Math.random() < 0.18) {
      sets.push(aWins ? `7-6(${randInt(3, 5)})` : `6-7(${randInt(3, 5)})`);
    } else {
      const loser = randInt(2, games - 1);
      sets.push(aWins ? `${games}-${loser}` : `${loser}-${games}`);
    }
    if (aWins) winsA++; else winsB++;
  }
  return sets.join(" · ");
}

function simulateMatchInPlace(match, event = null) {
  const { a, b } = match;
  const aWins = Math.random() < clamp(0.5 + (a.ovr - b.ovr) * 0.02, 0.15, 0.85);
  match.winner = aWins ? a : b;
  match.score = simulateSetScore(a, b, event && event.tier === "Grand Slam" ? 3 : 2);
  return match;
}

function pairsFromWinners(matches, event = null) {
  const pairs = [];
  for (let i = 0; i < matches.length; i += 2) {
    pairs.push(pendingMatch(matches[i].winner, matches[i + 1].winner));
  }
  return pairs;
}

// Según el ranking se entra al cuadro en una ronda u otra, pero NUNCA más allá de cuartos.
function tournamentEntryRound(event) {
  const reference = event.minPoints > 0 ? event.minPoints : 250;
  const ratio = player.rankingPoints / reference;
  if (ratio < 0.3) return -2;
  if (ratio < 0.6) return -1;
  return 0;
}

function roundNamesFor(totalRounds) {
  if (totalRounds === 5) return ROUND_NAMES_R32.slice();
  if (totalRounds === 4) return ROUND_NAMES_R16.slice();
  return ROUND_NAMES.slice();
}

function bestRacketBrand() {
  const items = SHOP_ITEMS.filter(item => item.type === "racket" && player.inventory.includes(item.id));
  if (!items.length) return randomItem(TENNIS_BRANDS);
  return items.reduce((best, item) => (item.advantage > best.advantage ? item : best)).brand;
}

function youInDraw() {
  return { name: player.name, ovr: player.ovr, you: true, brand: bestRacketBrand(), country: player.country, style: player.style };
}

function buildMainDraw(event, entryRound, deferPlayer) {
  const totalRounds = 3 - entryRound;
  const you = youInDraw();
  let matchIndex = 0;
  let firstRound = [];

  if (entryRound < 0) {
    const rivals = assignSeeds(makeRivals(event, Math.pow(2, totalRounds) - 1));
    const placeholder = { name: "Clasificado", ovr: player.ovr, you: false, placeholder: true, country: player.country };
    const participants = [deferPlayer ? placeholder : you, ...rivals];
    for (let i = 0; i < participants.length; i += 2) {
      const match = pendingMatch(participants[i], participants[i + 1]);
      if (i > 0) simulateMatchInPlace(match, event);
      firstRound.push(match);
    }
  } else {
    const rivals = assignSeeds(makeRivals(event, 8));
    firstRound = [];
    for (let i = 0; i < rivals.length; i += 2) firstRound.push(pendingMatch(rivals[i], rivals[i + 1]));
    for (let roundIndex = 0; roundIndex < entryRound; roundIndex++) {
      firstRound.forEach(match => simulateMatchInPlace(match, event));
      if (roundIndex < entryRound - 1) firstRound = pairsFromWinners(firstRound, event);
    }
    matchIndex = randInt(0, firstRound.length - 1);
    const host = firstRound[matchIndex];
    firstRound[matchIndex] = pendingMatch(you, host.b);
    firstRound.forEach((match, index) => {
      if (index !== matchIndex) simulateMatchInPlace(match, event);
    });
  }
  return { rounds: [firstRound], matchIndex };
}

function buildQualifyingRounds(event) {
  const rivals = makeRivals(event, 2).map(rival => ({ ...rival, ovr: rival.ovr - 6 }));
  return [
    [pendingMatch(youInDraw(), rivals[0])],
    [pendingMatch({ ...youInDraw(), name: "Ganador de la clasificatoria", you: true, placeholder: true }, rivals[1])]
  ];
}

function groupStandings(tournament, isPlayerGroup) {
  const group = isPlayerGroup ? tournament.groupA : tournament.groupB;
  const score = group.map(playerItem => ({ player: playerItem, wins: 0, losses: 0 }));
  tournament.rounds.slice(0, 3).forEach(round => {
    const matches = isPlayerGroup ? [round[0], round[1]] : [round[2], round[3]];
    matches.forEach(match => {
      if (!match.winner) return;
      const entry = score.find(item => item.player.name === match.winner.name);
      if (entry) entry.wins++;
      const loser = match.winner === match.a ? match.b : match.a;
      const lost = score.find(item => item.player.name === loser.name);
      if (lost) lost.losses++;
    });
  });
  return score.sort((a, b) => b.wins - a.wins || b.player.ovr - a.player.ovr);
}

function buildSemis(tournament) {
  const a = groupStandings(tournament, true);
  const b = groupStandings(tournament, false);
  const qualified = a.slice(0, 2).some(entry => entry.player.you);
  const other = a.find(entry => !entry.player.you && entry.wins >= 2) || a.find(entry => !entry.player.you);
  const semi = qualified
    ? pendingMatch(youInDraw(), other.player)
    : pendingMatch(a[0].player, a[1].player);
  tournament.rounds[3] = [semi, pendingMatch(b[0].player, b[1].player)];
  tournament.rounds[3].forEach(match => {
    if (!match.a.you && !match.b.you) simulateMatchInPlace(match, tournament.event);
  });
  tournament.semisBuilt = true;
  return qualified;
}

function createMastersCupDraw(event) {
  const rivals = assignSeeds(makeRivals(event, 7));
  const groupA = [youInDraw(), rivals[0], rivals[1], rivals[2]];
  const groupB = rivals.slice(3);
  const rounds = [
    [pendingMatch(groupA[0], groupA[1]), pendingMatch(groupA[2], groupA[3]), pendingMatch(groupB[0], groupB[1]), pendingMatch(groupB[2], groupB[3])],
    [pendingMatch(groupA[0], groupA[2]), pendingMatch(groupA[1], groupA[3]), pendingMatch(groupB[0], groupB[2]), pendingMatch(groupB[1], groupB[3])],
    [pendingMatch(groupA[0], groupA[3]), pendingMatch(groupA[1], groupA[2]), pendingMatch(groupB[0], groupB[3]), pendingMatch(groupB[1], groupB[2])]
  ];
  rounds.forEach(round => round.slice(1).forEach(match => simulateMatchInPlace(match, event)));
  activeTournament = {
    event, rounds, roundNames: GROUP_NAMES.concat(["Semifinal", "Final"]),
    roundIndex: 0, matchIndex: 0, champion: "", entryRound: 0,
    totalRounds: 5, mainStartIndex: 3, mainRounds: 2, qualifying: false,
    format: "roundrobin", groupA, groupB, groupIndex: 0, groupWins: 0, groupLosses: 0, semisBuilt: false
  };
}

function createTournamentDraw(event, qualifying = false) {
  if (event.mastersCup) { createMastersCupDraw(event); return; }
  const entryRound = qualifying ? -2 : tournamentEntryRound(event);
  const mainRounds = 3 - entryRound;
  const { rounds: mainRoundsData, matchIndex } = buildMainDraw(event, entryRound, qualifying);
  let rounds = mainRoundsData;
  let roundNames = roundNamesFor(mainRounds);
  let mainStartIndex = 0;
  if (qualifying) {
    rounds = buildQualifyingRounds(event).concat(rounds);
    roundNames = QUALIFY_NAMES.concat(roundNames);
    mainStartIndex = QUALIFY_NAMES.length;
  }
  activeTournament = {
    event, rounds, roundNames, roundIndex: 0,
    matchIndex: qualifying ? 0 : matchIndex,
    qualifierSlot: matchIndex, champion: "", entryRound,
    totalRounds: mainStartIndex + mainRounds, mainStartIndex, mainRounds, qualifying,
    format: "knockout", semisBuilt: false
  };
  // El hueco del clasificado se resuelve aunque el jugador no pase la clasificatoria.
  if (qualifying) simulateMatchInPlace(activeTournament.rounds[mainStartIndex][matchIndex], event);
}

function simulateTournamentRoundsFrom(fromIndex) {
  const tournament = activeTournament;
  if (tournament.format === "roundrobin") {
    if (!tournament.semisBuilt) buildSemis(tournament);
    for (let index = fromIndex; index < tournament.totalRounds; index++) {
      if (index === tournament.mainStartIndex) continue;
      tournament.rounds[index] = pairsFromWinners(tournament.rounds[index - 1], tournament.event)
        .map(match => simulateMatchInPlace(match, tournament.event));
    }
  } else {
    for (let index = fromIndex; index < tournament.totalRounds; index++) {
      const previous = tournament.rounds[index - 1];
      if (!previous) break;
      tournament.rounds[index] = pairsFromWinners(previous, tournament.event)
        .map(match => simulateMatchInPlace(match, tournament.event));
    }
  }
  const final = tournament.rounds[tournament.totalRounds - 1];
  if (final && final[0] && final[0].winner) tournament.champion = final[0].winner.name;
}

function prepareNextTournamentRound(roundIndex, matchIndex) {
  const tournament = activeTournament;
  if (tournament.format === "roundrobin" && roundIndex < tournament.mainStartIndex) {
    tournament.roundIndex = roundIndex + 1;
    tournament.matchIndex = 0;
    return true;
  }
  if (roundIndex < tournament.mainStartIndex) {
    const nextIndex = roundIndex + 1;
    const winner = tournament.rounds[roundIndex][matchIndex].winner;
    if (nextIndex === tournament.mainStartIndex) {
      const slot = tournament.rounds[nextIndex][tournament.qualifierSlot];
      slot.a = { ...winner, you: true, placeholder: false };
      tournament.roundIndex = nextIndex;
      tournament.matchIndex = tournament.qualifierSlot;
    } else {
      tournament.rounds[nextIndex][0].a = winner;
      tournament.roundIndex = nextIndex;
      tournament.matchIndex = 0;
    }
    return true;
  }
  if (roundIndex === tournament.totalRounds - 1) return false;
  const round = tournament.rounds[roundIndex];
  const nextMatchIndex = Math.floor(matchIndex / 2);
  const next = [];
  for (let i = 0; i < round.length; i += 2) {
    const match = pendingMatch(round[i].winner, round[i + 1].winner);
    if (i / 2 !== nextMatchIndex) simulateMatchInPlace(match, tournament.event);
    next.push(match);
  }
  tournament.rounds[roundIndex + 1] = next;
  tournament.roundIndex = roundIndex + 1;
  tournament.matchIndex = nextMatchIndex;
  return true;
}

// ----- Inscripción y turno -----
function hasPlayedTournamentThisTurn() {
  const ids = eventsForTurn(player.turn).map(event => event.id);
  return Object.entries(tournamentResults).some(([id, result]) =>
    ids.includes(id) && ["completed", "in-progress"].includes(result.status));
}

function closeOtherMonthEvents(event) {
  eventsForTurn(player.turn).forEach(other => {
    if (other.id === event.id || tournamentResults[other.id]) return;
    tournamentResults[other.id] = {
      status: "passed", winner: "", points: 0, name: other.name,
      reason: `Ese mes competiste en ${event.name}.`
    };
  });
}

function enterTournament(eventId) {
  const event = findEventById(eventId) || TOURNAMENTS.find(item => item.id === eventId);
  if (!event || player.phase !== "tournament" || tournamentInProgress()) return;
  if (!eventsForTurn(player.turn).some(item => item.id === event.id)) return;
  if (hasPlayedTournamentThisTurn()) return;
  const eligibility = tournamentEligibility(event);
  if (!eligibility.ok) return;

  player.money -= event.cost;
  if (eligibility.wildcard) {
    player.wildcardUsed = true;
    addLog(`🎟️ Recibes una invitación (wildcard) para ${event.name} gracias a tu fama.`, "positive");
  }
  if (eligibility.qualifying) addLog(`🎯 Entrarás por la clasificatoria de ${event.name}: debes ganar dos partidos.`, "positive");
  if (event.olympic) addLog(`🇪🇸 ${player.country} te convoca para los Juegos Olímpicos de ${olympicHost()}.`, "positive");
  player.seasonTournamentEntries++;
  registerWorkload(event.surface, true);
  closeOtherMonthEvents(event);
  selectedTournamentId = event.id;
  tournamentResults[event.id] = { status: "in-progress", winner: "", points: 0, name: event.name, tier: event.tier };
  createTournamentDraw(event, eligibility.qualifying);
  addLog(`✈️ Te inscribes en ${event.name} (-$${event.cost}).`, "positive");
  startTournamentMatch();
}

function skipTournament() {
  if (tournamentInProgress()) return;
  eventsForTurn(player.turn).forEach(event => {
    if (tournamentResults[event.id]) return;
    tournamentResults[event.id] = { status: "passed", winner: "", points: 0, name: event.name };
  });
  player.workload = Math.max(0, player.workload - 1);
  addLog("Decides no jugar ningún torneo este mes: recuperas carga física.");
  endTurn();
}

function startTournamentMatch() {
  if (!activeTournament) return;
  const { roundIndex, matchIndex, event, roundNames } = activeTournament;
  const match = activeTournament.rounds[roundIndex][matchIndex];
  showCareerTab("career");
  const format = event.tier === "Grand Slam" ? "slam"
    : roundIndex === activeTournament.totalRounds - 1 ? "final" : "tour";
  const roundName = roundNames[roundIndex];
  startMatch({
    title: `${event.name} · ${roundName}`,
    rival: match.b,
    tournamentRound: { roundIndex, matchIndex },
    surface: event.surface,
    format,
    intro: `${event.tier} sobre ${event.surface}. ${surfaceInfo(event.surface).hint} Te enfrentas a ${match.b.name}${match.b.drawSeed ? ` (cabeza de serie ${match.b.drawSeed})` : ""} · raqueta ${match.b.brand || "Wilson"}. Gana para avanzar.`
  });
}

// Los premios se desplazan con las rondas previas: perder en 32avos o en la clasificatoria no da puntos.
function placementForRound(roundIndex, totalRounds, tournament = activeTournament) {
  if (!tournament) return 0;
  if (roundIndex < tournament.mainStartIndex) return PLACEMENT_NAMES.length - 1;
  if (tournament.format === "roundrobin" && roundIndex < tournament.mainStartIndex) return PLACEMENT_NAMES.length - 1;
  return tournament.mainRounds - (roundIndex - tournament.mainStartIndex);
}

// ----- Desenlace de cada partido del cuadro -----
function advanceTournament(won, tournamentRound, score) {
  const tournament = activeTournament;
  if (!tournament) return;
  const { roundIndex, matchIndex } = tournamentRound;
  const match = tournament.rounds[roundIndex][matchIndex];
  match.winner = won ? match.a : match.b;
  match.score = score;

  if (tournament.format === "roundrobin" && roundIndex < tournament.mainStartIndex) {
    advanceGroupPhase(won, score, roundIndex);
    return;
  }
  if (roundIndex < tournament.mainStartIndex) {
    if (!won) {
      simulateTournamentRoundsFrom(tournament.mainStartIndex + 1);
      showTournamentEliminationModal(placementForRound(roundIndex, tournament.totalRounds, tournament),
        "No superaste la clasificatoria. Sigue entrenando para la próxima edición.");
      return;
    }
    prepareNextTournamentRound(roundIndex, matchIndex);
    showTournamentVictoryModal(match.b.name, won);
    return;
  }
  if (won && roundIndex === tournament.totalRounds - 1) {
    tournament.champion = player.name;
    showChampionCelebration();
    return;
  }
  if (!won) {
    simulateTournamentRoundsFrom(roundIndex + 1);
    if (roundIndex === tournament.totalRounds - 1) tournament.champion = match.winner.name;
    showTournamentEliminationModal(placementForRound(roundIndex, tournament.totalRounds, tournament));
    return;
  }
  prepareNextTournamentRound(roundIndex, matchIndex);
  showTournamentVictoryModal(match.b.name, won);
}

function advanceGroupPhase(won, score, roundIndex) {
  const tournament = activeTournament;
  if (won) tournament.groupWins++; else tournament.groupLosses++;
  const groupRound = tournament.roundNames[roundIndex];
  if (tournament.groupIndex < 2) {
    tournament.groupIndex++;
    prepareNextTournamentRound(roundIndex, 0);
    showModal({
      icon: won ? "🎾" : "😬",
      title: won ? "Victoria en el grupo" : "Derrota en el grupo",
      message: `${groupRound}: ${won ? "sumas una victoria" : "se te escapa el partido"}. Balance en el grupo: ${tournament.groupWins}V-${tournament.groupLosses}D.`,
      stats: [{ label: "Marcador", value: score }, { label: "Balance", value: `${tournament.groupWins}V-${tournament.groupLosses}D` }],
      actions: [{ label: "Seguir en el grupo", primary: true, onClick: startTournamentMatch },
        { label: "Ver el cuadro", onClick: () => showCareerTab("calendar") }]
    });
    return;
  }
  if (tournament.groupWins >= 2) {
    buildSemis(tournament);
    tournament.roundIndex = tournament.mainStartIndex;
    tournament.matchIndex = 0;
    showModal({
      icon: "🎾",
      title: "¡Clasificado para las semifinales!",
      message: `Terminas el grupo con ${tournament.groupWins}V-${tournament.groupLosses}D y entras en el cuadro final de la Copa de Maestros.`,
      stats: [{ label: "Grupo", value: `${tournament.groupWins}V-${tournament.groupLosses}D` }, { label: "Siguiente", value: "Semifinal" }],
      actions: [{ label: "Jugar la semifinal", primary: true, onClick: startTournamentMatch },
        { label: "Ver el cuadro", onClick: () => showCareerTab("calendar") }]
    });
    return;
  }
  simulateTournamentRoundsFrom(tournament.mainStartIndex);
  showTournamentEliminationModal(PLACEMENT_NAMES.length - 1,
    "No clasificaste: el grupo se decide por victorias, y dos derrotas te dejan fuera.");
}

function showTournamentVictoryModal(rivalName, won = true) {
  const tournament = activeTournament;
  const nextRound = tournament.roundNames[tournament.roundIndex].toLowerCase();
  showModal({
    icon: won ? "🎾" : "💔",
    title: won ? "¡Victoria en el partido!" : "Derrota en el partido",
    message: won
      ? `Has vencido a ${rivalName} y entras en ${nextRound} de ${tournament.event.name}.`
      : `${rivalName} se impone. Tu torneo termina aquí.`,
    stats: [
      { label: "Ronda conquistada", value: tournament.roundNames[tournament.roundIndex - 1] || "Clasificatoria" },
      { label: "Siguiente ronda", value: tournament.roundNames[tournament.roundIndex] }
    ],
    actions: [
      { label: `Seguir a ${nextRound}`, primary: true, onClick: startTournamentMatch },
      { label: "Ver el cuadro", onClick: () => showCareerTab("calendar") }
    ]
  });
}

function olympicMedalFor(placement) {
  if (!activeTournament || !activeTournament.event.olympic) return "";
  return ["Oro", "Plata", "Bronce"][placement] || "";
}

function showTournamentEliminationModal(placement = PLACEMENT_NAMES.length - 1, customMessage = "") {
  const tournament = activeTournament;
  const points = tournament.event.awards[placement] || 0;
  const prize = tournament.event.prizes[placement] || 0;
  const medal = olympicMedalFor(placement);
  showModal({
    icon: medal === "Bronce" ? "🥉" : "🏁",
    title: medal === "Bronce" ? "¡Medalla de bronce!" : "Has perdido el partido",
    message: customMessage || `${tournament.champion || "Otro jugador"} se lleva ${tournament.event.name}. Tu torneo termina en ${PLACEMENT_NAMES[placement]}.`,
    stats: [
      { label: medal || "Puntos sumados", value: medal ? `¡${medal}!` : `+${points}` },
      { label: "Premio", value: `$${prize}` }
    ],
    actions: [
      { label: "Salir al menú", primary: true, onClick: () => finishTournament(placement, "career") },
      { label: "Ver el cuadro", onClick: () => finishTournament(placement, "calendar") }
    ]
  });
}

function showChampionCelebration() {
  const tournament = activeTournament;
  const event = tournament.event;
  const points = event.awards[0];
  const prize = event.prizes[0];
  const gold = Boolean(event.olympic);
  const cup = Boolean(event.mastersCup);
  showModal({
    icon: gold ? "🥇" : cup ? "🏆" : "🏆",
    title: gold ? "¡ORO OLÍMPICO!" : cup ? "¡CAMPEÓN DE LA COPA DE MAESTROS!" : "¡CAMPEÓN DEL TORNEO!",
    message: gold
      ? `¡${player.name} sube lo más alto del podio en ${olympicHost()} representando a ${player.country}! Tu país entero te celebra.`
      : cup
        ? `Has ganado la Copa de Maestros, el trofeo que se reserva para la élite. ${event.name} es tuyo.`
        : `¡No hay nadie mejor que tú en ${event.name}! Levantas el trofeo ante toda la pista.`,
    stats: [
      { label: gold ? "Medalla" : "Puntos", value: gold ? "🥇 Oro" : `+${points}` },
      { label: "Premio", value: `$${prize}` },
      { label: "Superficie", value: event.surface }
    ],
    celebration: true,
    actions: [
      { label: "Ver mi vitrina", primary: true, onClick: () => finishTournament(0, "ranking") },
      { label: "Seguir con la carrera", onClick: () => finishTournament(0, "calendar") }
    ]
  });
}

function finishTournament(placement, tabAfter = "calendar") {
  const tournament = activeTournament;
  if (!tournament) return;
  const { event, champion, rounds, roundNames } = tournament;
  const points = event.awards[placement] || 0;
  const prize = event.prizes[placement] || 0;
  player.rankingPoints += points;
  player.seasonPoints += points;
  player.money += prize;
  currentSeasonTournamentPoints[event.id] = points;

  if (placement <= 1) {
    player.finals.push({
      name: event.name, tier: event.tier, surface: event.surface,
      season: player.season, age: player.age, won: placement === 0, champion
    });
  }

  let medal = "";
  if (event.olympic && placement <= 2) {
    medal = ["Oro", "Plata", "Bronce"][placement];
    player.medals.push({ medal, season: player.season, age: player.age, country: player.country, host: olympicHost(), event: event.name });
  }

  tournamentResults[event.id] = {
    status: "completed",
    winner: champion,
    points,
    prize,
    placement,
    name: event.name,
    tier: event.tier,
    surface: event.surface,
    medal,
    bracket: rounds.map(round => round.map(match => ({
      a: { ...match.a }, b: { ...match.b }, winner: match.winner ? { ...match.winner } : null, score: match.score
    }))),
    roundNames,
    mainStartIndex: tournament.mainStartIndex,
    format: tournament.format
  };

  if (champion === player.name) {
    player.trophies.push({
      eventId: event.id,
      name: event.name,
      tier: event.tier,
      surface: event.surface,
      season: player.season,
      age: player.age,
      points,
      olympic: Boolean(event.olympic),
      mastersCup: Boolean(event.mastersCup)
    });
    applyEffects({
      fame: event.olympic ? 30 : event.tier === "Grand Slam" || event.mastersCup ? 25 : 12,
      skill: 2,
      ovr: 1
    });
    addLog(`🏆 ¡Campeón de ${event.name}! ${medal ? `¡${medal} olímpico! ` : ""}+${points} puntos de ranking y $${prize} de premio.`, "positive");
  } else {
    const reached = PLACEMENT_NAMES[placement] || "ronda preliminar";
    addLog(`🏁 ${champion} gana ${event.name}. Llegas hasta ${reached}${medal ? ` y consigues ${medal}` : ""}: +${points} puntos y $${prize}.`);
  }

  updateRank();
  selectedTournamentId = event.id;
  activeTournament = null;
  endTurn();
  if (!seasonSummaryPending) showCareerTab(tabAfter);
  saveGame();
}

// ----- Cuadros de torneos que el usuario no disputó -----
function buildSimulatedBracket(event) {
  const rivals = assignSeeds(makeRivals(event, 8));
  let current = [];
  for (let i = 0; i < rivals.length; i += 2) current.push(pendingMatch(rivals[i], rivals[i + 1]));
  const rounds = [current.map(match => simulateMatchInPlace(match, event))];
  for (let index = 1; index < 3; index++) {
    rounds.push(pairsFromWinners(rounds[index - 1], event).map(match => simulateMatchInPlace(match, event)));
  }
  return { rounds, winner: rounds[2][0].winner.name, roundNames: ROUND_NAMES.slice() };
}

function ensureSimulatedResult(event) {
  if (!event || tournamentResults[event.id]) return tournamentResults[event.id] || null;
  const { rounds, winner, roundNames } = buildSimulatedBracket(event);
  tournamentResults[event.id] = {
    status: "simulado",
    winner,
    points: 0,
    prize: 0,
    name: event.name,
    tier: event.tier,
    surface: event.surface,
    bracket: rounds.map(round => round.map(match => ({
      a: { ...match.a }, b: { ...match.b }, winner: match.winner ? { ...match.winner } : null, score: match.score
    }))),
    roundNames
  };
  saveGame();
  return tournamentResults[event.id];
}
