// ===== Datos y configuración del juego (sin lógica) =====
const SEASON_LENGTH = 12;          // un turno = un mes
const MAX_AGE = 38;                // edad máxima: a partir de aquí te retiras
const SAVE_KEY = "carrera-tenis-save-v1";
const MONTHS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const SURFACES = ["Dura", "Tierra batida", "Hierba", "Dura cubierta"];
const EQUIPMENT_CAP = 0.05;        // ventaja máxima total del material en un partido

// Cada superficie premia patrones distintos: swing modifica la eficacia del golpe,
// stamina encarece el desgaste y fault añade riesgo al saque.
const SURFACE_STYLES = {
  "Dura":          { swing: { attack: 0.02, control: 0.01, net: 0.01 }, stamina: 1,    fault: 0,     hint: "Bote regular: superficie neutra." },
  "Tierra batida": { swing: { attack: -0.04, control: 0.05, net: -0.05 }, stamina: 1.15, fault: -0.02, hint: "Bote alto y lento: premia el control y la paciencia." },
  "Hierba":        { swing: { attack: 0.05, control: -0.03, net: 0.06 }, stamina: 0.9,  fault: 0.03,  hint: "Bote bajo y rápido: premia atacar y subir a la red." },
  "Dura cubierta": { swing: { attack: 0.04, control: 0, net: 0.03 }, stamina: 0.95, fault: 0.01,  hint: "Pista rápida bajo techo: el saque manda." }
};

// Situaciones de golpe: cada punto llega con una bola distinta y premia patrones distintos.
// swing modifica la eficacia de cada opción; manual indica que se elige por marcador, no por superficie.
const SHOT_SITUATIONS = [
  { id: "high-bounce", icon: "🎾", title: "Bote alto", detail: "La bola se levanta y el punto se alarga: aguanta y construye desde el fondo.", swing: { attack: -0.03, control: 0.04, net: -0.02 }, surfaces: ["Tierra batida"] },
  { id: "low-bounce", icon: "⚡", title: "Bote bajo", detail: "La bola se queda baja y corre: castiga o sube a la red.", swing: { attack: 0.03, control: -0.02, net: 0.04 }, surfaces: ["Hierba", "Dura cubierta"] },
  { id: "short-ball", icon: "🎯", title: "Bola corta", detail: "El rival se la queda corta: es tu oportunidad de atacar o cerrar en la red.", swing: { attack: 0.05, control: 0, net: 0.04 } },
  { id: "long-rally", icon: "🔁", title: "Intercambio largo", detail: "El punto se alarga: gana quien mantenga el control y no se precipite.", swing: { attack: -0.02, control: 0.04, net: -0.03 }, surfaces: ["Tierra batida", "Dura"] },
  { id: "loop-ball", icon: "💥", title: "Pelota colgada", detail: "Te sale una bola alta: puedes buscar el ganador.", swing: { attack: 0.05, control: -0.01, net: 0.02 } },
  { id: "pressure", icon: "😬", title: "Bajo presión", detail: "Punto importante en contra: juega seguro y espera tu oportunidad.", swing: { attack: -0.03, control: 0.04, net: -0.01 }, manual: true },
  { id: "second-serve", icon: "🎯", title: "Segundo saque", detail: "Solo tienes una oportunidad: prioriza entrar y luego cambia el ritmo.", swing: { attack: -0.02, control: 0.03, net: 0 }, manual: true }
];

const COUNTRIES = ["España", "Argentina", "México", "Chile", "Colombia", "Brasil", "Serbia", "Italia", "Francia", "Alemania", "Reino Unido", "Estados Unidos", "Japón", "Corea del Sur", "Australia", "Canadá", "Suiza", "Suecia", "Noruega", "Grecia", "China", "India"];
const OLYMPIC_HOSTS = ["París 2024", "Los Ángeles 2028", "Brisbane 2032", "Sídney 2036", "Nueva Delhi 2040"];
const TENNIS_BRANDS = ["Wilson", "Babolat", "Head", "Yonex", "Dunlop", "Prince", "Lacoste", "Lotto", "Nike", "Adidas", "Asics", "New Balance"];

// rivalOvr: nivel típico de los rivales que te salen a ese ranking (partidos fuera de torneo)
const RANKS = [
  { name: "Jugador Amateur",    minPoints: 0,    position: 2000, rivalOvr: 50 },
  { name: "Categoría Nacional", minPoints: 150,  position: 1000, rivalOvr: 57 },
  { name: "Top 500 ATP",        minPoints: 450,  position: 500,  rivalOvr: 65 },
  { name: "Top 100 ATP",        minPoints: 1000, position: 100,  rivalOvr: 74 },
  { name: "Top 10 Mundial",     minPoints: 3500, position: 10,   rivalOvr: 84 },
  { name: "Leyenda del Tenis",  minPoints: 8000, position: 1,    rivalOvr: 90 }
];

// awards = puntos [campeón, finalista, semifinalista, cuartofinalista]
// prizes = dinero en el mismo orden · cost = inscripción y viaje · field = OVR medio del cuadro
// Varios torneos por mes: desde el inicio puedes jugar los ATP 250 (sin requisito de puntos),
// luego se desbloquean los ATP 500 (450 pts) y, por último, Masters/Grand Slams (1000 pts).
const TOURNAMENTS = [
  { id: "australian-open",      name: "Australian Open",                  tier: "Grand Slam",       month: 0,  surface: "Dura",          minPoints: 1000, awards: [2000, 1200, 720, 360], prizes: [320, 190, 110, 65], cost: 45, field: 86, pool: "elite" },
  { id: "brisbane-international", name: "Brisbane International",         tier: "ATP 250",          month: 0,  surface: "Dura",          minPoints: 0,    awards: [250, 150, 90, 45],     prizes: [75, 45, 25, 14],    cost: 15, field: 64, pool: "pro" },
  { id: "open-sud-de-france",   name: "Open Sud de France",               tier: "ATP 250",          month: 1,  surface: "Dura cubierta", minPoints: 0,    awards: [250, 150, 90, 45],     prizes: [75, 45, 25, 14],    cost: 15, field: 62, pool: "pro" },
  { id: "rotterdam-open",       name: "ABN AMRO Open Rotterdam",          tier: "ATP 500",          month: 1,  surface: "Dura cubierta", minPoints: 450,  awards: [500, 300, 180, 90],     prizes: [130, 75, 45, 25],    cost: 25, field: 72, pool: "pro" },
  { id: "indian-wells",         name: "Indian Wells",                     tier: "ATP Masters 1000", month: 2,  surface: "Dura",          minPoints: 1000, awards: [1000, 600, 360, 180],   prizes: [220, 130, 75, 45],   cost: 35, field: 80, pool: "elite" },
  { id: "acapulco-open",        name: "Abierto Mexicano Telcel",          tier: "ATP 250",          month: 2,  surface: "Dura",          minPoints: 0,    awards: [250, 150, 90, 45],     prizes: [75, 45, 25, 14],    cost: 15, field: 63, pool: "pro" },
  { id: "barcelona-open",       name: "Barcelona Open Banc Sabadell",     tier: "ATP 500",          month: 3,  surface: "Tierra batida", minPoints: 450,  awards: [500, 300, 180, 90],     prizes: [130, 75, 45, 25],    cost: 25, field: 72, pool: "pro" },
  { id: "marrakech-open",       name: "Grand Prix Hassan II",             tier: "ATP 250",          month: 3,  surface: "Tierra batida", minPoints: 0,    awards: [250, 150, 90, 45],     prizes: [75, 45, 25, 14],    cost: 15, field: 62, pool: "pro" },
  { id: "roland-garros",        name: "Roland Garros",                    tier: "Grand Slam",       month: 4,  surface: "Tierra batida", minPoints: 1000, awards: [2000, 1200, 720, 360], prizes: [320, 190, 110, 65], cost: 45, field: 86, pool: "elite" },
  { id: "hamburg-open",         name: "Hamburg European Open",            tier: "ATP 500",          month: 4,  surface: "Tierra batida", minPoints: 450,  awards: [500, 300, 180, 90],     prizes: [130, 75, 45, 25],    cost: 25, field: 72, pool: "pro" },
  { id: "lyon-open",            name: "Lyon Open",                        tier: "ATP 250",          month: 4,  surface: "Tierra batida", minPoints: 0,    awards: [250, 150, 90, 45],     prizes: [75, 45, 25, 14],    cost: 15, field: 61, pool: "pro" },
  { id: "queens-club",          name: "Queen's Club Championships",       tier: "ATP 500",          month: 5,  surface: "Hierba",        minPoints: 450,  awards: [500, 300, 180, 90],     prizes: [130, 75, 45, 25],    cost: 25, field: 73, pool: "pro" },
  { id: "halle-open",           name: "Halle Open",                       tier: "ATP 250",          month: 5,  surface: "Hierba",        minPoints: 0,    awards: [250, 150, 90, 45],     prizes: [75, 45, 25, 14],    cost: 15, field: 63, pool: "pro" },
  { id: "wimbledon",            name: "Wimbledon",                        tier: "Grand Slam",       month: 6,  surface: "Hierba",        minPoints: 1000, awards: [2000, 1200, 720, 360], prizes: [320, 190, 110, 65], cost: 45, field: 86, pool: "elite" },
  { id: "bastad-open",          name: "Nordea Open Båstad",               tier: "ATP 250",          month: 6,  surface: "Tierra batida", minPoints: 0,    awards: [250, 150, 90, 45],     prizes: [75, 45, 25, 14],    cost: 15, field: 62, pool: "pro" },
  { id: "canadian-open",        name: "National Bank Open",               tier: "ATP Masters 1000", month: 7,  surface: "Dura",          minPoints: 1000, awards: [1000, 600, 360, 180],   prizes: [220, 130, 75, 45],   cost: 35, field: 80, pool: "elite" },
  { id: "washington-open",      name: "Mubadala Citi DC Open",            tier: "ATP 500",          month: 7,  surface: "Dura",          minPoints: 450,  awards: [500, 300, 180, 90],     prizes: [130, 75, 45, 25],    cost: 25, field: 71, pool: "pro" },
  { id: "us-open",              name: "US Open",                          tier: "Grand Slam",       month: 8,  surface: "Dura",          minPoints: 1000, awards: [2000, 1200, 720, 360], prizes: [320, 190, 110, 65], cost: 45, field: 86, pool: "elite" },
  { id: "winston-salem-open",   name: "Winston-Salem Open",               tier: "ATP 250",          month: 8,  surface: "Dura",          minPoints: 0,    awards: [250, 150, 90, 45],     prizes: [75, 45, 25, 14],    cost: 15, field: 62, pool: "pro" },
  { id: "japan-open",           name: "Japan Open Tennis Championships",  tier: "ATP 500",          month: 9,  surface: "Dura",          minPoints: 450,  awards: [500, 300, 180, 90],     prizes: [130, 75, 45, 25],    cost: 25, field: 72, pool: "pro" },
  { id: "chengdu-open",         name: "Chengdu Open",                     tier: "ATP 250",          month: 9,  surface: "Dura",          minPoints: 0,    awards: [250, 150, 90, 45],     prizes: [75, 45, 25, 14],    cost: 15, field: 61, pool: "pro" },
  { id: "paris-masters",        name: "Rolex Paris Masters",              tier: "ATP Masters 1000", month: 10, surface: "Dura cubierta", minPoints: 1000, awards: [1000, 600, 360, 180],   prizes: [220, 130, 75, 45],   cost: 35, field: 80, pool: "elite" },
  { id: "basel-open",           name: "Swiss Indoors Basel",              tier: "ATP 500",          month: 10, surface: "Dura cubierta", minPoints: 450,  awards: [500, 300, 180, 90],     prizes: [130, 75, 45, 25],    cost: 25, field: 72, pool: "pro" },
  { id: "miami-open",           name: "Miami Open",                       tier: "ATP Masters 1000", month: 2,  surface: "Dura",          minPoints: 1000, awards: [1000, 600, 360, 180],   prizes: [220, 130, 75, 45],   cost: 35, field: 81, pool: "elite" },
  { id: "monte-carlo",          name: "Rolex Monte-Carlo Masters",       tier: "ATP Masters 1000", month: 3,  surface: "Tierra batida", minPoints: 1000, awards: [1000, 600, 360, 180],   prizes: [220, 130, 75, 45],   cost: 35, field: 81, pool: "elite" },
  { id: "madrid-open",          name: "Mutua Madrid Open",               tier: "ATP Masters 1000", month: 4,  surface: "Tierra batida", minPoints: 1000, awards: [1000, 600, 360, 180],   prizes: [220, 130, 75, 45],   cost: 35, field: 82, pool: "elite" },
  { id: "rome-open",            name: "Internazionali BNL d'Italia",     tier: "ATP Masters 1000", month: 4,  surface: "Tierra batida", minPoints: 1000, awards: [1000, 600, 360, 180],   prizes: [220, 130, 75, 45],   cost: 35, field: 81, pool: "elite" },
  { id: "cincinnati-open",      name: "Cincinnati Open",                 tier: "ATP Masters 1000", month: 7,  surface: "Dura",          minPoints: 1000, awards: [1000, 600, 360, 180],   prizes: [220, 130, 75, 45],   cost: 35, field: 81, pool: "elite" },
  { id: "beijing-open",         name: "China Open · Beijing",            tier: "ATP 500",          month: 9,  surface: "Dura",          minPoints: 450,  awards: [500, 300, 180, 90],     prizes: [130, 75, 45, 25],    cost: 25, field: 71, pool: "pro" },
  { id: "shanghai-masters",     name: "Shanghai Rolex Masters",          tier: "ATP Masters 1000", month: 10, surface: "Dura",          minPoints: 1000, awards: [1000, 600, 360, 180],   prizes: [220, 130, 75, 45],   cost: 35, field: 80, pool: "elite" },
  { id: "masters-cup",          name: "Copa de Maestros · ATP Finals",    tier: "Copa de Maestros", month: 11, surface: "Dura cubierta", minPoints: 3500, awards: [1500, 900, 500, 250],   prizes: [500, 300, 180, 100], cost: 40, field: 92, pool: "elite", mastersCup: true }
];

// ===== Tienda: entrenadores y material de marcas reales =====
// type "coach": acelera la subida de nivel · type "surface": ventaja en esa pista · type "racket": ventaja en todas
const SHOP_ITEMS = [
  { id: "coach-1", name: "Entrenador personal", brand: "Carlos Moya", category: "Entrenadores", type: "coach", price: 120, value: 0.25, effect: "+25% de progreso al entrenar" },
  { id: "coach-2", name: "Entrenador élite", brand: "Goran Ivanišević", category: "Entrenadores", type: "coach", price: 320, value: 0.50, effect: "+50% de progreso al entrenar" },
  { id: "racket-1", name: "Pure Drive · 100 in² · 300 g · 25 mm", brand: "Babolat", category: "Raquetas", type: "racket", style: "Agresivo", price: 160, advantage: 0.01, effect: "+1% de rendimiento · pensada para un juego agresivo" },
  { id: "racket-2", name: "Blade 98 · 98 in² · 305 g · 23 mm", brand: "Wilson", category: "Raquetas", type: "racket", style: "Control", price: 300, advantage: 0.02, effect: "+2% de rendimiento · pensada para un juego de control" },
  { id: "racket-3", name: "Speed Pro · 100 in² · 310 g · 23 mm", brand: "Head", category: "Raquetas", type: "racket", style: "Defensivo", price: 460, advantage: 0.03, effect: "+3% de rendimiento · pensada para un juego defensivo" },
  { id: "shoes-hard-1", name: "Zapatillas Dura Club", brand: "Nike", category: "Calzado · Dura", type: "surface", surface: "Dura", price: 45, advantage: 0.01, effect: "+1% en pistas duras" },
  { id: "shoes-hard-2", name: "Zapatillas Dura Pro", brand: "Adidas", category: "Calzado · Dura", type: "surface", surface: "Dura", price: 110, advantage: 0.03, effect: "+3% en pistas duras" },
  { id: "shoes-hard-3", name: "Zapatillas Dura Elite", brand: "Asics", category: "Calzado · Dura", type: "surface", surface: "Dura", price: 190, advantage: 0.05, effect: "+5% en pistas duras" },
  { id: "shoes-clay-1", name: "Zapatillas Tierra Club", brand: "Lotto", category: "Calzado · Tierra batida", type: "surface", surface: "Tierra batida", price: 45, advantage: 0.01, effect: "+1% en tierra batida" },
  { id: "shoes-clay-2", name: "Zapatillas Tierra Pro", brand: "New Balance", category: "Calzado · Tierra batida", type: "surface", surface: "Tierra batida", price: 110, advantage: 0.03, effect: "+3% en tierra batida" },
  { id: "shoes-clay-3", name: "Zapatillas Tierra Elite", brand: "Asics", category: "Calzado · Tierra batida", type: "surface", surface: "Tierra batida", price: 190, advantage: 0.05, effect: "+5% en tierra batida" },
  { id: "shoes-grass-1", name: "Zapatillas Hierba Club", brand: "Lacoste", category: "Calzado · Hierba", type: "surface", surface: "Hierba", price: 50, advantage: 0.01, effect: "+1% en hierba" },
  { id: "shoes-grass-2", name: "Zapatillas Hierba Pro", brand: "Nike", category: "Calzado · Hierba", type: "surface", surface: "Hierba", price: 115, advantage: 0.03, effect: "+3% en hierba" },
  { id: "shoes-grass-3", name: "Zapatillas Hierba Elite", brand: "Adidas", category: "Calzado · Hierba", type: "surface", surface: "Hierba", price: 200, advantage: 0.05, effect: "+5% en hierba" },
  { id: "shoes-indoor-1", name: "Zapatillas Cubierta Club", brand: "Puma", category: "Calzado · Dura cubierta", type: "surface", surface: "Dura cubierta", price: 50, advantage: 0.01, effect: "+1% en pista cubierta" },
  { id: "shoes-indoor-2", name: "Zapatillas Cubierta Pro", brand: "Yonex", category: "Calzado · Dura cubierta", type: "surface", surface: "Dura cubierta", price: 115, advantage: 0.03, effect: "+3% en pista cubierta" },
  { id: "shoes-indoor-3", name: "Zapatillas Cubierta Elite", brand: "Wilson", category: "Calzado · Dura cubierta", type: "surface", surface: "Dura cubierta", price: 200, advantage: 0.05, effect: "+5% en pista cubierta" },
  { id: "physio-1", name: "Fisioterapeuta de gira", brand: "Clínica Sport", category: "Recuperación", type: "recovery", price: 150, value: 0.15, effect: "+15% de recuperación y menos riesgo de lesión" },
  { id: "nutrition-1", name: "Plan nutricional", brand: "NutriTennis", category: "Recuperación", type: "recovery", price: 240, value: 0.25, effect: "+25% de recuperación y menos riesgo de lesión" }
];

// ===== Rivales: seed = diferencia respecto al OVR medio del cuadro =====
const RIVAL_STYLES = ["Defensivo", "Agresivo", "Fondista"];
const STYLE_INFO = {
  Defensivo: "devuelve todas las bolas",
  Agresivo: "busca el golpe ganador",
  Fondista: "se queda en el fondo de pista"
};
const LOCAL_RIVALS = [
  { name: "Marc Ortega", seed: 3, brand: "Wilson" }, { name: "Lukas Brandt", seed: 2, brand: "Head" }, { name: "Teo Valdés", seed: 1, brand: "Babolat" },
  { name: "Iván Petrov", seed: 0, brand: "Yonex" }, { name: "Sam Whitaker", seed: -1, brand: "Dunlop" }, { name: "Nico Ferrer", seed: -2, brand: "Prince" },
  { name: "Davide Conti", seed: -3, brand: "Lacoste" }, { name: "Hugo Lemaire", seed: -4, brand: "Lotto" }
];
const PRO_RIVALS = [
  { name: "Alexander Zverev", seed: 3, style: "Agresivo", brand: "Yonex", country: "Alemania" },
  { name: "Daniil Medvedev", seed: 2, style: "Defensivo", brand: "Lacoste", country: "Australia" },
  { name: "Taylor Fritz", seed: 1, style: "Agresivo", brand: "Head", country: "Estados Unidos" },
  { name: "Casper Ruud", seed: 0, style: "Fondista", brand: "Yonex", country: "Noruega" },
  { name: "Ben Shelton", seed: 0, style: "Agresivo", brand: "Yonex", country: "Estados Unidos" },
  { name: "Andrey Rublev", seed: -1, style: "Agresivo", brand: "Head", country: "Serbia" },
  { name: "Stefanos Tsitsipas", seed: -2, style: "Fondista", brand: "Wilson", country: "Grecia" }
];
const STAR_RIVALS = [
  { name: "Carlos Alcaraz", seed: 8, style: "Agresivo", brand: "Babolat", country: "España" },
  { name: "Jannik Sinner", seed: 8, style: "Fondista", brand: "Head", country: "Italia" },
  { name: "Novak Djokovic", seed: 7, style: "Defensivo", brand: "Lacoste", country: "Serbia" }
];

// ===== Estrategias de punto. No se muestran porcentajes: el usuario decide por el estilo del rival =====
const matchStrategies = [
  { id: "attack",  title: "🔥 Atacar",            serveTitle: "💥 Saque potente",       detail: "Potencia desde el fondo. Gasta más energía.", serveDetail: "Saque a toda velocidad: abre el punto, pero puede fallar.", energy: -0.6, fault: 0.22, vs: { Defensivo: 0.10, Agresivo: -0.04, Fondista: 0.02 }, winText: "Tu potencia encuentra el hueco.", lossText: "El golpe demasiado largo sale fuera." },
  { id: "control", title: "🎯 Jugar con control", serveTitle: "🎯 Saque con control",   detail: "Bolas seguras y poca energía.",               serveDetail: "Saque colocado: entra casi siempre, pero gana menos puntos directos.", energy: -0.2, fault: 0.10, vs: { Defensivo: -0.04, Agresivo: 0.10, Fondista: 0.02 }, winText: "Tu bola segura cansó al rival.", lossText: "El rival castiga tu bola corta." },
  { id: "net",     title: "🚀 Subir a la red",    serveTitle: "🚀 Saque y red",          detail: "Presiona con la volea.",                      serveDetail: "Saque exterior y subida: riesgo moderado, gran premio si conectas.", energy: -0.4, fault: 0.16, vs: { Defensivo: 0.02, Agresivo: -0.04, Fondista: 0.10 }, winText: "La volea cierra el punto.", lossText: "El rival te pasa por el lado descubierto." }
];

// ===== Escenarios mensuales =====
// onlyFirst: solo el primer mes de la carrera · month: mes fijo (0-11) · once: una sola vez en la carrera
// priority: si se cumple la condición, sale seguro · when(p): condición para que pueda salir
const SCENARIOS = [
  {
    id: "primera-semana", onlyFirst: true,
    title: "📅 Primera Semana",
    text: "Acabas de firmar en una academia local. ¿En qué enfocarte?",
    choices: [
      { text: "🏋️ Entrenamiento físico intenso", detail: "El preparador detecta que te falta fondo para aguantar intercambios largos. Haces series de velocidad y fuerza; el esfuerzo te deja cansado, pero ganas resistencia.", effects: { energy: -15, skill: +10, money: -5 }, log: "Suda la camiseta. Tu resistencia mejora." },
      { text: "🎾 Clases de técnica con coach", detail: "En vídeo, el entrenador ve que llegas tarde a la pelota y golpeas la derecha con el brazo rígido. Corrige apoyos y mecánica con ejercicios repetidos; cuesta más, pero acelera tu progreso.", effects: { energy: -10, skill: +15, money: -10 }, log: "Ajustas tu golpe de derecha. Gran progreso técnico." },
      { text: "💼 Trabajar medio tiempo para ahorrar", detail: "La academia ofrece unas horas en recepción. Aceptas para pagar viajes y material, aunque el turno coincide con parte del entrenamiento y limita tu avance en pista.", effects: { energy: -10, skill: 0, money: +20 }, log: "Ahorras, pero pierdes horas de práctica." }
    ]
  },
  {
    id: "clasificatorio",
    title: "🏆 Torneo Clasificatorio",
    text: "Hay un torneo regional con buena dotación. ¿Participas?",
    choices: [
      { text: "✅ Ir bien descansado y concentrado", detail: "Has preparado el torneo con una semana de sueño y cargas controladas. Llegas con energía para competir por el premio; ahora toca demostrarlo en un partido oficial.", effects: { energy: -12, money: +15, match: true }, log: "Juegas al máximo. La tensión está en el punto de quiebre." },
      { text: "🤝 Aceptas patrocinio rápido del evento", detail: "Un comercio local cubre tus gastos a cambio de asistir a varias promociones. El dinero resuelve el viaje y te da visibilidad, pero esas apariciones reemplazan horas de pista.", effects: { energy: -5, fame: +10, money: +25, skill: -5 }, log: "Ganas visibilidad, pero descuidas tu técnica bajo presión." },
      { text: "📉 Descansas y sigues entrenando", detail: "Notas que todavía no estás listo para competir con consistencia. Renuncias a este cuadro para recuperar energía y trabajar en tu juego; mejoras, pero no sumas exposición ni premio.", effects: { energy: +15, skill: +5, fame: -5 }, log: "Priorizas tu cuerpo. Tus rivales avanzan sin ti." }
    ]
  },
  {
    id: "fatiga", when: p => p.energy < 55 && p.injuryMonths === 0,
    title: "⚠️ Signos de Fatiga",
    text: "Tras varias sesiones de golpes repetidos, aparece un dolor persistente en la muñeca. El médico sospecha sobrecarga por volumen de entrenamiento y recomienda no ocultar los síntomas.",
    choices: [
      { text: "🧊 Descanso obligatorio (3 días)", detail: "El médico explica que la irritación probablemente viene de encadenar sesiones sin suficiente recuperación. Paras tres días y haces ejercicios suaves; pierdes tiempo de pista, pero reduces la carga y recuperas energía.", effects: { energy: +20, skill: 0, money: -10, flags: { fatigueIgnored: false } }, log: "Cuidas tu lesión. Recuperas forma física." },
      { text: "💊 Juegas con analgésicos", detail: "Decides seguir pese al dolor. El analgésico solo tapa la señal: si la muñeca falla, la sobrecarga puede empeorar. Arriesgas salud a cambio de rendimiento, fama y una posible lesión seria.", effects: { energy: -20, skill: +10, fame: +15, risk: true, flags: { fatigueIgnored: true } }, log: "Asumes un riesgo alto por competir." },
      { text: "📞 Llamas a un fisioterapeuta caro", detail: "Un especialista evalúa movilidad y carga, ajusta la técnica de golpeo y pauta ejercicios preventivos. La consulta cuesta, pero te permite seguir entrenando con más cuidado y recuperar capacidad.", effects: { energy: +10, skill: +5, money: -30, flags: { fatigueIgnored: false } }, log: "Inviertes en salud profesional. Paga a largo plazo." }
    ]
  },
  {
    id: "internacional",
    title: "🌍 Oportunidad Internacional",
    text: "Un agente te ofrece un viaje a un torneo europeo. Los vuelos y hoteles salen caros.",
    choices: [
      { text: "🧳 Viajar aunque cueste", detail: "El agente te consigue una plaza, pero no cubre vuelos ni alojamiento. Inviertes tus ahorros en competir con rivales de otros países; el viaje agota, aunque la experiencia y exposición pueden abrir puertas.", effects: { energy: -10, money: -40, fame: +20, skill: +10 }, log: "Exposición internacional. Ganas experiencia contra otros estilos." },
      { text: "📉 Declinar y buscar patrocinadores antes", detail: "Haces números y ves que viajar ahora dejaría muy poco margen para el resto del año. Rechazas la invitación, contactas marcas locales y mantienes entrenamientos, aunque pierdes esta oportunidad internacional.", effects: { energy: +5, money: +10, fame: -10, skill: +5 }, log: "Prudente. Mejoras tu economía pero pierdes ritmo." },
      { text: "🎥 Grabar videos para redes y vivir de ellos", detail: "En vez del viaje, produces consejos y clips de entrenamiento para atraer seguidores. Algunas marcas pagan por menciones y crece tu audiencia, pero grabar y editar te quita horas de práctica.", effects: { energy: -5, fame: +15, money: +15, skill: -10 }, log: "Atraes audiencia, pero tu juego se vuelve secundario." }
    ]
  },
  {
    id: "patrocinio", once: true, when: p => p.fame >= 15,
    title: "🤝 Crisis de Patrocinio",
    text: "Una marca importante te ofrece un contrato exclusivo. Puedes firmar para ganar dinero y visibilidad, o seguir con tu patrocinador actual y priorizar el tenis. El patrocinio te da ingresos cada mes.",
    choices: [
      { text: "✍️ Firmar con la nueva marca (+$12/mes)", detail: "La marca exige exclusividad y jornadas de promoción, pero adelanta un bono importante y te da exposición. El material nuevo mejora tu valoración general; las obligaciones reducen descanso y tiempo de entrenamiento.", effects: { energy: -5, skill: -3, ovr: +4, fame: +18, money: +60, sponsor: 12 }, log: "Firmas el contrato: ingresas dinero y ganas fama, aunque las obligaciones comerciales te restan algo de tiempo de pista." },
      { text: "🎾 Quedarme con mi marca actual (+$4/mes)", detail: "Tu patrocinador actual ofrece menos dinero, pero respeta tu calendario deportivo y ya conoces su equipo. Rechazas el gran bono para conservar una rutina estable y mejorar la técnica.", effects: { energy: +5, skill: +5, ovr: +1, fame: +3, money: +15, sponsor: 4 }, log: "Mantienes tu acuerdo actual y el foco en entrenar. El crecimiento comercial es menor, pero mejoras en pista." }
    ]
  },
  {
    id: "rival",
    title: "🔥 Rival Directo",
    text: "Un joven promesa te desafía a un partido amistoso. Si ganas, subes de nivel.",
    choices: [
      { text: "⚔️ Aceptar reto directo", detail: "El desafío se hace público y hay puntos de ranking y un premio extra en juego. Aceptas competir con poco margen de preparación: una victoria puede impulsarte, pero el rival será exigente.", effects: { energy: -15, match: true, highStakes: true }, log: "Partido de alta presión. Todo depende de tu nivel actual." },
      { text: "📊 Analizar videos y preparar estrategia", detail: "Pides grabaciones de sus últimos partidos y el entrenador detecta que suele abrir la pista con el saque. Pagas por el análisis y practicas cómo responder; no hay partido hoy, pero tu lectura táctica mejora.", effects: { energy: -5, skill: +12, money: -10 }, log: "Estudio detallado. Entras mejor preparado al court." },
      { text: "🤝 Invitarlo a entrenar juntos", detail: "Le propones una sesión de intercambio en lugar de alimentar la rivalidad. Practicáis patrones de juego y os dais consejos; el ambiente es positivo y ambos ganáis experiencia.", effects: { energy: +5, skill: +8, fame: +5 }, log: "Sinergia positiva. Ambos mejoran, pero sin rivalidad." }
    ]
  },
  {
    id: "lesion-grave", priority: true, when: p => p.injuryMonths === 0 && (p.flags.fatigueIgnored || Math.random() < injuryRisk()),
    title: "🏥 Lesión Grave Amenaza",
    text: "El dolor de muñeca no desapareció: al volver a golpear con carga alta, la zona se inflamó y perdiste fuerza de agarre. La resonancia confirma una lesión por sobreuso; el equipo explica riesgos y plazos antes de que elijas tratamiento.",
    choices: [
      { text: "🩺 Rehabilitación conservadora (4 meses)", detail: "El especialista recomienda inmovilización breve, fisioterapia y volver a golpear poco a poco. La lesión debería sanar sin cirugía, aunque la inactividad reduce técnica y valoración y te deja fuera cuatro meses.", effects: { energy: +15, skill: -2, ovr: -2, fame: -3, injuryMonths: 4, flags: { fatigueIgnored: false } }, log: "Eliges una recuperación progresiva para volver a competir con seguridad." },
      { text: "🏥 Operación y recuperación completa (14 meses)", detail: "Las pruebas muestran daño que podría no estabilizarse solo con reposo. Aceptas la operación y una rehabilitación larga para tratar la causa; pagas el procedimiento y te pierdes más de una temporada, pero priorizas una vuelta segura.", effects: { energy: +25, skill: -5, ovr: -4, money: -45, fame: -8, injuryMonths: 14, flags: { fatigueIgnored: false } }, log: "La operación requiere paciencia. La lesión te tendrá fuera de las pistas durante más de una temporada." },
      { text: "⚠️ Volver antes del alta (12 meses)", detail: "Te preocupa perder patrocinadores y decides ignorar el alta médica. La muñeca vuelve a resentirse en los primeros golpes; el equipo advierte que agravar el daño puede prolongar la baja y afectar tu nivel.", effects: { energy: -10, skill: -8, ovr: -6, money: -10, fame: -5, injuryMonths: 12, flags: { fatigueIgnored: false } }, log: "Forzar la vuelta agrava la lesión y alarga mucho la recuperación." }
    ]
  },
  {
    id: "cuartos", when: p => p.rankingPoints >= 450,
    title: "🎤 Cuartos de final: la prensa te persigue",
    text: "Llegaste lejos en un torneo importante y la prensa te persigue. ¿Cómo manejas el enfoque?",
    choices: [
      { text: "🧠 Rutina mental estricta", detail: "Tras la atención mediática, tu psicólogo deportivo te ayuda a recuperar una rutina: respiración, visualización y objetivos punto a punto. Llegas más sereno y con energía al partido decisivo.", effects: { energy: +10, skill: +10, match: true }, log: "Bloqueas el ruido. Solo tú, la pelota y la red." },
      { text: "📸 Entrevistas y apariciones", detail: "Aceptas entrevistas y eventos antes de la siguiente ronda. La exposición atrae acuerdos e ingresos, pero el calendario se llena y llegas con menos descanso y práctica.", effects: { energy: -10, fame: +25, money: +20, skill: -5 }, log: "Máxima exposición. Tu bolsa crece, pero tu juego se distrae." },
      { text: "🤫 Baja perfil y viaja solo", detail: "Cancelas compromisos y te desplazas sin equipo de prensa para recuperar calma. Aprovechas el silencio para estudiar el juego, aunque parte del público y de las marcas pierde interés.", effects: { energy: +5, skill: +12, fame: -5 }, log: "Enfoque total. Juegas por pasión, no por fama." }
    ]
  },
  {
    id: "ultimo-empujon", when: p => p.rankingPoints >= 1000 && p.rankingPoints < 3500,
    title: "💡 Último Empujón",
    text: "Te falta poco para el top 10. Un entrenador legendario te ofrece una mentoría.",
    choices: [
      { text: "👴 Aceptar mentoría costosa", detail: "El entrenador revisa tus partidos y encuentra un patrón previsible en tu segundo saque. Su plan individual intensifica las sesiones y exige un pago alto, pero te aporta correcciones y experiencia de élite.", effects: { energy: -10, skill: +20, money: -50, fame: +10 }, log: "Sabiduría de élite. Tu juego da un salto cuántico." },
      { text: "📉 Confías en tu propio método", detail: "Decides no asumir un gasto que comprometería tus viajes. Mantienes el programa que ya te funciona y consigues un pequeño ingreso extra, aunque sin la mirada externa quizá tardes más en corregir tus límites.", effects: { energy: +5, skill: +8, money: +10, fame: +5 }, log: "Autonomía total. Rápido, pero con techo visible." },
      { text: "🤝 Co-entrenamiento con rival", detail: "Un rival de nivel parecido acepta compartir pista y gastos. Os exigís en los ejercicios y comparáis tácticas; mejoras con la práctica, aunque la sesión consume dinero y puede hacer crecer su propia forma.", effects: { energy: +10, skill: +12, fame: +10, money: -10 }, log: "Competencia sana. Ambos elevan la barra." }
    ]
  },
  {
    id: "entrenamiento",
    title: "🏋️ Semana de entrenamiento",
    text: "No hay compromisos en la agenda. Tienes una semana libre para trabajar en tu juego.",
    choices: [
      { text: "💪 Bloque de físico y resistencia", detail: "Series, pesas y trabajo de piernas. Terminas cansado, pero con más fondo.", effects: { energy: -12, skill: +8 }, log: "Semana dura en el gimnasio. Notas más fondo." },
      { text: "🎯 Trabajo técnico con el coach", detail: "Repetís golpes y situaciones de partido. Cuesta dinero, pero el aprendizaje se nota rápido.", effects: { energy: -8, skill: +10, money: -8 }, log: "Semana de técnica. Tus golpes ganan precisión." },
      { text: "😴 Semana de recuperación", detail: "Sueño, fisio ligera y poco tenis. Recuperas energía sin avanzar en tu nivel.", effects: { energy: +20, skill: 0 }, log: "Recargas pilas para los próximos torneos." }
    ]
  },
  {
    id: "sparring",
    title: "🎽 Sparring con un jugador local",
    text: "Un jugador del club te propone jugar un partido de práctica.",
    choices: [
      { text: "🎾 Jugar el partido", detail: "Un partido de verdad, sin presión de torneo: puedes sumar un pequeño premio y algo de ranking.", effects: { energy: -10, money: +10, match: true }, log: "Aceptas el partido de práctica." },
      { text: "🧠 Sesión táctica", detail: "Probáis patrones de juego sin marcador. Aprendes sin gastar mucha energía.", effects: { energy: -5, skill: +8 }, log: "Pruebas patrones nuevos y los interiorizas." },
      { text: "🛌 Declinar y descansar", detail: "Prefieres cuidarte. No avanzas, pero recuperas algo de energía.", effects: { energy: +12, skill: +2 }, log: "Cuidas tu cuerpo." }
    ]
  },
  {
    id: "prensa",
    title: "🎙️ Prensa y redes",
    text: "Un medio local quiere entrevistarte y tus seguidores piden contenido.",
    choices: [
      { text: "🎤 Dar la entrevista", detail: "Ganas visibilidad y algo de dinero, pero pierdes media jornada de entrenamiento.", effects: { energy: -5, fame: +10, money: +10, skill: -2 }, log: "Tu nombre suena un poco más." },
      { text: "🚫 Rechazar y entrenar", detail: "Priorizas la pista. Mejoras, aunque pierdes algo de presencia pública.", effects: { energy: -5, skill: +6, fame: -2 }, log: "Cero distracciones: te centras en tu juego." },
      { text: "🏫 Charla en la academia", detail: "Compartes tu experiencia con jóvenes del club. Gran ambiente y algo de fama local.", effects: { energy: -3, fame: +6, skill: +3 }, log: "Los chavales de la academia te adoran." }
    ]
  },
  {
    id: "exhibicion", month: 11,
    title: "🎆 Exhibición de fin de año",
    text: "Última cita del calendario: una exhibición con premio y mucha prensa. ¿Cómo quieres cerrar el año?",
    choices: [
      { text: "🔥 Ir a por el título", detail: "Has llegado a la exhibición con ganas de cerrar el año arriba. La exigencia y el premio son mayores: compites por puntos extra aunque el esfuerzo puede dejarte sin energía.", effects: { energy: -20, match: true, highStakes: true }, log: "Te juegas el cierre de temporada en la pista." },
      { text: "🧘 Cerrar el año descansando", detail: "La temporada ha acumulado viajes y partidos. Renuncias a la exhibición para recuperar el cuerpo y atender compromisos pendientes; llegas mejor al siguiente año, aunque no sumas puntos.", effects: { energy: +20, fame: +5, money: +10 }, log: "Priorizas la recuperación para empezar fuerte la próxima temporada." },
      { text: "🎾 Entrenar y preparar el siguiente año", detail: "En vez de competir, haces una pretemporada corta centrada en los golpes que más fallaron durante el año. Inviertes algo de dinero en pista y entrenador para empezar la próxima temporada con una base técnica mejor.", effects: { energy: +5, skill: +8, money: -10 }, log: "Terminas la temporada trabajando en tu juego." }
    ]
  }
];
