document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
    const categoriesSection = document.getElementById('categories-section');
    const achievementsSection = document.getElementById('achievements-section');
    const categoryGrid = document.getElementById('category-grid');
    const achievementGrid = document.getElementById('achievement-grid');
    const totalScoreElement = document.getElementById('total-score');
    const backButton = document.getElementById('back-button');
    const categoryTitleElement = document.getElementById('category-title');
    const toggleDarkModeButton = document.getElementById('toggle-dark-mode');
    const toggleUnlockedButton = document.getElementById('toggle-unlocked');
    const exportDataButton = document.getElementById('export-data');
    const importFileInput = document.getElementById('import-file');
    const sarcasmGamesButton = document.getElementById('sarcasm-games-button');
    const cardSizeSelect = document.getElementById('card-size-select');
    const toggleListViewButton = document.getElementById('toggle-list-view');
    const viewOptions = document.getElementById('view-options'); // New: Get the view options container

    // Memory Modal Elements
    const memoryModal = document.getElementById('memory-modal');
    const modalContent = memoryModal.querySelector('.modal-content');

    memoryModal.classList.add('hidden'); // Ensure modal is hidden on load

    let unlockedAchievements = new Set();
    let memories = {};
    let currentCategory = '';
    let areUnlockedVisible = true;
    let currentCardSize = 'large';
    let isListView = false;

    const TROPHY_ICONS = {
        bronze: '🏆',
        silver: '🥈',
        gold: '🥇',
        platinum: '✨'
    };

    const ACHIEVEMENT_DATA = {
        "World of Warcraft": [
            { id: "wow-01", name: "Level 60", description: "Reach level 60 on a character.", trophy: "bronze", score: 10, unlocked: false },
            { id: "wow-02", name: "Lorem Ipsum", description: "This is a placeholder achievement.", trophy: "silver", score: 20, unlocked: false },
            { id: "wow-03", name: "Done that", description: "This is a placeholder achievement.", trophy: "gold", score: 50, unlocked: false },
            { id: "wow-04", name: "What does this do", description: "This is a placeholder achievement.", trophy: "platinum", score: 100, unlocked: false }
        ],
        "Counter-Strike": [
            { id: "cs-01", name: "10 Kills", description: "Get 10 kills in a single match.", trophy: "bronze", score: 5, unlocked: false },
            { id: "cs-02", name: "25 Kills", description: "Get 25 kills in a single match.", trophy: "silver", score: 15, unlocked: false }
        ],
        "Gaming": [
            { id: "gaming-01", name: "1000 hours in gaming", description: "Reach 1000 hours of gaming on Steam", trophy: "gold", score: 50, unlocked: false }
        ]
    };

    const CATEGORY_DATA = [
        { name: "World of Warcraft", icon: "⚔️" },
        { name: "Counter-Strike", icon: "🔫" },
        { name: "Gaming", icon: "🎮" }
    ];

    function renderCategories() {
        categoriesSection.classList.remove('hidden');
        achievementsSection.classList.add('hidden');
        backButton.classList.add('hidden');
        viewOptions.classList.add('hidden'); // New: Hide view options on categories page

        categoryGrid.innerHTML = '';
        CATEGORY_DATA.forEach(category => {
            const card = document.createElement('div');
            card.className = 'card';
            card.innerHTML = `
                <span class="trophy-icon">${category.icon}</span>
                <h3>${category.name}</h3>
            `;
            card.addEventListener('click', () => {
                currentCategory = category.name;
                renderAchievements(currentCategory);
            });
            categoryGrid.appendChild(card);
        });
    }

    function renderAchievements(category) {
        categoriesSection.classList.add('hidden');
        achievementsSection.classList.remove('hidden');
        backButton.classList.remove('hidden');
        viewOptions.classList.remove('hidden'); // New: Show view options on achievements page
        
        categoryTitleElement.textContent = category;
        achievementGrid.innerHTML = '';

        const achievements = ACHIEVEMENT_DATA[category];
        achievements.forEach(achievement => {
            const card = document.createElement('div');
            card.className = `card ${currentCardSize}-card ${unlockedAchievements.has(achievement.id) ? 'achievement-unlocked' : ''} ${isListView ? 'list-view' : 'grid-view'}`;
            card.dataset.id = achievement.id;

            let cardContent;
            if (isListView) {
                cardContent = `
                    <span class="trophy-icon ${getTrophyClass(achievement.trophy)}">${TROPHY_ICONS[achievement.trophy]}</span>
                    <h3>${achievement.name}</h3>
                    <p>${achievement.score} pts</p>
                `;
            } else {
                cardContent = `
                    <span class="trophy-icon ${getTrophyClass(achievement.trophy)}">${TROPHY_ICONS[achievement.trophy]}</span>
                    <h3>${achievement.name}</h3>
                    <p>${achievement.description}</p>
                    <p>${achievement.score} pts</p>
                `;
            }
            if (memories[achievement.id]) {
                cardContent += `<button class="memory-icon-button" data-id="${achievement.id}">✨</button>`;
            }

            card.innerHTML = cardContent;
            achievementGrid.appendChild(card);

            card.addEventListener('click', (event) => {
                if (!event.target.classList.contains('memory-icon-button')) {
                    toggleAchievement(achievement.id);
                }
            });

            if (memories[achievement.id]) {
                const memoryButton = card.querySelector('.memory-icon-button');
                memoryButton.addEventListener('click', (event) => {
                    event.stopPropagation();
                    displayMemory(achievement.id);
                });
            }
        });

        filterAchievements();
    }

    function toggleAchievement(id) {
        const achievement = findAchievementById(id);
        if (unlockedAchievements.has(id)) {
            unlockedAchievements.delete(id);
        } else {
            unlockedAchievements.add(id);
            if (achievement.trophy === 'platinum') {
                spawnConfetti();
            }
        }
        updateScore();
        saveState();
        renderAchievements(currentCategory);
    }

    function findAchievementById(id) {
        for (const category in ACHIEVEMENT_DATA) {
            const achievement = ACHIEVEMENT_DATA[category].find(ach => ach.id === id);
            if (achievement) {
                return achievement;
            }
        }
        return null;
    }

    function updateScore() {
        let totalScore = 0;
        unlockedAchievements.forEach(id => {
            const achievement = findAchievementById(id);
            if (achievement) {
                totalScore += achievement.score;
            }
        });
        totalScoreElement.textContent = `${totalScore} pts`;
    }

    function getTrophyClass(trophy) {
        return `trophy-${trophy.toLowerCase()}`;
    }

    function spawnConfetti() {
        const confettiContainer = document.body;
        for (let i = 0; i < 50; i++) {
            const confetti = document.createElement('div');
            confetti.classList.add('confetti-piece');
            confetti.style.backgroundColor = `hsl(${Math.random() * 360}, 100%, 50%)`;
            confetti.style.left = `${Math.random() * 100}vw`;
            confetti.style.top = `${Math.random() * 100}vh`;
            confetti.style.width = confetti.style.height = `${Math.random() * 10 + 5}px`;
            confetti.style.setProperty('--dx', `${(Math.random() - 0.5) * 500}px`);
            confetti.style.setProperty('--dy', `${(Math.random() - 0.5) * 500}px`);
            confetti.style.setProperty('--dr', `${Math.random() * 720}deg`);
            confettiContainer.appendChild(confetti);
            setTimeout(() => confetti.remove(), 3000);
        }
    }

    function saveState() {
        localStorage.setItem('unlockedAchievements', JSON.stringify(Array.from(unlockedAchievements)));
        localStorage.setItem('memories', JSON.stringify(memories));
    }

    function loadState() {
        const storedUnlocked = localStorage.getItem('unlockedAchievements');
        const storedMemories = localStorage.getItem('memories');
        if (storedUnlocked) {
            unlockedAchievements = new Set(JSON.parse(storedUnlocked));
        }
        if (storedMemories) {
            memories = JSON.parse(storedMemories);
        }
        updateScore();
    }

    function exportData() {
        const data = {
            unlocked: Array.from(unlockedAchievements),
            memories: memories,
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'achievement_data.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    function importData(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                if (data.unlocked && data.memories) {
                    unlockedAchievements = new Set(data.unlocked);
                    memories = data.memories;
                    saveState();
                    loadState();
                    if (currentCategory) {
                        renderAchievements(currentCategory);
                    } else {
                        renderCategories();
                    }
                    alert('Data imported successfully!');
                } else {
                    throw new Error('Invalid file format');
                }
            } catch (error) {
                alert('Failed to import data: ' + error.message);
            }
        };
        reader.readAsText(file);
    }

    function filterAchievements() {
        const achievements = document.querySelectorAll('#achievement-grid .card');
        achievements.forEach(card => {
            const isUnlocked = unlockedAchievements.has(card.dataset.id);
            if (!areUnlockedVisible && isUnlocked) {
                card.classList.add('hidden');
            } else {
                card.classList.remove('hidden');
            }
        });
    }

    // Memory Modal Functions
    function displayMemory(id) {
        const memory = memories[id];
        if (!memory) return;

        const memoryContentHtml = `
            <h3>${findAchievementById(id).name}</h3>
            ${memory.image ? `<img src="${memory.image}" alt="Memory image" class="memory-image-display">` : ''}
            <div class="memory-display-content">${memory.note || 'No note added.'}</div>
            <button class="button secondary" id="edit-memory-button" data-id="${id}">Edit</button>
        `;
        modalContent.innerHTML = `
            <span class="close-button">&times;</span>
            <div id="memory-display">${memoryContentHtml}</div>
        `;
        memoryModal.classList.remove('hidden');
        document.getElementById('edit-memory-button').addEventListener('click', () => {
            openMemoryModal(id);
        });
    }

    function openMemoryModal(id) {
        const memory = memories[id] || { note: '', image: null };
        const achievement = findAchievementById(id);

        modalContent.innerHTML = `
            <span class="close-button">&times;</span>
            <h3 class="modal-title">Add a Memory for "${achievement.name}"</h3>
            <textarea id="memory-note" placeholder="Write your memory here...">${memory.note}</textarea>
            <label for="memory-image-upload" class="upload-label">
                <span class="upload-icon">⬆️</span> Upload Image
            </label>
            <input type="file" id="memory-image-upload" accept="image/*" class="hidden">
            <p id="image-name" class="image-name">${memory.image ? 'Image uploaded' : 'No image uploaded'}</p>
            <button class="button" id="save-memory-button" data-id="${id}">Save Memory</button>
        `;
        memoryModal.classList.remove('hidden');

        const saveButton = document.getElementById('save-memory-button');
        const noteInput = document.getElementById('memory-note');
        const fileInput = document.getElementById('memory-image-upload');
        const imageNameElement = document.getElementById('image-name');
        let currentImage = memory.image;

        fileInput.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    currentImage = e.target.result;
                    imageNameElement.textContent = file.name;
                };
                reader.readAsDataURL(file);
            }
        });

        saveButton.addEventListener('click', () => {
            memories[id] = {
                note: noteInput.value,
                image: currentImage
            };
            saveState();
            memoryModal.classList.add('hidden');
            renderAchievements(currentCategory);
        });
    }

    // Event Listeners
    backButton.addEventListener('click', () => {
        renderCategories();
    });

    toggleDarkModeButton.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
    });

    toggleUnlockedButton.addEventListener('click', () => {
        areUnlockedVisible = !areUnlockedVisible;
        toggleUnlockedButton.textContent = areUnlockedVisible ? "Hide Unlocked" : "Show All";
        filterAchievements();
    });

    exportDataButton.addEventListener('click', exportData);
    importFileInput.addEventListener('change', importData);

    sarcasmGamesButton.addEventListener('click', () => {
        alert("This feature is under construction. Thank you for your patience... or don't. I don't care.");
    });

    cardSizeSelect.addEventListener('change', (e) => {
        currentCardSize = e.target.value;
        renderAchievements(currentCategory);
    });

    toggleListViewButton.addEventListener('click', () => {
        isListView = !isListView;
        if (isListView) {
            achievementGrid.classList.remove('grid-view');
            achievementGrid.classList.add('list-view');
            toggleListViewButton.textContent = "Grid View";
        } else {
            achievementGrid.classList.remove('list-view');
            achievementGrid.classList.add('grid-view');
            toggleListViewButton.textContent = "List View";
        }
        renderAchievements(currentCategory);
    });

    document.querySelector('.modal-content').addEventListener('click', (event) => {
        event.stopPropagation();
    });

    memoryModal.addEventListener('click', () => {
        memoryModal.classList.add('hidden');
    });

    document.addEventListener('click', (event) => {
        if (event.target.classList.contains('close-button')) {
            memoryModal.classList.add('hidden');
        } else if (event.target.classList.contains('memory-icon-button')) {
            const id = event.target.dataset.id;
            displayMemory(id);
        }
    });

    // Initial Load
    loadState();
    renderCategories();
});
