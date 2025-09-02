/* Galactic Mining Adventure – stable shop rendering + working upgrades */

const fmt = (n) => {
  if (n >= 1e12) return (n/1e12).toFixed(2) + "T";
  if (n >= 1e9)  return (n/1e9).toFixed(2)  + "B";
  if (n >= 1e6)  return (n/1e6).toFixed(2)  + "M";
  if (n >= 1e3)  return (n/1e3).toFixed(2)  + "k";
  return Math.floor(n).toString();
};

const state = {
  crystals: 0,
  totalCrystals: 0,
  baseClick: 1,
  clickMultiplier: 1,
  luck: { double: 0, triple: 0, quadruple: 0 }, // probabilities in [0..1]
  stardust: 0,
  lastSavedAt: Date.now(),
  prestigeCost: 100_000,

  generators: {
    drone:   { id: "drone",   name: "Mining Drone",   desc: "Small drones that mine asteroids autonomously.", baseCost: 15,   cost: 15,   count: 0, cps: 0.1, scale: 1.15 },
    miner:   { id: "miner",   name: "Asteroid Miner", desc: "A manned mining station for steady extraction.",  baseCost: 100,  cost: 100,  count: 0, cps: 1,   scale: 1.15 },
    laser:   { id: "laser",   name: "Laser Extractor",desc: "High-powered lasers slice asteroids like butter.", baseCost: 500,  cost: 500,  count: 0, cps: 8,   scale: 1.15 },
    quantum: { id: "quantum", name: "Quantum Drill",  desc: "Experimental drills that mine in multiple dimensions.", baseCost: 3000, cost: 3000, count: 0, cps: 40,  scale: 1.17 },
  },

  upgrades: {
    u_double:   { id: "u_double",   name: "Double Click",  desc: "Doubles the crystals gained per click.", cost: 100,   purchased: false, apply(){ state.clickMultiplier *= 2; } },
    u_triple:   { id: "u_triple",   name: "Triple Click",  desc: "Triples the crystals gained per click.", cost: 500,   purchased: false, apply(){ state.clickMultiplier *= 3; } },
    u_quadruple:{ id: "u_quadruple",name: "Quadruple Click", desc: "Quadruples the crystals gained per click.", cost: 2000, purchased: false, apply(){ state.clickMultiplier *= 4; } },
    u_lucky:    { id: "u_lucky",    name: "Lucky Mining",  desc: "5% chance to double the crystals on each click.",  cost: 5000, purchased: false, apply(){ state.luck.double += 0.05; } },
    u_fortune:  { id: "u_fortune",  name: "Fortune Mining",desc: "3% chance to triple the crystals on each click.", cost: 15000,purchased: false, apply(){ state.luck.triple += 0.03; } },
    u_cosmic:   { id: "u_cosmic",   name: "Cosmic Blessing", desc: "1% chance to quadruple the crystals on each click.", cost: 40000, purchased: false, apply(){ state.luck.quadruple += 0.01; } },
  },
};

/** Cached DOM refs */
const $ = (sel) => document.querySelector(sel);
const elCrystals = $("#crystalsCount");
const elStardust = $("#stardustCount");
const elStardustNow = $("#stardustNow");
const elPerClick = $("#perClick");
const elPrestigeCost = $("#prestigeCost");
const elGenerators = $("#generators");
const elUpgrades = $("#upgrades");
const elBigClicker = $("#bigClicker");
const elPrestigeBtn = $("#prestigeBtn");
const elSaveLocal = $("#saveLocalBtn");
const elExport = $("#exportBtn");
const elImport = $("#importFile");

const ui = {
  gens: {},     // id -> {root, cost, owned, btn}
  upgrades: {}, // id -> {root, cost, owned/purchased label, btn}
};

function globalMultiplier() {
  // Each stardust gives +10% global production (clicks & cps)
  return 1 + state.stardust * 0.10;
}

function crystalsPerClick() {
  let base = state.baseClick * state.clickMultiplier * globalMultiplier();
  return base;
}

function totalCps() {
  let cps = 0;
  for (const g of Object.values(state.generators)) {
    cps += g.cps * g.count;
  }
  return cps * globalMultiplier();
}

/* ------- Building the shop ONCE ------- */
function buildGenerators() {
  elGenerators.innerHTML = "";
  for (const g of Object.values(state.generators)) {
    const root = document.createElement("div");
    root.className = "shop-item";
    root.innerHTML = `
      <div class="shop-title">${g.name}</div>
      <div class="shop-desc">${g.desc}</div>
      <div class="shop-row">
        <div class="cost">Cost: <span data-cost>${fmt(g.cost)}</span> ⭐</div>
        <div class="owned">Owned: <span data-owned>${g.count}</span></div>
        <button class="buy-btn" data-buy>Buy</button>
      </div>
    `;
    const cost = root.querySelector("[data-cost]");
    const owned = root.querySelector("[data-owned]");
    const btn = root.querySelector("[data-buy]");
    btn.addEventListener("click", () => buyGenerator(g.id));
    elGenerators.appendChild(root);
    ui.gens[g.id] = { root, cost, owned, btn };
  }
}

function buildUpgrades() {
  elUpgrades.innerHTML = "";
  for (const u of Object.values(state.upgrades)) {
    const root = document.createElement("div");
    root.className = "shop-item";
    root.innerHTML = `
      <div class="shop-title">${u.name}</div>
      <div class="shop-desc">${u.desc}</div>
      <div class="shop-row">
        <div class="cost">Cost: <span data-cost>${fmt(u.cost)}</span> ⭐</div>
        <div class="owned"><span data-owned>${u.purchased ? "Purchased" : "Not purchased"}</span></div>
        <button class="buy-btn" data-buy>Buy</button>
      </div>
    `;
    const cost = root.querySelector("[data-cost]");
    const owned = root.querySelector("[data-owned]");
    const btn = root.querySelector("[data-buy]");
    btn.addEventListener("click", () => buyUpgrade(u.id));
    elUpgrades.appendChild(root);
    ui.upgrades[u.id] = { root, cost, owned, btn };
  }
}

/* ------- Update UI without rebuilding ------- */
function updateTopBar() {
  elCrystals.textContent = fmt(state.crystals);
  elStardust.textContent = fmt(state.stardust);
  elStardustNow.textContent = fmt(state.stardust);
  elPerClick.textContent = fmt(crystalsPerClick());
  elPrestigeCost.textContent = "100,000"; // static display
  elPrestigeBtn.disabled = state.crystals < state.prestigeCost;
}

function updateShop() {
  // Generators
  for (const g of Object.values(state.generators)) {
    const uiEntry = ui.gens[g.id];
    if (!uiEntry) continue;
    uiEntry.cost.textContent = fmt(g.cost);
    uiEntry.owned.textContent = g.count;
    uiEntry.btn.disabled = state.crystals < g.cost;
  }

  // Upgrades (one-time purchases)
  for (const u of Object.values(state.upgrades)) {
    const uiEntry = ui.upgrades[u.id];
    if (!uiEntry) continue;
    uiEntry.cost.textContent = fmt(u.cost);
    uiEntry.owned.textContent = u.purchased ? "Purchased" : "Not purchased";
    uiEntry.btn.disabled = u.purchased || state.crystals < u.cost;
  }
}

/* ------- Game actions ------- */
function mineClick() {
  // base click with luck rolls
  let amount = crystalsPerClick();

  // lucky rolls are independent and multiplicative
  if (Math.random() < state.luck.double)   amount *= 2;
  if (Math.random() < state.luck.triple)   amount *= 3;
  if (Math.random() < state.luck.quadruple)amount *= 4;

  addCrystals(amount);
}

function addCrystals(n) {
  state.crystals += n;
  state.totalCrystals += n;
}

function buyGenerator(id) {
  const g = state.generators[id];
  if (!g) return;
  if (state.crystals < g.cost) return;

  state.crystals -= g.cost;
  g.count += 1;
  g.cost = Math.ceil(g.cost * g.scale);

  updateShop();
  updateTopBar();
}

function buyUpgrade(id) {
  const u = state.upgrades[id];
  if (!u || u.purchased) return;
  if (state.crystals < u.cost) return;

  state.crystals -= u.cost;
  u.purchased = true;
  u.apply();

  updateShop();
  updateTopBar();
}

/* ------- Prestige ------- */
function prestige() {
  if (state.crystals < state.prestigeCost) return;
  // Simple formula: gain 1 Stardust per 100k crystals (floored)
  const gained = Math.floor(state.crystals / 100_000);
  if (gained <= 0) return;

  state.stardust += gained;

  // reset core progress but keep stardust
  state.crystals = 0;
  state.totalCrystals = 0;
  state.baseClick = 1;
  state.clickMultiplier = 1;
  state.luck = { double: 0, triple: 0, quadruple: 0 };

  // reset generators
  for (const g of Object.values(state.generators)) {
    g.count = 0;
    g.cost = g.baseCost;
  }
  // reset upgrades purchase state
  for (const u of Object.values(state.upgrades)) {
    u.purchased = false;
  }

  updateShop();
  updateTopBar();
  saveLocal(false);
  alert(`Prestige! You gained ${gained} Stardust.`);
}

/* ------- Save / Load ------- */
function saveLocal(showAlert = true) {
  state.lastSavedAt = Date.now();
  localStorage.setItem("gma_save_v1", JSON.stringify(state));
  if (showAlert) alert("Game saved to localStorage.");
}

function loadLocal() {
  const raw = localStorage.getItem("gma_save_v1");
  if (!raw) return false;
  try {
    const loaded = JSON.parse(raw);
    // Defensive merge
    Object.assign(state, loaded);

    // Merge nested objects safely
    for (const id in state.generators) {
      if (!loaded.generators?.[id]) continue;
      Object.assign(state.generators[id], loaded.generators[id]);
    }
    for (const id in state.upgrades) {
      if (!loaded.upgrades?.[id]) continue;
      Object.assign(state.upgrades[id], loaded.upgrades[id]);
    }
    if (!state.luck) state.luck = { double:0, triple:0, quadruple:0 };
    if (typeof state.stardust !== "number") state.stardust = 0;
    if (!state.lastSavedAt) state.lastSavedAt = Date.now();
    return true;
  } catch {
    return false;
  }
}

function applyOfflineProgress() {
  const now = Date.now();
  const dtSec = Math.max(0, (now - state.lastSavedAt) / 1000);
  const gain = totalCps() * dtSec;
  if (gain > 0) addCrystals(gain);
}

/* Export / Import file */
function exportToFile() {
  saveLocal(false);
  const blob = new Blob([localStorage.getItem("gma_save_v1") || ""], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "galactic_mining_save.json";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    a.remove();
  }, 0);
}

function importFromFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      localStorage.setItem("gma_save_v1", reader.result);
      loadLocal();
      // rebuild UI (structure is same, but we want text + buttons to reflect purchase states)
      buildGenerators();
      buildUpgrades();
      updateTopBar();
      updateShop();
      alert("Save imported!");
    } catch {
      alert("Import failed: invalid file.");
    }
  };
  reader.readAsText(file);
}

/* ------- Loop ------- */
let last = performance.now();
function loop(now) {
  const dt = (now - last) / 1000;
  last = now;

  // passive income
  const cpsGain = totalCps() * dt;
  if (cpsGain > 0) addCrystals(cpsGain);

  updateTopBar();
  updateShop();
  requestAnimationFrame(loop);
}

/* ------- Init ------- */
function init() {
  const hadSave = loadLocal();
  buildGenerators();
  buildUpgrades();

  if (hadSave) applyOfflineProgress();

  updateTopBar();
  updateShop();

  // events
  elBigClicker.addEventListener("click", mineClick);
  elPrestigeBtn.addEventListener("click", prestige);
  elSaveLocal.addEventListener("click", () => saveLocal(true));
  elExport.addEventListener("click", exportToFile);
  elImport.addEventListener("change", (e) => importFromFile(e.target.files?.[0]));

  // autosave every 30s
  setInterval(() => saveLocal(false), 30_000);

  requestAnimationFrame(loop);
}

document.addEventListener("DOMContentLoaded", init);
