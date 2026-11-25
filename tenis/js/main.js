// ===== Arranque: enlaza los eventos de la interfaz =====
document.getElementById("start-btn").addEventListener("click", startGame);
document.getElementById("continue-btn").addEventListener("click", continueGame);
document.getElementById("restart-btn").addEventListener("click", () => location.reload());
document.getElementById("retire-btn").addEventListener("click", retireCareer);
document.getElementById("season-continue-btn").addEventListener("click", continueAfterSeasonSummary);
document.getElementById("player-name").addEventListener("keydown", event => {
  if (event.key === "Enter") startGame();
});
document.querySelectorAll(".career-tab").forEach(button => {
  button.addEventListener("click", () => showCareerTab(button.dataset.tab));
});
const countrySelect = document.getElementById("player-country");
COUNTRIES.forEach(country => {
  const option = document.createElement("option");
  option.value = country;
  option.textContent = country;
  countrySelect.appendChild(option);
});
countrySelect.value = "España";
if (hasSave()) document.getElementById("continue-btn").hidden = false;
