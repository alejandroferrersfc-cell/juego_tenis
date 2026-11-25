// ===== Utilidades generales =====
function clamp(val, min, max) { return Math.max(min, Math.min(max, val)); }
function randInt(min, max) { return min + Math.floor(Math.random() * (max - min + 1)); }
function randomItem(list) { return list[Math.floor(Math.random() * list.length)]; }
function shuffle(list) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}
