/* Galactic Mining Adventure
 * - Clear upgrade effects
 * - Autoclickers use click power (generators produce clicks/sec, converted via crystalsPerClick)
 * - CPS display: total (EMA smoothed), auto, manual
 * - Manual CPS = recent clicks/S * expected per-click (includes luck expectation)
 * - 1 decimal everywhere it makes sense; scientific notation from 1e18 (e.g., 1.0e18)
 * - Breakdown panel and TTA per generator item
 */

/* ---------- Formatting ---------- */
const fmt = (n) => {
  if (!isFinite(n)) return "0";
  const abs = Math.abs(n);
  if (abs >= 1e18) {
    // scientific notation with 1 decimal, compact exponent
    return n.toExponential(1).replace("e+", "e");
  }
  // one decimal max
  const oneDec = Math.round(n * 10) / 10;
  if (Number.isInteger(oneDec)) return String(oneDec);
  return oneDec.toFixed(1);
};

/* ---------- Game State ---------- */
const state = {
  crystals: 0,
  totalCrystals: 0,
  baseClick: 1,
  clickMultiplier: 1,
  luck: { double: 0, triple: 0, quadruple: 0 }, // probabilities
  stardust: 0,
  lastSavedAt: Date.now(),
  prestigeCost: 100_000,

  // Generators produce clicks per second (CPS). Clicks are converted into crystals by crystalsPerClick().
  generators: {
    drone:   { id: "drone",   name: "Mining Drone",   desc: "Small drones that click once in a while.", baseCost: 15,   cost: 15,   count: 0, cps: 0.1, scale: 1.15 },
    miner:   { id: "miner",   name: "Asteroid Miner", desc: "A steady miner that clicks every second.",  baseCost: 100,  cost: 100,  count: 0, cps: 1.0, scale: 1.15 },
    laser:   { id: "laser",   name: "Laser Extractor",desc: "High-powered laser clicks many times.",     baseCost: 500,  cost: 500,  count: 0, cps: 8.0, scale: 1.15 },
    quantum: { id: "quantum", name: "Quantum Drill",  desc: "Experimental drill with massive CPS.",      baseCost: 3000, cost: 3000, count: 0, cps: 40.0, scale: 1.17 },
  },

  upgrades: {
    u_double:   { id: "u_double",    name: "Double Click",    desc: "Doubles your click power.",                cost: 100,   purchased: false, apply(){ state.clickMultiplier *= 2; } },
    u_triple:   { id: "u_triple",    name: "Triple Click",    desc: "Triples your click power.",                cost: 500,   purchased: false, apply(){ state.clickMultiplier *= 3; } },
    u_quadruple:{ id: "u_quadruple", name: "Quadruple Click", desc: "Quadruples your click power.",             cost: 2000,  purchased: false, apply(){ state.clickMultiplier *= 4; } },
    u_lucky:    { id: "u_lucky",     name: "Lucky Mining",    desc: "+5% chance to x2 on each click.",          cost: 5000,  purchased: false, apply(){ state.luck.double += 0.05; } },
    u_fortune:  { id: "u_fortune",   name: "Fortune Mining",  desc: "+3% chance to x3 on each click.",          cost: 15000, purchased: false, apply(){ state.luck.triple += 0.03; } },
    u_cosmic:   { id: "u_cosmic",    name: "Cosmic Blessing", desc: "+1% chance to x4 on each click.",          cost: 40000, purchased: false, apply(){ state.luck.quadruple += 0.01; } },
  },
};

/* ---------- DOM ---------- */
const $ = (s) => document.querySelector(s);
const elCrystals      = $("#crystalsCount");
const elStardust      = $("#stardustCount");
const elStardustNow   = $("#stardustNow");
const elPerClick      = $("#perClick");
const elPrestigeCost  = $("#prestigeCost");
const elGenerators    = $("#generators");
const elUpgrades      = $("#upgrades");
const elBigClicker    = $("#bigClicker");
const elPrestigeBtn   = $("#prestigeBtn");
const elSaveLocal     = $("#saveLocalBtn");
const elExport        = $("#exportBtn");
const elImport        = $("#importFile");

const elCpsNow    = $("#cpsNow");
const elCpsAuto   = $("#cpsAuto");
const elCpsManual = $("#cpsManual");
const elCpsBtn    = $("#cpsDetailsBtn");
const elCpsPanel  = $("#cpsDetails");
const elBreakdown = $("#cpsBreakdown");

const ui = { gens: {}, upgrades: {} };

/* ---------- Maths ---------- */
function globalMultiplier() {
  // Each stardust gives +10% global production (affects clicks and autoclickers via click power)
  return 1 + state.stardust * 0.10;
}

function crystalsPerClick() {
  const base = state.baseClick * state.clickMultiplier * globalMultiplier();
  const oneDec = Math.round(base * 10) / 10;
  return oneDec;
}

function totalClicksPerSec() {
  let cps = 0;
  for (const g of Object.values(state.generators)) cps += g.cps * g.count;
  return cps;
}

function autoCrystalsPerSec() {
  return totalClicksPerSec() * crystalsPerClick();
}

function expectedLuckFactor() {
  const { double: p2, triple: p3, quadruple: p4 } = state.luck;
  // Independent multiplicative effects
  return (1 + p2) * (1 + 2*p3) * (1 + 3*p4);
}

/* ---------- Manual CPS tracking ---------- */
const clickTimestamps = [];
const MANUAL_WINDOW_MS = 10_000; // 10 seconds

function manualCrystalsPerSec() {
  const now = performance.now();
  while (clickTimestamps.length && now - clickTimestamps[0] > MANUAL_WINDOW_MS) {
    clickTimestamps.shift();
  }
  const clicksPerSec = clickTimestamps.length / (MANUAL_WINDOW_MS / 1000);
  const expectedPerClick = crystalsPerClick() * expectedLuckFactor();
  const val = Math.round(clicksPerSec * expectedPerClick * 10) / 10;
  return val;
}

/* ---------- EMA smoothing for total CPS ---------- */
let emaCps = 0;
const EMA_TAU_SEC = 3; // responsiveness (~3s)

/* ---------- Build shop ONCE ---------- */
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
      <div class="shop-desc" data-stats></div>
    `;
    const cost  = root.querySelector("[data-cost]");
    const owned = root.querySelector("[data-owned]");
    const btn   = root.querySelector("[data-buy]");
    const stats = root.querySelector("[data-stats]");
    btn.addEventListener("click", () => buyGenerator(g.id));
    elGenerators.appendChild(root);
    ui.gens[g.id] = { root, cost, owned, btn, stats };
  }
}

function upgradeEffectText(u) {
  if (u.id === "u_double")     return "+100% click power (affects autoclickers)";
  if (u.id === "u_triple")     return "+200% click power total vs base (affects autoclickers)";
  if (u.id === "u_quadruple")  return "+300% click power total vs base (affects autoclickers)";
  if (u.id === "u_lucky")      return "+5% chance for x2 on each click";
  if (u.id === "u_fortune")    return "+3% chance for x3 on each click";
  if (u.id === "u_cosmic")     return "+1% chance for x4 on each click";
  return "";
}

function buildUpgrades() {
  elUpgrades.innerHTML = "";
  for (const u of Object.values(state.upgrades)) {
    const root = document.createElement("div");
    root.className = "shop-item";
    root.innerHTML = `
      <div class="shop-title">${u.name}</div>
      <div class="shop-desc">${u.desc}</div>
      <div class="shop-desc" data-effect>${upgradeEffectText(u)}</div>
      <div class="shop-row">
        <div class="cost">Cost: <span data-cost>${fmt(u.cost)}</span> ⭐</div>
        <div class="owned"><span data-owned>${u.purchased ? "Purchased" : "Not purchased"}</span></div>
        <button class="buy-btn" data-buy>Buy</button>
      </div>
    `;
    const cost   = root.querySelector("[data-cost]");
    const owned  = root.querySelector("[data-owned]");
    const btn    = root.querySelector("[data-buy]");
    btn.addEventListener("click", () => buyUpgrade(u.id));
    elUpgrades.appendChild(root);
    ui.upgrades[u.id] = { root, cost, owned, btn };
  }
}

/* ---------- UI updates (no rebuild) ---------- */
function updateTopBar() {
  elCrystals.textContent    = fmt(state.crystals);
  elStardust.textContent    = fmt(state.stardust);
  elStardustNow.textContent = fmt(state.stardust);
  elPerClick.textContent    = fmt(crystalsPerClick());
  elPrestigeCost.textContent = "100,000";
  elPrestigeBtn.disabled    = state.crystals < state.prestigeCost;
}

function updateShop() {
  // Generators: show clicks/s and crystals/s; show TTA (time to afford)
  const cpc = crystalsPerClick();
  const totalCpsForTta = autoCrystalsPerSec() + manualCrystalsPerSec();
  for (const g of Object.values(state.generators)) {
    const uiEntry = ui.gens[g.id];
    if (!uiEntry) continue;
    uiEntry.cost.textContent  = fmt(g.cost);
    uiEntry.owned.textContent = g.count;
    uiEntry.btn.disabled      = state.crystals < g.cost;

    const clicksPerSec = g.cps * g.count;
    const crystalsPerSec = clicksPerSec * cpc;

    let tta = "—";
    const missing = g.cost - state.crystals;
    if (missing > 0 && totalCpsForTta > 0) {
      const sec = Math.round((missing / totalCpsForTta) * 10) / 10;
      tta = `${fmt(sec)}s`;
    }

    uiEntry.stats.textContent = `Clicks/s: ${fmt(clicksPerSec)} ⇒ Crystals/s: ${fmt(crystalsPerSec)} · TTA: ${tta}`;
  }

  // Upgrades
  for (const u of Object.values(state.upgrades)) {
    const uiEntry = ui.upgrades[u.id];
    if (!uiEntry) continue;
    uiEntry.cost.textContent  = fmt(u.cost);
    uiEntry.owned.textContent = u.purchased ? "Purchased" : "Not purchased";
    uiEntry.btn.disabled      = u.purchased || state.crystals < u.cost;
  }
}

function updateCpsUi(dt) {
  const auto = autoCrystalsPerSec();
  const manual = manualCrystalsPerSec();
  const instantaneous = auto + manual;

  // EMA smoothing: alpha = 1 - exp(-dt/tau)
  const alpha = 1 - Math.exp(-dt / EMA_TAU_SEC);
  emaCps = emaCps === 0 ? instantaneous : (alpha * instantaneous + (1 - alpha) * emaCps);

  elCpsAuto.textContent   = fmt(auto);
  elCpsManual.textContent = fmt(manual);
  elCpsNow.textContent    = fmt(emaCps);
}

function renderBreakdown() {
  const cpc = crystalsPerClick();
  let html = `<div class="shop-list">`;
  for (const g of Object.values(state.generators)) {
    const clicks = g.cps * g.count;
    const cps = clicks * cpc;
    html += `
      <div class="shop-item">
        <div class="shop-title">${g.name}</div>
        <div class="shop-desc">Clicks/s: ${fmt(clicks)} ⇒ Crystals/s: ${fmt(cps)}</div>
      </div>
    `;
  }
  html += `</div>`;
  elBreakdown.innerHTML = html;
}

/* ---------- Actions ---------- */
function addCrystals(n) {
  state.crystals += n;
  state.totalCrystals += n;
}

function mineClick() {
  // track manual clicks for manual CPS window
  clickTimestamps.push(performance.now());

  let amount = crystalsPerClick();
  // random luck (independent, multiplicative)
  if (Math.random() < state.luck.double)    amount *= 2;
  if (Math.random() < state.luck.triple)    amount *= 3;
  if (Math.random() < state.luck.quadruple) amount *= 4;

  amount = Math.round(amount * 10) / 10;
  addCrystals(amount);
}

function buyGenerator(id) {
  const g = state.generators[id];
  if (!g || state.crystals < g.cost) return;
  state.crystals -= g.cost;
  g.count += 1;
  g.cost = Math.ceil(g.cost * g.scale);
  updateShop(); updateTopBar();
}

function buyUpgrade(id) {
  const u = state.upgrades[id];
  if (!u || u.purchased || state.crystals < u.cost) return;
  state.crystals -= u.cost;
  u.purchased = true;
  u.apply();
  updateShop(); updateTopBar();
}

/* ---------- Prestige ---------- */
function prestige() {
  if (state.crystals < state.prestigeCost) return;
  const gained = Math.floor(state.crystals / 100_000);
  if (gained <= 0) return;

  state.stardust += gained;

  state.crystals = 0;
  state.totalCrystals = 0;
  state.baseClick = 1;
  state.clickMultiplier = 1;
  state.luck = { double: 0, triple: 0, quadruple: 0 };

  for (const g of Object.values(state.generators)) {
    g.count = 0;
    g.cost = g.baseCost;
  }
  for (const u of Object.values(state.upgrades)) u.purchased = false;

  updateShop(); updateTopBar();
  saveLocal(false);
  alert(`Prestige! You gained ${gained} Stardust.`);
}

/* ---------- Save / Load ---------- */
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
    Object.assign(state, loaded);
    for (const id in state.generators) if (loaded.generators?.[id]) Object.assign(state.generators[id], loaded.generators[id]);
    for (const id in state.upgrades)   if (loaded.upgrades?.[id])   Object.assign(state.upgrades[id], loaded.upgrades[id]);
    if (!state.luck) state.luck = { double:0, triple:0, quadruple:0 };
    if (!state.lastSavedAt) state.lastSavedAt = Date.now();
    return true;
  } catch { return false; }
}

function applyOfflineProgress() {
  const now = Date.now();
  const dtSec = Math.max(0, (now - state.lastSavedAt) / 1000);
  const gain = autoCrystalsPerSec() * dtSec; // offline assumes no manual clicks
  if (gain > 0) addCrystals(gain);
}

/* ---------- Import/Export ---------- */
function exportToFile() {
  saveLocal(false);
  const blob = new Blob([localStorage.getItem("gma_save_v1") || ""], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "galactic_mining_save.json";
  document.body.appendChild(a);
  a.click();
  setTimeout(()=>{ URL.revokeObjectURL(url); a.remove(); },0);
}

function importFromFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      localStorage.setItem("gma_save_v1", reader.result);
      loadLocal();
      buildGenerators();
      buildUpgrades();
      updateTopBar();
      updateShop();
      alert("Save imported!");
    } catch { alert("Import failed: invalid file."); }
  };
  reader.readAsText(file);
}

/* ---------- Loop ---------- */
let last = performance.now();
function loop(now) {
  const dt = (now - last) / 1000;
  last = now;

  // passive income from autoclickers
  const passive = autoCrystalsPerSec() * dt;
  if (passive > 0) addCrystals(passive);

  updateTopBar();
  updateShop();
  updateCpsUi(dt);

  requestAnimationFrame(loop);
}

/* ---------- Init ---------- */
function init() {
  const had = loadLocal();
  buildGenerators();
  buildUpgrades();
  if (had) applyOfflineProgress();
  updateTopBar();
  updateShop();

  elBigClicker.addEventListener("click", mineClick);
  elPrestigeBtn.addEventListener("click", prestige);
  elSaveLocal.addEventListener("click", () => saveLocal(true));
  elExport.addEventListener("click", exportToFile);
  elImport.addEventListener("change", (e)=> importFromFile(e.target.files?.[0]));

  elCpsBtn.addEventListener("click", () => {
    const showing = elCpsPanel.style.display !== "none";
    elCpsPanel.style.display = showing ? "none" : "block";
    if (!showing) renderBreakdown();
  });

  setInterval(()=> saveLocal(false), 30_000);
  requestAnimationFrame(loop);
}

document.addEventListener("DOMContentLoaded", init);
