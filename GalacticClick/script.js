/*
 * Galactic Mining Adventure
 *
 * A simple incremental game where players mine crystals by clicking on an asteroid.
 * Purchase items to automatically generate crystals per second and upgrades to
 * multiply the crystals obtained per click or add lucky bonuses. Progress is
 * stored locally and can be exported/imported via JSON files. A prestige
 * mechanic allows players to reset progress for long‑term bonuses (Stardust).
 */

// Main game object to track all state
const game = {
    crystals: 0,
    totalCrystals: 0,      // total crystals ever earned (for prestige calculations)
    crystalsPerClick: 1,
    clickMultiplier: 1,
    stardust: 0,          // permanent currency gained from prestiges
    prestigePoints: 0,    // number of times player has prestiged
    items: [],            // array of purchased items
    upgrades: [],         // array of purchased upgrades
    lastUpdated: Date.now(),
};

// Define the available items (mining equipment) with base cost and production rate
const defaultItems = [
    {
        name: "Mining Drone",
        baseCost: 15,
        quantity: 0,
        costMultiplier: 1.15,
        production: 0.1, // crystals per second
        description: "Small drones that mine asteroids autonomously.",
    },
    {
        name: "Asteroid Miner",
        baseCost: 100,
        quantity: 0,
        costMultiplier: 1.15,
        production: 1,
        description: "A manned mining station for steady extraction.",
    },
    {
        name: "Laser Extractor",
        baseCost: 500,
        quantity: 0,
        costMultiplier: 1.15,
        production: 5,
        description: "High‑powered lasers slice asteroids like butter.",
    },
    {
        name: "Quantum Drill",
        baseCost: 3000,
        quantity: 0,
        costMultiplier: 1.15,
        production: 20,
        description: "Experimental drills that mine in multiple dimensions.",
    }
];

// Define the available upgrades with cost and effect
const defaultUpgrades = [
    {
        name: "Double Click",
        cost: 100,
        description: "Doubles the crystals gained per click.",
        purchased: false,
        effect() {
            game.clickMultiplier = 2;
        }
    },
    {
        name: "Triple Click",
        cost: 500,
        description: "Triples the crystals gained per click.",
        purchased: false,
        effect() {
            game.clickMultiplier = 3;
        }
    },
    {
        name: "Quadruple Click",
        cost: 2000,
        description: "Quadruples the crystals gained per click.",
        purchased: false,
        effect() {
            game.clickMultiplier = 4;
        }
    },
    {
        name: "Lucky Mining",
        cost: 5000,
        description: "5% chance to double the crystals on each click.",
        purchased: false,
        effect() {
            game.luckyChance = (game.luckyChance || 0) + 0.05;
        }
    },
    {
        name: "Fortune Mining",
        cost: 15000,
        description: "3% chance to triple the crystals on each click.",
        purchased: false,
        effect() {
            game.fortuneChance = (game.fortuneChance || 0) + 0.03;
        }
    },
    {
        name: "Cosmic Blessing",
        cost: 40000,
        description: "1% chance to quadruple the crystals on each click.",
        purchased: false,
        effect() {
            game.blessingChance = (game.blessingChance || 0) + 0.01;
        }
    }
];

/**
 * Load the game state from localStorage. If no saved state exists, initialize
 * with defaults. Also calculates offline progress based on last update time.
 */
function loadGame() {
    const saved = localStorage.getItem('galacticMiningSave');
    if (saved) {
        try {
            const data = JSON.parse(saved);
            Object.assign(game, data);
            // Reconstruct items and upgrades arrays to ensure methods persist
            game.items = defaultItems.map((item, index) => {
                const savedItem = data.items && data.items[index] ? data.items[index] : {};
                return {
                    ...item,
                    quantity: savedItem.quantity || 0,
                };
            });
            game.upgrades = defaultUpgrades.map((up, index) => {
                const savedUp = data.upgrades && data.upgrades[index] ? data.upgrades[index] : {};
                return {
                    ...up,
                    purchased: savedUp.purchased || false,
                };
            });
            // Compute offline progress
            const now = Date.now();
            const elapsed = Math.max(0, (now - (data.lastUpdated || now)) / 1000); // seconds
            const autoProdPerSec = getAutoProductionRate();
            const offlineGain = autoProdPerSec * elapsed;
            if (offlineGain > 0) {
                game.crystals += offlineGain;
                game.totalCrystals += offlineGain;
            }
            game.lastUpdated = now;
        } catch (err) {
            console.error('Failed to load save:', err);
            initializeDefaults();
        }
    } else {
        initializeDefaults();
    }
}

/**
 * Initialize default game state.
 */
function initializeDefaults() {
    game.crystals = 0;
    game.totalCrystals = 0;
    game.crystalsPerClick = 1;
    game.clickMultiplier = 1;
    game.stardust = 0;
    game.prestigePoints = 0;
    game.luckyChance = 0;
    game.fortuneChance = 0;
    game.blessingChance = 0;
    game.items = defaultItems.map(item => ({ ...item, quantity: 0 }));
    game.upgrades = defaultUpgrades.map(up => ({ ...up, purchased: false }));
    game.lastUpdated = Date.now();
}

/**
 * Save the current game state to localStorage.
 */
function saveGame() {
    const saveData = {
        crystals: game.crystals,
        totalCrystals: game.totalCrystals,
        crystalsPerClick: game.crystalsPerClick,
        clickMultiplier: game.clickMultiplier,
        stardust: game.stardust,
        prestigePoints: game.prestigePoints,
        luckyChance: game.luckyChance || 0,
        fortuneChance: game.fortuneChance || 0,
        blessingChance: game.blessingChance || 0,
        items: game.items.map(item => ({ quantity: item.quantity })),
        upgrades: game.upgrades.map(up => ({ purchased: up.purchased })),
        lastUpdated: Date.now(),
    };
    localStorage.setItem('galacticMiningSave', JSON.stringify(saveData));
}

/**
 * Returns the total crystals per second produced by all items, including stardust bonus.
 */
function getAutoProductionRate() {
    const baseRate = game.items.reduce((acc, item) => acc + item.production * item.quantity, 0);
    return baseRate * (1 + game.stardust * 0.1);
}

/**
 * Update displayed values in the UI: crystals, per click, items, upgrades, prestige.
 */
function updateDisplay() {
    document.getElementById('crystal-count').textContent = Math.floor(game.crystals).toLocaleString();
    document.getElementById('prestige-count').textContent = game.prestigePoints;
    document.getElementById('stardust-count').textContent = game.stardust;
    document.getElementById('per-click-value').textContent = (game.crystalsPerClick * game.clickMultiplier).toLocaleString();
    document.getElementById('prestige-cost').textContent = getPrestigeCost().toLocaleString();
    renderShops();
}

/**
 * Render the items and upgrades lists in the shop.
 */
function renderShops() {
    const itemsContainer = document.getElementById('items-shop');
    itemsContainer.innerHTML = '';
    game.items.forEach((item, index) => {
        const currentCost = getItemCost(item);
        const div = document.createElement('div');
        div.className = 'shop-item';
        div.innerHTML = `
            <div class="item-info">
                <span class="item-name">${item.name}</span>
                <span class="item-description">${item.description}</span>
            </div>
            <div class="item-actions">
                <span class="item-cost">Cost: ${Math.floor(currentCost).toLocaleString()}⭐</span>
                <span class="item-quantity">Owned: ${item.quantity}</span>
                <button class="purchase-btn" data-item-index="${index}">Buy</button>
            </div>
        `;
        itemsContainer.appendChild(div);
    });
    // Attach click listeners after generating the list
    itemsContainer.querySelectorAll('.purchase-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.getAttribute('data-item-index'));
            purchaseItem(idx);
        });
    });
    // Upgrades
    const upgradesContainer = document.getElementById('upgrades-shop');
    upgradesContainer.innerHTML = '';
    game.upgrades.forEach((up, index) => {
        const div = document.createElement('div');
        div.className = 'upgrade-item';
        if (up.purchased) {
            div.innerHTML = `
                <div class="item-info">
                    <span class="item-name">${up.name}</span>
                    <span class="item-description">${up.description}</span>
                </div>
                <div class="item-actions">
                    <span class="item-cost">Purchased</span>
                </div>
            `;
        } else {
            div.innerHTML = `
                <div class="item-info">
                    <span class="item-name">${up.name}</span>
                    <span class="item-description">${up.description}</span>
                </div>
                <div class="item-actions">
                    <span class="item-cost">Cost: ${up.cost.toLocaleString()}⭐</span>
                    <button class="purchase-btn" data-upgrade-index="${index}">Buy</button>
                </div>
            `;
        }
        upgradesContainer.appendChild(div);
    });
    // Attach upgrade buttons
    upgradesContainer.querySelectorAll('.purchase-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.getAttribute('data-upgrade-index'));
            purchaseUpgrade(idx);
        });
    });
}

/**
 * Calculate the current cost of an item based on base cost, quantity, and multiplier.
 */
function getItemCost(item) {
    return item.baseCost * Math.pow(item.costMultiplier, item.quantity);
}

/**
 * Purchase an item if enough crystals are available.
 */
function purchaseItem(index) {
    const item = game.items[index];
    const cost = getItemCost(item);
    if (game.crystals >= cost) {
        game.crystals -= cost;
        item.quantity++;
        // Increase total crystals spent (for prestige calculation)
        // not necessary but we track by adding total crystals to crystals produced. We'll not update total for spending.
        updateDisplay();
        saveGame();
    }
}

/**
 * Purchase an upgrade if enough crystals are available.
 */
function purchaseUpgrade(index) {
    const up = game.upgrades[index];
    if (up.purchased) return;
    if (game.crystals >= up.cost) {
        game.crystals -= up.cost;
        up.purchased = true;
        if (typeof up.effect === 'function') {
            up.effect();
        }
        updateDisplay();
        saveGame();
    }
}

/**
 * Handle clicking on the asteroid. Applies multipliers and lucky chances.
 */
function handleAsteroidClick() {
    let gain = game.crystalsPerClick * game.clickMultiplier;
    // Lucky chances
    const rnd = Math.random();
    if (game.blessingChance && rnd < game.blessingChance) {
        gain *= 4;
    } else if (game.fortuneChance && rnd < (game.blessingChance || 0) + game.fortuneChance) {
        gain *= 3;
    } else if (game.luckyChance && rnd < (game.blessingChance || 0) + (game.fortuneChance || 0) + game.luckyChance) {
        gain *= 2;
    }
    game.crystals += gain;
    game.totalCrystals += gain;
    updateDisplay();
    saveGame();
}

/**
 * Perform prestige: reset the game in exchange for stardust. Stardust boosts future production.
 */
function prestige() {
    const cost = getPrestigeCost();
    if (game.crystals < cost) return;
    // Calculate stardust gained from total crystals
    const gainedStardust = Math.floor(game.totalCrystals / 100000); // 1 stardust per 100k total crystals
    game.stardust += gainedStardust;
    game.prestigePoints += 1;
    // Reset game state but preserve stardust and prestigePoints
    game.crystals = 0;
    game.totalCrystals = 0;
    game.crystalsPerClick = 1;
    game.clickMultiplier = 1;
    game.luckyChance = 0;
    game.fortuneChance = 0;
    game.blessingChance = 0;
    // reset items and upgrades
    game.items.forEach(item => item.quantity = 0);
    game.upgrades.forEach((up, idx) => up.purchased = false);
    game.lastUpdated = Date.now();
    updateDisplay();
    saveGame();
    alert(`You gained ${gainedStardust} Stardust! All progress has been reset.`);
}

/**
 * Calculate the cost of performing a prestige based on number of prestiges already completed.
 */
function getPrestigeCost() {
    return 100000 * (game.prestigePoints + 1);
}

/**
 * Export the save data as a downloadable JSON file.
 */
function exportSave() {
    // Save to localStorage first to ensure the latest state
    saveGame();
    const dataStr = localStorage.getItem('galacticMiningSave');
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const date = new Date().toISOString().replace(/[:.]/g, '-');
    a.download = `galactic_mining_save_${date}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/**
 * Import save data from a JSON file selected by the user.
 */
function importSave(file) {
    const reader = new FileReader();
    reader.onload = function(event) {
        try {
            const data = JSON.parse(event.target.result);
            // Replace current game data
            Object.assign(game, data);
            // Recreate items and upgrades arrays using default definitions
            game.items = defaultItems.map((item, index) => {
                const savedItem = data.items && data.items[index] ? data.items[index] : {};
                return {
                    ...item,
                    quantity: savedItem.quantity || 0,
                };
            });
            game.upgrades = defaultUpgrades.map((up, index) => {
                const savedUp = data.upgrades && data.upgrades[index] ? data.upgrades[index] : {};
                return {
                    ...up,
                    purchased: savedUp.purchased || false,
                };
            });
            updateDisplay();
            saveGame();
            alert('Save loaded successfully!');
        } catch (err) {
            alert('Failed to import save: invalid file.');
        }
    };
    reader.readAsText(file);
}

/**
 * Main game loop: generates crystals per second from items and updates the game state.
 */
function gameLoop() {
    const now = Date.now();
    const dt = (now - game.lastUpdated) / 1000; // seconds since last update
    if (dt > 0) {
        const autoProd = getAutoProductionRate() * dt;
        if (autoProd > 0) {
            game.crystals += autoProd;
            game.totalCrystals += autoProd;
        }
        game.lastUpdated = now;
    }
    updateDisplay();
    // Save periodically (not too frequently)
    if (Math.random() < 0.01) {
        saveGame();
    }
}

/**
 * Initialize event listeners and start the game.
 */
function init() {
    // Load saved data or defaults
    loadGame();
    // Attach click handler to asteroid button
    document.getElementById('asteroid-button').addEventListener('click', handleAsteroidClick);
    // Prestige button
    document.getElementById('prestige-button').addEventListener('click', () => {
        if (game.crystals >= getPrestigeCost()) {
            prestige();
        } else {
            alert('You need more crystals to prestige!');
        }
    });
    // Save button
    document.getElementById('save-button').addEventListener('click', () => {
        saveGame();
        alert('Game saved to localStorage.');
    });
    // Export button
    document.getElementById('export-button').addEventListener('click', () => {
        exportSave();
    });
    // File input
    document.getElementById('file-input').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            importSave(file);
            e.target.value = '';
        }
    });
    // Render initial shop lists
    renderShops();
    updateDisplay();
    // Start game loop
    setInterval(gameLoop, 1000 / 10); // update 10 times per second
    // Save the game before closing the tab
    window.addEventListener('beforeunload', () => {
        saveGame();
    });
}

// Start the game once DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}