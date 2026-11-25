// ===== Interfaz: pintado de pantallas y ventanas emergentes =====
let modalOpen = false;

function addLog(text, type = "") {
  const log = document.getElementById("log");
  const entry = document.createElement("div");
  entry.className = `log-entry ${type}`;
  entry.textContent = `T${player.season}·M${player.turn}: ${text}`;
  log.prepend(entry);
}

function getScenario(id) {
  return SCENARIOS.find(scenario => scenario.id === id);
}

function monthlyIncome() {
  return 2 + player.sponsor + Math.floor(player.fame / 15);
}

function tierIcon(eventOrTier) {
  const tier = typeof eventOrTier === "string" ? eventOrTier : eventOrTier.tier;
  if (tier === "Juegos Olímpicos") return "🥇";
  if (tier === "Copa de Maestros") return "🏆";
  if (tier === "Grand Slam") return "🎾";
  if (tier.startsWith("ATP Masters")) return "💎";
  if (tier === "ATP 500") return "🥈";
  return "🎽";
}

function renderAll() {
  renderStats();
  renderScenario();
  renderRanking();
  renderCalendar();
  renderShop();
}

function renderStats() {
  document.getElementById("name-val").textContent = `${player.name} · ${player.country}`;
  document.getElementById("rank-val").textContent = player.rank;
  document.getElementById("career-progress").textContent =
    `Temporada ${player.season} · ${player.age} años · ${MONTHS[player.turn - 1]} (${player.turn}/${SEASON_LENGTH}) · ` +
    `${player.matchesWon}V-${player.matchesLost}D · ${player.rankingPoints} puntos · Ingresos: $${monthlyIncome()}/mes · ` +
    `Experiencia ${player.experience} · Carga ${player.workload}/6 · Estilo ${player.style}`;
  const injuryStatus = document.getElementById("injury-status");
  injuryStatus.hidden = player.injuryMonths <= 0;
  injuryStatus.textContent = player.injuryMonths > 0
    ? `🏥 Lesionado: ${player.injuryMonths} ${player.injuryMonths === 1 ? "mes" : "meses"} de baja`
    : "";

  document.getElementById("ovr-val").textContent = player.ovr;
  document.getElementById("energy-val").textContent = Math.round(player.energy);
  document.getElementById("skill-val").textContent = player.skill;
  document.getElementById("fame-val").textContent = player.fame;
  document.getElementById("money-val").textContent = player.money;

  document.getElementById("energy-bar").style.width = `${player.energy}%`;
  document.getElementById("ovr-bar").style.width = `${player.ovr}%`;
  document.getElementById("skill-bar").style.width = `${player.skill}%`;
  document.getElementById("fame-bar").style.width = `${player.fame}%`;
  document.getElementById("energy-bar").style.backgroundColor = player.energy < 30 ? "#ef4444" : "#10b981";
  document.getElementById("ovr-bar").style.backgroundColor = "#f59e0b";
  document.getElementById("skill-bar").style.backgroundColor = player.skill < 40 ? "#f59e0b" : "#10b981";
  document.getElementById("fame-bar").style.backgroundColor = player.fame < 30 ? "#64748b" : "#3b82f6";
}

function makeChoiceButton(titleText, detailText, onClick, disabled = false, tooltip = "") {
  const button = document.createElement("button");
  button.className = "choice-btn";
  const title = document.createElement("strong");
  title.textContent = titleText;
  const detail = document.createElement("small");
  detail.textContent = detailText;
  button.append(title, detail);
  button.disabled = disabled;
  if (tooltip) button.title = tooltip;
  button.addEventListener("click", onClick);
  return button;
}

function renderScenario() {
  const container = document.getElementById("choices-container");
  container.replaceChildren();

  if (player.phase === "tournament") {
    const events = eventsForTurn(player.turn);
    if (tournamentInProgress() && !activeMatch) {
      container.appendChild(makeChoiceButton(
        "▶️ Seguir con el torneo",
        `${activeTournament.event.name} · ${activeTournament.roundNames[activeTournament.roundIndex]}. Vuelve a la pista para jugar el siguiente partido.`,
        () => startTournamentMatch()
      ));
    }
    document.getElementById("scenario-title").textContent = "🏟️ Torneos del mes";
    document.getElementById("scenario-text").textContent =
      events.length > 1
        ? `Tienes ${events.length} torneos disponibles este mes. Solo puedes inscribirte en uno: con poco nivel juegas los ATP 250, al subir se abren los ATP 500 y después los Masters y Grand Slams.`
        : `Torneo del mes. Según tu ranking, entrarás al cuadro en una ronda u otra.`;
    events.forEach(event => {
      const result = tournamentResults[event.id];
      const eligibility = tournamentEligibility(event);
      const blocked = hasPlayedTournamentThisTurn();
      const detail = `${tierIcon(event)} ${MONTHS[event.month]} · ${event.tier} · ${event.surface} · ` +
        `Acceso: puesto ${entryPositionFor(event)} (${rankingPositionForPoints(player.rankingPoints)}) · Inscripción $${event.cost}` +
        (eligibility.qualifying ? " · Entrarás por la clasificatoria" : "") +
        (event.olympic ? ` · Convoca a ${player.country} · medallas, sin puntos ATP` : "");
      const tooltip = result ? result.reason || "Ya hay resultado para este torneo."
        : blocked ? "Ya te has inscrito en otro torneo este mes."
        : !eligibility.ok ? eligibility.reason : "";
      container.appendChild(makeChoiceButton(
        result ? `${event.name} (cerrado)` : event.name,
        detail,
        () => enterTournament(event.id),
        Boolean(result) || blocked || !eligibility.ok,
        tooltip
      ));
    });
    container.appendChild(makeChoiceButton(
      "⏭️ Saltarme todos los torneos del mes",
      "Ahorras la inscripción y la energía, pero no sumas puntos. Los puntos de la edición anterior caducan igualmente.",
      skipTournament
    ));
    return;
  }

  const scenario = getScenario(player.currentScenarioId);
  if (!scenario) return;
  document.getElementById("scenario-title").textContent = scenario.title;
  document.getElementById("scenario-text").textContent = scenario.text;
  scenario.choices.forEach((choice, index) => {
    const cost = Math.max(0, -(choice.effects.money || 0));
    const canAfford = player.money >= cost;
    const blockedByInjury = player.injuryMonths > 0 && choice.effects.match;
    const tooltip = !canAfford ? `Necesitas $${cost} para elegir esta opción.`
      : blockedByInjury ? `Podrás competir cuando termine la rehabilitación: ${player.injuryMonths} meses.` : "";
    container.appendChild(makeChoiceButton(
      canAfford ? choice.text : `${choice.text} (Necesitas $${cost})`,
      choice.detail, () => handleChoice(index), !canAfford || blockedByInjury, tooltip
    ));
  });
}

// ----- Pestañas -----
function showCareerTab(tab) {
  if (!["career", "ranking", "calendar", "shop"].includes(tab) || modalOpen) return;
  ["career", "ranking", "calendar", "shop"].forEach(name => {
    const selected = name === tab;
    document.getElementById(`${name}-panel`).hidden = !selected;
    document.getElementById(`${name}-tab`).setAttribute("aria-selected", String(selected));
  });
  if (tab === "career") renderScenario();
  if (tab === "calendar") renderCalendar();
  if (tab === "shop") renderShop();
  if (tab === "ranking") renderRanking();
}

// ----- Ventana emergente -----
function showModal({ icon = "🎾", title = "", message = "", stats = [], actions = [], celebration = false }) {
  const overlay = document.getElementById("modal-overlay");
  document.getElementById("modal-icon").textContent = icon;
  document.getElementById("modal-title").textContent = title;
  document.getElementById("modal-message").textContent = message;

  const statsBox = document.getElementById("modal-stats");
  statsBox.replaceChildren();
  stats.forEach(stat => {
    const cell = document.createElement("div");
    cell.className = "modal-stat";
    const label = document.createElement("span");
    label.textContent = stat.label;
    const value = document.createElement("strong");
    value.textContent = stat.value;
    cell.append(label, value);
    statsBox.appendChild(cell);
  });

  const actionsBox = document.getElementById("modal-actions");
  actionsBox.replaceChildren();
  actions.forEach(action => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `modal-btn${action.primary ? " primary" : ""}`;
    button.textContent = action.label;
    button.addEventListener("click", () => {
      closeModal();
      action.onClick();
    });
    actionsBox.appendChild(button);
  });

  overlay.hidden = false;
  modalOpen = true;
  if (celebration) startConfetti(); else stopConfetti();
  const firstButton = actionsBox.querySelector("button");
  if (firstButton) firstButton.focus();
}

function closeModal() {
  document.getElementById("modal-overlay").hidden = true;
  modalOpen = false;
  stopConfetti();
}

function startConfetti() {
  const layer = document.getElementById("confetti-layer");
  if (!layer) return;
  layer.replaceChildren();
  layer.hidden = false;
  const colors = ["#f59e0b", "#10b981", "#3b82f6", "#ef4444", "#e879f9", "#fde047"];
  for (let i = 0; i < 70; i++) {
    const piece = document.createElement("i");
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.background = colors[i % colors.length];
    piece.style.animationDelay = `${Math.random() * 0.8}s`;
    piece.style.animationDuration = `${1.8 + Math.random() * 1.6}s`;
    layer.appendChild(piece);
  }
}

function stopConfetti() {
  const layer = document.getElementById("confetti-layer");
  if (!layer) return;
  layer.hidden = true;
  layer.replaceChildren();
}

// ----- Ranking y vitrina -----
function renderRanking() {
  const rankIndex = currentRankIndex();
  const nextRank = RANKS[rankIndex + 1];
  document.getElementById("ranking-current").textContent = player.rank;
  document.getElementById("ranking-position").textContent = `Puesto simulado: ${rankingPositionForPoints(player.rankingPoints)}`;
  document.getElementById("ranking-points").textContent = `${player.rankingPoints} puntos acumulados`;
  const bar = document.getElementById("ranking-progress-bar");
  const track = bar.parentElement;
  if (nextRank) {
    const current = RANKS[rankIndex];
    const progress = clamp(((player.rankingPoints - current.minPoints) / (nextRank.minPoints - current.minPoints)) * 100, 0, 100);
    document.getElementById("ranking-next").textContent =
      `Siguiente categoría: ${nextRank.name} · ${nextRank.minPoints - player.rankingPoints} puntos para alcanzarla`;
    bar.style.width = `${progress}%`;
    track.setAttribute("aria-valuenow", Math.round(progress));
  } else {
    document.getElementById("ranking-next").textContent = "Has alcanzado la categoría más alta.";
    bar.style.width = "100%";
    track.setAttribute("aria-valuenow", "100");
  }

  const body = document.getElementById("ranking-history");
  body.replaceChildren();
  const currentSeason = {
    season: player.season, age: player.age, rank: player.rank,
    points: player.seasonPoints - player.seasonPointsExpired,
    wins: player.seasonMatchesWon, losses: player.seasonMatchesLost,
    position: rankingPositionForPoints(player.rankingPoints), current: true
  };
  const seasons = seasonSummaryPending
    ? rankingHistory.slice().reverse()
    : [currentSeason, ...rankingHistory.slice().reverse()];
  seasons.forEach(season => {
    const row = document.createElement("tr");
    if (season.current) row.className = "current-season";
    [
      season.current ? `T${season.season} · En curso` : `T${season.season}${season.missed ? " · Baja médica" : ""}`,
      `${season.age} años`, season.rank, season.points, season.position,
      season.missed ? "—" : `${season.wins}V - ${season.losses}D`
    ].forEach(value => {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.appendChild(cell);
    });
    body.appendChild(row);
  });
  renderTrophyCabinet();
}

function renderTrophyCabinet() {
  const box = document.getElementById("trophy-cabinet");
  if (!box) return;
  box.replaceChildren();
  const summary = document.getElementById("trophy-summary");
  const trophies = player.trophies || [];
  if (summary) {
    const counts = {
      total: trophies.length,
      gs: trophies.filter(trophy => trophy.tier === "Grand Slam").length,
      masters: trophies.filter(trophy => trophy.tier.startsWith("ATP Masters")).length,
      atp: trophies.filter(trophy => trophy.tier === "ATP 500" || trophy.tier === "ATP 250").length,
      olympic: trophies.filter(trophy => trophy.olympic).length,
      cup: trophies.filter(trophy => trophy.mastersCup).length
    };
    summary.textContent = `${counts.total} títulos · ${counts.gs} Grand Slams · ${counts.masters} Masters 1000 · ` +
      `${counts.atp} ATP · ${counts.olympic} oros olímpicos · ${counts.cup} Copas de Maestros`;
  }
  if (!trophies.length) {
    const empty = document.createElement("p");
    empty.className = "trophy-empty";
    empty.textContent = "Todavía no has ganado ningún torneo. Tu primer trofeo aparecerá aquí.";
    box.appendChild(empty);
  }
  trophies.slice().reverse().forEach(trophy => {
    const card = document.createElement("div");
    card.className = `trophy-card${trophy.olympic ? " olympic" : ""}${trophy.mastersCup ? " masters-cup" : ""}`;
    const icon = document.createElement("span");
    icon.className = "trophy-icon";
    icon.textContent = trophy.olympic ? "🥇" : trophy.mastersCup ? "🏆" : tierIcon(trophy.tier);
    const info = document.createElement("div");
    const name = document.createElement("strong");
    name.textContent = trophy.name;
    const detail = document.createElement("small");
    detail.textContent = `T${trophy.season} · ${trophy.age} años · ${trophy.tier} · ${trophy.surface} · +${trophy.points} pts`;
    info.append(name, detail);
    card.append(icon, info);
    box.appendChild(card);
  });

  const medalBox = document.getElementById("medal-cabinet");
  if (medalBox) {
    const medals = player.medals || [];
    medalBox.textContent = medals.length
      ? medals.slice().reverse().map(medal =>
          `${medal.medal === "Oro" ? "🥇" : medal.medal === "Plata" ? "🥈" : "🥉"} ` +
          `${medal.medal} · ${medal.host || olympicHost()} · T${medal.season} · ${medal.country}`
        ).join(" · ")
      : "Sin medallas todavía: los Juegos se celebran cada cuatro años y no reparten puntos ATP.";
  }

  const surfaceBox = document.getElementById("trophy-surfaces");
  if (surfaceBox) {
    const counts = Object.fromEntries(SURFACES.map(surface => [surface, 0]));
    trophies.forEach(trophy => { if (trophy.surface in counts) counts[trophy.surface]++; });
    const titleCounts = {
      gs: trophies.filter(trophy => trophy.tier === "Grand Slam").length,
      masters: trophies.filter(trophy => trophy.tier.startsWith("ATP Masters")).length
    };
    const finals = player.finals || [];
    surfaceBox.textContent =
      SURFACES.map(surface => `${surface}: ${counts[surface]}`).join(" · ") +
      ` · ${titleCounts.gs} Grand Slams · ${titleCounts.masters} Masters 1000 · ` +
      `Finales: ${finals.length} (${finals.filter(final => final.won).length} ganadas)` +
      (finals.length ? ` · ${finals.slice(-3).reverse().map(final => `${final.name} T${final.season}`).join(", ")}` : "");
  }

  const headBox = document.getElementById("head-to-head");
  if (headBox) {
    const records = Object.entries(player.headToHead || {})
      .sort((a, b) => (b[1].wins + b[1].losses) - (a[1].wins + a[1].losses))
      .slice(0, 8);
    headBox.textContent = records.length
      ? records.map(([name, record]) => `${name}: ${record.wins}V-${record.losses}D`).join(" · ")
      : "Aún no hay enfrentamientos registrados.";
  }
}

// ----- Calendario -----
function renderCalendar() {
  const events = eventsForSeason();
  document.getElementById("calendar-intro").textContent =
    `Hay ${events.length} torneos en la temporada (incluidos los Juegos Olímpicos cada cuatro años y la Copa de Maestros en diciembre). ` +
    `Cada mes juegas primero tu escenario y puedes elegir entre los torneos de ese mes según tu nivel: empiezas con los ATP 250, ` +
    `desbloqueas los ATP 500 y más adelante Masters y Grand Slams. Los cuadros se pueden consultar aunque no hayas jugado.`;
  const container = document.getElementById("calendar-events");
  container.replaceChildren();
  events.forEach(event => {
    const result = tournamentResults[event.id];
    const isCurrent = event.month === player.turn - 1;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "calendar-event";
    button.dataset.eventId = event.id;
    if (isCurrent && !result && !seasonSummaryPending) button.classList.add("calendar-current");
    button.setAttribute("aria-pressed", String(selectedTournamentId === event.id));
    const name = document.createElement("strong");
    name.textContent = `${MONTHS[event.month]} · ${tierIcon(event)} ${event.name}`;
    const info = document.createElement("span");
    let status = "Próximamente";
    if (result?.status === "completed") status = `Disputado · campeón: ${result.winner} · ${result.points} pts · $${result.prize}`;
    else if (result?.status === "in-progress") status = "En curso";
    else if (result?.status === "simulado") status = `Celebrado · campeón: ${result.winner} (no jugaste)`;
    else if (result?.status === "lesion") status = "No disputado por lesión";
    else if (result?.status === "ineligible") status = "No cumplías los requisitos";
    else if (result?.status === "passed") status = result.reason || "Plaza pasada";
    else if (event.month < player.turn - 1) status = "Fecha pasada";
    else if (isCurrent) status = "Este mes";
    info.textContent = `${event.tier} · ${status}`;
    button.append(name, info);
    button.addEventListener("click", () => renderTournamentDetails(event.id));
    container.appendChild(button);
  });
  renderTournamentDetails(selectedTournamentId, false);
}

function renderTournamentDetails(eventId, updateSelection = true) {
  const event = findEventById(eventId) || TOURNAMENTS.find(item => item.id === eventId);
  if (!event) return;
  if (updateSelection) selectedTournamentId = event.id;
  document.querySelectorAll(".calendar-event").forEach(button => {
    button.setAttribute("aria-pressed", String(button.dataset.eventId === event.id));
  });
  const detail = document.getElementById("tournament-detail");
  detail.replaceChildren();
  const add = (tag, text, className = "") => {
    const element = document.createElement(tag);
    element.textContent = text;
    if (className) element.className = className;
    detail.appendChild(element);
    return element;
  };
  const entryRound = tournamentEntryRound(event);
  const drawSize = Math.pow(2, 3 - entryRound);
  const entryText = entryRound === 0 ? "cuartos de final"
    : entryRound === -1 ? "dieciseisavos de final" : "treintaydosavos de final";
  add("h3", `${tierIcon(event)} ${event.name}`);
  add("strong", event.tier);
  add("p", `${MONTHS[event.month]} · ${event.surface} · Cuadro de ${drawSize} jugadores · Nivel medio del cuadro: OVR ${event.field}`, "tournament-meta");
  add("p", `Con tu ranking actual entrarías en ${entryText}. Nunca se entra en semifinal ni en final.`, "tournament-meta");
  add("p", `Puntos: campeón ${event.awards[0]}, finalista ${event.awards[1]}, semifinalista ${event.awards[2]}, cuartofinalista ${event.awards[3]}.`);
  add("p", `Premios: $${event.prizes[0]} / $${event.prizes[1]} / $${event.prizes[2]} / $${event.prizes[3]}. Inscripción: $${event.cost}.`);
  add("p", `Requisito de entrada: ${event.minPoints.toLocaleString("es-ES")} puntos. Tu puntuación: ${player.rankingPoints.toLocaleString("es-ES")}.`);
  if (event.olympic) add("p", `Convocatoria de ${player.country}: ${olympicSummoned() ? "tienes plaza" : "necesitas 450 puntos o 70 de fama"}.`);

  const result = tournamentResults[event.id];
  if (result) {
    add("p", {
      completed: `Campeón: ${result.winner}. ${result.points} puntos y $${result.prize} sumados.`,
      "in-progress": "Estás compitiendo en este torneo. El cuadro se actualiza al terminar cada ronda.",
      simulado: `Campeón: ${result.winner}. No te inscribiste, pero puedes consultar el cuadro.`,
      lesion: "La lesión te impidió competir; los puntos de la edición anterior caducan igualmente.",
      ineligible: "No cumplías los requisitos de entrada este mes.",
      passed: result.reason || "Decidiste no inscribirte en esta edición."
    }[result.status] || "");
  }

  const isCurrent = event.month === player.turn - 1;
  const eligibility = tournamentEligibility(event);
  const isActiveEvent = Boolean(activeTournament && activeTournament.event.id === event.id && tournamentInProgress());
  const canEnterNow = isCurrent && player.phase === "tournament" && !result && !seasonSummaryPending &&
    !tournamentInProgress() && !hasPlayedTournamentThisTurn();
  const button = document.createElement("button");
  button.type = "button";
  button.className = "btn";
  if (isActiveEvent) {
    button.textContent = activeMatch ? "Volver al partido" : "Seguir al próximo partido";
    button.addEventListener("click", () => activeMatch ? showCareerTab("career") : startTournamentMatch());
  } else {
    button.textContent = result?.status === "in-progress" ? "Torneo en curso"
      : result ? "Torneo cerrado"
      : canEnterNow ? "Inscribirme en este torneo"
      : isCurrent ? "Termina primero el escenario del mes"
      : event.month < player.turn - 1 ? "Fecha pasada" : `Disponible en ${MONTHS[event.month]}`;
    button.disabled = !canEnterNow || !eligibility.ok;
    button.title = canEnterNow && !eligibility.ok ? eligibility.reason : "";
    button.addEventListener("click", () => enterTournament(event.id));
  }
  detail.appendChild(button);
  renderTournamentBracket(event.id);
}

function renderTournamentBracket(eventId) {
  const section = document.getElementById("tournament-bracket");
  let bracketData = null;
  let roundNames = ROUND_NAMES;
  let champion = "";
  let live = false;
  let title = "Cuadro del torneo";

  if (activeTournament && activeTournament.event.id === eventId) {
    bracketData = activeTournament.rounds;
    roundNames = activeTournament.roundNames;
    champion = activeTournament.champion;
    live = true;
    title = `Cuadro · ${activeTournament.event.name}`;
  } else {
    const event = findEventById(eventId) || TOURNAMENTS.find(item => item.id === eventId);
    const result = tournamentResults[eventId];
    if (result?.bracket) {
      bracketData = result.bracket;
      roundNames = result.roundNames || ROUND_NAMES;
      champion = result.winner;
      title = `Cuadro · ${result.name || (event ? event.name : eventId)}`;
    } else if (event && event.month < player.turn - 1) {
      const simulated = ensureSimulatedResult(event);
      if (simulated?.bracket) {
        bracketData = simulated.bracket;
        roundNames = simulated.roundNames || ROUND_NAMES;
        champion = simulated.winner;
        title = `Cuadro · ${event.name}`;
      }
    }
  }

  if (!bracketData) {
    section.hidden = true;
    return;
  }
  section.hidden = false;
  document.getElementById("bracket-title").textContent = title;
  const container = document.getElementById("bracket-rounds");
  container.replaceChildren();
  bracketData.forEach((matches, roundIndex) => {
    const round = document.createElement("div");
    round.className = "bracket-round";
    const heading = document.createElement("h4");
    heading.textContent = roundNames[roundIndex] || `Ronda ${roundIndex + 1}`;
    round.appendChild(heading);
    matches.forEach((match, matchIndex) => {
      const card = document.createElement("div");
      card.className = "bracket-match";
      [match.a, match.b].forEach(participant => {
        const line = document.createElement("span");
        line.textContent = `${participant.name} (OVR ${participant.ovr})${participant.you ? " · tú" : ""}`;
        if (participant.you) line.classList.add("you-player");
        if (match.winner && match.winner.name === participant.name) line.className = "winner";
        card.appendChild(line);
      });
      const score = document.createElement("span");
      const isLive = live && activeTournament.roundIndex === roundIndex && activeTournament.matchIndex === matchIndex;
      score.textContent = match.score || (isLive ? "En juego" : "Pendiente");
      card.appendChild(score);
      round.appendChild(card);
    });
    container.appendChild(round);
  });
  const status = document.getElementById("bracket-status");
  if (champion) {
    status.textContent = `Campeón: ${champion}.`;
  } else if (live && bracketData[activeTournament.roundIndex]) {
    const match = bracketData[activeTournament.roundIndex][activeTournament.matchIndex];
    status.textContent = `Tu rival en ${roundNames[activeTournament.roundIndex].toLowerCase()}: ${match.b.name} · raqueta ${match.b.brand || "Wilson"}.`;
  } else {
    status.textContent = "Cuadro pendiente de disputar.";
  }
}
