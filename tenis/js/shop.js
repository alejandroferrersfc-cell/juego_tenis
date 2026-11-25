// ===== Tienda: entrenadores y material deportivo =====
function shopItemById(id) {
  return SHOP_ITEMS.find(item => item.id === id) || null;
}

function ownsShopItem(id) {
  return player.inventory.includes(id);
}

function bestOwnedShopItem(predicate, field) {
  return SHOP_ITEMS
    .filter(item => predicate(item) && ownsShopItem(item.id))
    .reduce((best, item) => (!best || item[field] > best[field] ? item : best), null);
}

// Los entrenadores aceleran el progreso; se aplica el mejor contratado, no se acumulan.
function coachMultiplier() {
  const coach = bestOwnedShopItem(item => item.type === "coach", "value");
  return coach ? 1 + coach.value : 1;
}

// Ventaja total por material en una superficie, con tope de +5%.
function equipmentBonusForSurface(surface) {
  const shoes = bestOwnedShopItem(item => item.type === "surface" && item.surface === surface, "advantage");
  const racket = bestOwnedShopItem(item => item.type === "racket", "advantage");
  const bonus = (shoes ? shoes.advantage : 0) + (racket ? racket.advantage : 0);
  return clamp(bonus, 0, EQUIPMENT_CAP);
}

// Fisio y nutrición aceleran la recuperación entre turnos y reducen el riesgo de lesión.
function recoveryBonus() {
  const recovery = bestOwnedShopItem(item => item.type === "recovery", "value");
  return recovery ? recovery.value : 0;
}

function equipmentLabel(surface) {
  const shoes = bestOwnedShopItem(item => item.type === "surface" && item.surface === surface, "advantage");
  const racket = bestOwnedShopItem(item => item.type === "racket", "advantage");
  if (!shoes && !racket) return "Sin material específico";
  return [shoes && `${shoes.brand} ${shoes.name}`, racket && racket.brand].filter(Boolean).join(" · ");
}

function buyShopItem(id) {
  const item = shopItemById(id);
  if (!item || ownsShopItem(id)) return;
  if (player.money < item.price) {
    addLog(`No tienes dinero suficiente para ${item.name} ($${item.price}).`, "negative");
    renderShop();
    return;
  }
  player.money -= item.price;
  player.inventory.push(id);
  addLog(`🛒 Has comprado ${item.brand} ${item.name} por $${item.price}. ${item.effect}.`, "positive");
  saveGame();
  renderAll();
  showModal({
    icon: "🛒",
    title: "¡Compra realizada!",
    message: `${item.brand} ${item.name} ya está en tu equipo. ${item.effect}.`,
    stats: [{ label: "Pagado", value: `$${item.price}` }, { label: "Dinero restante", value: `$${player.money}` }],
    actions: [{ label: "Seguir en la tienda", primary: true, onClick: () => showCareerTab("shop") }]
  });
}

function renderShop() {
  const container = document.getElementById("shop-items");
  if (!container) return;
  container.replaceChildren();

  const summary = document.getElementById("shop-summary");
  if (summary) {
    summary.textContent = `Entrenamiento: ×${coachMultiplier().toFixed(2)} · Recuperación: +${Math.round(recoveryBonus() * 100)}% · ` +
      `Estilo ${player.style || "Polivalente"} · Ventaja por superficie: ` +
      SURFACES.map(surface => `${surface} ${Math.round(equipmentBonusForSurface(surface) * 100)}%`).join(" · ") +
      ` (máximo +${Math.round(EQUIPMENT_CAP * 100)}% por partido).`;
  }

  let lastCategory = "";
  SHOP_ITEMS.forEach(item => {
    if (item.category !== lastCategory) {
      lastCategory = item.category;
      const heading = document.createElement("h3");
      heading.className = "shop-category";
      heading.textContent = lastCategory;
      container.appendChild(heading);
    }
    const card = document.createElement("div");
    card.className = "shop-item";
    if (ownsShopItem(item.id)) card.classList.add("shop-owned");
    const info = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = `${item.brand} · ${item.name}`;
    const effect = document.createElement("span");
    effect.textContent = item.effect;
    info.append(title, effect);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "shop-buy";
    button.textContent = ownsShopItem(item.id) ? "✔ En tu equipo" : `$${item.price}`;
    button.disabled = ownsShopItem(item.id) || player.money < item.price;
    button.title = !ownsShopItem(item.id) && player.money < item.price ? `Te faltan $${item.price - player.money}` : "";
    button.addEventListener("click", () => buyShopItem(item.id));
    card.append(info, button);
    container.appendChild(card);
  });
}
