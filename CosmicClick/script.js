document.addEventListener('DOMContentLoaded', () => {
    // Game state variables
    let crystals = 0;
    let cps = 0; // Crystals per second
    let prestigeCount = 0;
    const clickMultiplierChance = 0.05; // 5% chance for a multiplier
    const upgrades = [
        { id: 'miner', name: 'Automated Miner', basePrice: 15, baseCps: 0.1, count: 0 },
        { id: 'drill', name: 'Laser Drill', basePrice: 100, baseCps: 1, count: 0 },
        { id: 'factory', name: 'Crystal Factory', basePrice: 1100, baseCps: 8, count: 0 },
        { id: 'robot', name: 'Mining Robot', basePrice: 12000, baseCps: 47, count: 0 },
        { id: 'starship', name: 'Mining Starship', basePrice: 130000, baseCps: 260, count: 0 }
    ];

    // DOM elements
    const crystalsCountEl = document.getElementById('crystals-count');
    const cpsCountEl = document.getElementById('cps-count');
    const prestigeCountEl = document.getElementById('prestige-count');
    const clickerButton = document.getElementById('asteroid-clicker');
    const upgradesListEl = document.getElementById('upgrades-list');
    const prestigeButton = document.getElementById('prestige-button');
    const clickMessageEl = document.getElementById('click-message');
    const saveButton = document.getElementById('save-button');
    const loadButton = document.getElementById('load-button');
    const loadFileEl = document.getElementById('load-file');

    // --- Game Logic ---

    function updateStats() {
        crystalsCountEl.textContent = formatNumber(crystals);
        cpsCountEl.textContent = formatNumber(cps);
        prestigeCountEl.textContent = formatNumber(prestigeCount);

        upgrades.forEach(upgrade => {
            const upgradeButton = document.getElementById(`buy-${upgrade.id}`);
            if (upgradeButton) {
                upgradeButton.disabled = crystals < calculateUpgradePrice(upgrade);
            }
        });
        prestigeButton.disabled = crystals < 1000000;
    }

    function calculateUpgradePrice(upgrade) {
        return Math.floor(upgrade.basePrice * Math.pow(1.15, upgrade.count));
    }

    function calculateCps() {
        let newCps = 0;
        upgrades.forEach(upgrade => {
            newCps += upgrade.count * upgrade.baseCps;
        });
        // Apply prestige bonus
        newCps *= (1 + prestigeCount * 0.05); // 5% bonus per prestige fragment
        cps = newCps;
    }

    function saveGame() {
        const gameState = {
            crystals,
            prestigeCount,
            lastSaveTime: Date.now(),
            upgrades: upgrades.map(u => ({ id: u.id, count: u.count }))
        };
        localStorage.setItem('cosmicMinerSave', JSON.stringify(gameState));
    }

    function loadGame() {
        const savedState = JSON.parse(localStorage.getItem('cosmicMinerSave'));
        if (savedState) {
            crystals = savedState.crystals;
            prestigeCount = savedState.prestigeCount || 0;
            const lastSaveTime = savedState.lastSaveTime;
            const currentTime = Date.now();
            const offlineTimeInSeconds = (currentTime - lastSaveTime) / 1000;

            upgrades.forEach(upgrade => {
                const savedUpgrade = savedState.upgrades.find(u => u.id === upgrade.id);
                if (savedUpgrade) {
                    upgrade.count = savedUpgrade.count;
                }
            });

            calculateCps();
            const offlineCrystals = cps * offlineTimeInSeconds;
            if (offlineCrystals > 0) {
                crystals += offlineCrystals;
                showClickMessage(`+${formatNumber(offlineCrystals)} (offline)`);
            }

            renderUpgrades();
            updateStats();
        }
    }

    function formatNumber(num) {
        if (num >= 1e12) return (num / 1e12).toFixed(2) + 'T';
        if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
        if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
        if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
        return Math.floor(num);
    }

    function showClickMessage(text) {
        const newMsg = document.createElement('div');
        newMsg.textContent = text;
        newMsg.className = 'click-message';
        document.body.appendChild(newMsg);

        const rect = clickerButton.getBoundingClientRect();
        newMsg.style.left = `${rect.left + rect.width / 2}px`;
        newMsg.style.top = `${rect.top}px`;

        newMsg.style.opacity = '1';
        newMsg.style.transform = 'translateY(-50px) scale(1)';

        setTimeout(() => {
            newMsg.style.opacity = '0';
            newMsg.style.transform = 'translateY(-100px) scale(0.5)';
            setTimeout(() => newMsg.remove(), 500);
        }, 500);
    }

    // --- Event Listeners ---

    clickerButton.addEventListener('click', () => {
        let crystalsGained = 1;
        const random = Math.random();
        let bonusText = '';

        if (random < clickMultiplierChance) {
            if (random < clickMultiplierChance / 3) { // 1.6% chance for 4x
                crystalsGained = 4;
                bonusText = 'QUADRUPLE!';
            } else if (random < clickMultiplierChance * 2 / 3) { // 3.3% chance for 3x
                crystalsGained = 3;
                bonusText = 'TRIPLE!';
            } else { // 5% chance for 2x
                crystalsGained = 2;
                bonusText = 'DOUBLE!';
            }
        }
        
        crystals += crystalsGained * (1 + prestigeCount * 0.05); // Apply prestige bonus
        showClickMessage(`+${formatNumber(crystalsGained)} ${bonusText}`);
        updateStats();
    });

    upgradesListEl.addEventListener('click', (event) => {
        const button = event.target;
        if (button.tagName === 'BUTTON') {
            const upgradeId = button.dataset.upgradeId;
            const upgrade = upgrades.find(u => u.id === upgradeId);
            const price = calculateUpgradePrice(upgrade);
            
            if (crystals >= price) {
                crystals -= price;
                upgrade.count++;
                
                const upgradePriceSpan = document.getElementById(`price-${upgrade.id}`);
                const upgradeCountSpan = document.getElementById(`count-${upgrade.id}`);
                
                upgradePriceSpan.textContent = formatNumber(calculateUpgradePrice(upgrade));
                upgradeCountSpan.textContent = upgrade.count;
                
                calculateCps();
                updateStats();
            }
        }
    });

    prestigeButton.addEventListener('click', () => {
        if (crystals >= 1000000) {
            prestigeCount++;
            crystals = 0;
            upgrades.forEach(upgrade => upgrade.count = 0);
            
            calculateCps();
            renderUpgrades();
            updateStats();
        }
    });

    saveButton.addEventListener('click', () => {
        const gameState = {
            crystals,
            prestigeCount,
            lastSaveTime: Date.now(),
            upgrades: upgrades.map(u => ({ id: u.id, count: u.count }))
        };
        const blob = new Blob([JSON.stringify(gameState)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'cosmic_miner_save.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });

    loadButton.addEventListener('click', () => {
        loadFileEl.click();
    });

    loadFileEl.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const loadedState = JSON.parse(e.target.result);
                if (loadedState) {
                    crystals = loadedState.crystals;
                    prestigeCount = loadedState.prestigeCount || 0;
                    
                    upgrades.forEach(upgrade => {
                        const savedUpgrade = loadedState.upgrades.find(u => u.id === upgrade.id);
                        if (savedUpgrade) {
                            upgrade.count = savedUpgrade.count;
                        }
                    });

                    calculateCps();
                    renderUpgrades();
                    updateStats();
                    saveGame();
                    alert('Game loaded successfully!');
                }
            };
            reader.readAsText(file);
        }
    });

    // --- Game Loop and Initialization ---

    function renderUpgrades() {
        upgradesListEl.innerHTML = '';
        upgrades.forEach(upgrade => {
            const upgradeItem = document.createElement('div');
            upgradeItem.className = 'upgrade-item';
            upgradeItem.innerHTML = `
                <div class="upgrade-info">
                    <h3>${upgrade.name} <span class="upgrade-count" id="count-${upgrade.id}">(${upgrade.count})</span></h3>
                    <p>Price: <span id="price-${upgrade.id}">${formatNumber(calculateUpgradePrice(upgrade))}</span> Crystals</p>
                    <p>+${upgrade.baseCps} CPS</p>
                </div>
                <button class="upgrade-buy-button" id="buy-${upgrade.id}" data-upgrade-id="${upgrade.id}">Buy</button>
            `;
            upgradesListEl.appendChild(upgradeItem);
        });
    }

    function gameLoop() {
        crystals += cps;
        updateStats();
    }

    setInterval(gameLoop, 1000);
    setInterval(saveGame, 10000); // Autosave every 10 seconds

    // Initial setup
    loadGame();
    renderUpgrades();
    updateStats();
});