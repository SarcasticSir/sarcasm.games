document.addEventListener('DOMContentLoaded', () => {
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

    // Memory Modal Elements
    const memoryModal = document.getElementById('memory-modal');
    const modalContent = memoryModal.querySelector('.modal-content');

    memoryModal.classList.add('hidden');

    let unlockedAchievements = new Set();
    let memories = {};
    let currentCategory = '';
    let areUnlockedVisible = true;
    let currentCardSize = 'large';
    let isListView = false;

    // Store user-defined personal goals. Each goal has an id and name.
    let personalGoals = [];

    /** Generate a unique id for a personal goal. */
    function generatePersonalGoalId() {
        return `pg_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 5)}`;
    }

    /** Check if an id corresponds to a personal goal. */
    function isPersonalGoalId(id) {
        return id && id.startsWith('pg_');
    }

    /** Handle Escape key to close the memory modal. */
    function handleEscape(event) {
        if (event.key === 'Escape' && !memoryModal.classList.contains('hidden')) {
            memoryModal.classList.add('hidden');
            document.removeEventListener('keydown', handleEscape);
        }
    }

    const TROPHY_ICONS = {
        bronze: '🏆',
        silver: '🥈',
        gold: '🥇',
        platinum: '✨'
    };

    // Achievements data for predefined categories
    const ACHIEVEMENTS_BY_CATEGORY = {
        'Personal Growth': [
            { id: 'start_journal', name: 'Started a Journal', points: 15 },
            { id: 'read_book', name: 'Read a Book from Start to Finish', points: 20 },
            { id: 'learn_skill', name: 'Learned a New Basic Skill', points: 35 },
            { id: 'overcome_fear', name: 'Overcame a Major Fear', points: 65 },
            { id: 'speak_public', name: 'Spoke in Public Confidently', points: 80 },
            { id: 'meditate_100', name: 'Meditated for 100 Days Straight', points: 90 },
            { id: 'run_marathon', name: 'Completed a Marathon', points: 95 },
            { id: 'become_mentor', name: 'Became a Mentor to Someone', points: 70 },
            { id: 'quit_bad_habit', name: 'Quit a Major Bad Habit', points: 75 },
            { id: 'created_website', name: 'Created a Fully Functional Website', points: 90 },
            { id: 'publish_article', name: 'Published an Article in a Magazine', points: 85 },
            { id: 'learned_language_basics', name: 'Learned the Basics of a New Language', points: 45 },
            { id: 'finished_online_course', name: 'Completed a Full Online Course', points: 55 },
            { id: 'wrote_personal_mission', name: 'Wrote a Personal Mission Statement', points: 30 },
            { id: 'finished_a_major_project', name: 'Finished a Major Personal Project', points: 60 },
            { id: 'volunteered_for_month', name: 'Volunteered Regularly for a Month', points: 40 },
            { id: 'mentored_someone', name: 'Mentored Someone in Your Field', points: 70 },
            { id: 'read_12_books', name: 'Read 12 Books in a Year', points: 80 },
            { id: 'learned_to_budget', name: 'Mastered Personal Budgeting', points: 55 },
            { id: 'started_side_hustle', name: 'Started a Side Hustle', points: 75 },
            { id: 'earned_black_belt', name: 'Earned a Black Belt in Martial Arts', points: 96 },
            { id: 'wrote_a_book', name: 'Wrote a Book', points: 98 },
            { id: 'completed_a_puzzle', name: 'Completed a 1000-piece Puzzle', points: 25 },
            { id: 'learned_to_juggle', name: 'Learned to Juggle 3 Balls', points: 20 },
            { id: 'mastered_a_magic_trick', name: 'Mastered a Magic Trick', points: 10 },
            { id: 'created_a_personal_brand', name: 'Created a Personal Brand', points: 60 },
            { id: 'learned_to_code', name: 'Learned to Code a Small App', points: 75 },
            { id: 'planted_a_tree', name: 'Planted a Tree', points: 15 },
            { id: 'developed_a_skill', name: 'Developed a New Professional Skill', points: 50 },
            { id: 'spoke_a_new_language', name: 'Had a Conversation in a New Language', points: 60 }
        ],
        // Other categories omitted here for brevity – they remain unchanged
        /* Health & Wellness, Career & Education, Relationships & Family,
           Finance & Home, Creativity & Hobbies, Travel & Adventure,
           Random Acts of Kindness ... */
        'Health & Wellness': [ /* ...same as before... */ ],
        'Career & Education': [ /* ...same as before... */ ],
        'Relationships & Family': [ /* ...same as before... */ ],
        'Finance & Home': [ /* ...same as before... */ ],
        'Creativity & Hobbies': [ /* ...same as before... */ ],
        'Travel & Adventure': [ /* ...same as before... */ ],
        'Random Acts of Kindness': [ /* ...same as before... */ ]
    };

    /** Determine which trophy icon to show based on points. */
    function getTrophyIcon(points) {
        if (points >= 96) return TROPHY_ICONS.platinum;
        if (points >= 76) return TROPHY_ICONS.gold;
        if (points >= 51) return TROPHY_ICONS.silver;
        return TROPHY_ICONS.bronze;
    }

    /** Determine which trophy CSS class to apply based on points. */
    function getTrophyClass(points) {
        if (points >= 96) return 'trophy-platinum';
        if (points >= 76) return 'trophy-gold';
        if (points >= 51) return 'trophy-silver';
        return 'trophy-bronze';
    }

    /** Calculate regular total points excluding personal goals. */
    function calculateTotalScore() {
        let total = 0;
        unlockedAchievements.forEach(id => {
            // Skip personal goals when calculating standard points
            if (isPersonalGoalId(id)) return;
            const achievement = findAchievementById(id);
            if (achievement) {
                total += achievement.points;
            }
        });
        return total;
    }

    /** Calculate the category score (PGP for personal goals). */
    function calculateCategoryScore(categoryName) {
        if (categoryName === 'Personal Goals') {
            return calculatePGPScore();
        }
        let categoryTotal = 0;
        const achievements = ACHIEVEMENTS_BY_CATEGORY[categoryName] || [];
        achievements.forEach(achievement => {
            if (unlockedAchievements.has(achievement.id)) {
                categoryTotal += achievement.points;
            }
        });
        return categoryTotal;
    }

    /** Total Personal Goal Points (PGP) – one point per unlocked goal. */
    function calculatePGPScore() {
        let total = 0;
        personalGoals.forEach(goal => {
            if (unlockedAchievements.has(goal.id)) total += 1;
        });
        return total;
    }

    /** Find an achievement or personal goal by id. */
    function findAchievementById(id) {
        // Check standard achievements
        for (const category in ACHIEVEMENTS_BY_CATEGORY) {
            const achievement = ACHIEVEMENTS_BY_CATEGORY[category].find(ach => ach.id === id);
            if (achievement) {
                return achievement;
            }
        }
        // Check personal goals
        const goal = personalGoals.find(g => g.id === id);
        if (goal) {
            return { id: goal.id, name: goal.name, points: 1, personal: true };
        }
        return null;
    }

    /** Render category cards including the custom Personal Goals category. */
    function renderCategories() {
        categoryGrid.innerHTML = '';
        // Render predefined categories
        for (const categoryName in ACHIEVEMENTS_BY_CATEGORY) {
            const card = document.createElement('div');
            card.className = 'card category-card';
            card.innerHTML = `
                <span class="trophy-icon">📁</span>
                <h3>${categoryName}</h3>
                <p>${ACHIEVEMENTS_BY_CATEGORY[categoryName].length} Achievements</p>
            `;
            card.addEventListener('click', () => showAchievements(categoryName));
            categoryGrid.appendChild(card);
        }
        // Render Personal Goals category card
        const pgCard = document.createElement('div');
        pgCard.className = 'card category-card';
        pgCard.innerHTML = `
            <span class="trophy-icon">🎯</span>
            <h3>Personal Goals</h3>
            <p>${personalGoals.length} Goals</p>
        `;
        pgCard.addEventListener('click', () => showAchievements('Personal Goals'));
        categoryGrid.appendChild(pgCard);

        categoriesSection.classList.remove('hidden');
        achievementsSection.classList.add('hidden');
    }

    /** Render achievements or personal goals depending on category. */
    function renderAchievements(category) {
        achievementGrid.innerHTML = '';
        // Handle Personal Goals separately
        if (category === 'Personal Goals') {
            // Add-card to create new personal goals
            const addCard = document.createElement('div');
            addCard.className = `card achievement-card add-card card-${currentCardSize}`;
            addCard.innerHTML = `
                <span class="trophy-icon">➕</span>
                <h3>Add Goal</h3>
                <p>Create a new personal goal</p>
            `;
            addCard.addEventListener('click', () => {
                const rawName = prompt('Enter your new personal goal (max 100 characters):');
                if (!rawName) return;
                const trimmed = rawName.trim();
                if (trimmed.length === 0) return;
                const name = trimmed.length > 100 ? trimmed.substring(0, 100) : trimmed;
                const newId = generatePersonalGoalId();
                personalGoals.push({ id: newId, name });
                saveData();
                // Re-render Personal Goals list
                renderAchievements('Personal Goals');
                // If category list is visible, update the card count
                if (!categoriesSection.classList.contains('hidden')) {
                    renderCategories();
                }
            });
            achievementGrid.appendChild(addCard);

            // Show goals based on unlocked filter
            const goalsToShow = areUnlockedVisible
                ? personalGoals
                : personalGoals.filter(goal => !unlockedAchievements.has(goal.id));

            goalsToShow.forEach(goal => {
                const isUnlocked = unlockedAchievements.has(goal.id);
                const card = document.createElement('div');
                card.className = `card achievement-card card-${currentCardSize} ${isUnlocked ? 'achievement-unlocked' : ''}`;
                card.dataset.id = goal.id;

                let memoryButtonHTML = '';
                if (isUnlocked && memories[goal.id]) {
                    memoryButtonHTML = `<button class="memory-icon-button" data-action="view-memory">⭐</button>`;
                } else if (isUnlocked) {
                    memoryButtonHTML = `<button class="memory-icon-button" data-action="add-memory">⭐</button>`;
                }

                // Delete button
                const deleteButtonHTML = `<button class="delete-goal-button" data-action="delete-goal" title="Delete Goal">🗑️</button>`;

                // Build HTML differently for list vs grid view
                let cardInnerHTML;
                if (isListView) {
                    cardInnerHTML = `
                        <span class="trophy-icon">🎯</span>
                        <h3>${goal.name}</h3>
                        ${deleteButtonHTML}
                        ${memoryButtonHTML}
                        <p>1 PGP</p>
                    `;
                } else {
                    cardInnerHTML = `
                        <span class="trophy-icon">🎯</span>
                        <h3>${goal.name}</h3>
                        ${deleteButtonHTML}
                        <p>1 PGP</p>
                        ${memoryButtonHTML}
                    `;
                }
                card.innerHTML = cardInnerHTML;

                card.addEventListener('click', (event) => {
                    const action = event.target.dataset.action;
                    // Handle delete
                    if (action === 'delete-goal') {
                        event.stopPropagation();
                        if (confirm('Are you sure you want to delete this goal?')) {
                            personalGoals = personalGoals.filter(g => g.id !== goal.id);
                            unlockedAchievements.delete(goal.id);
                            delete memories[goal.id];
                            saveData();
                            renderAchievements('Personal Goals');
                            renderCategories();
                            updateScoreDisplay();
                        }
                        return;
                    }
                    // Memory actions
                    if (action === 'view-memory') {
                        event.stopPropagation();
                        viewMemory(goal.id);
                        return;
                    }
                    if (action === 'add-memory') {
                        event.stopPropagation();
                        askForMemory(goal.id);
                        return;
                    }
                    // Toggle lock/unlock for goals
                    if (isUnlocked) {
                        resetAchievement(goal.id);
                    } else {
                        unlockAchievement(goal.id);
                    }
                });
                achievementGrid.appendChild(card);
            });
        } else {
            // Render standard achievements for non-Personal Goals categories
            const achievements = ACHIEVEMENTS_BY_CATEGORY[category] || [];
            const filteredAchievements = areUnlockedVisible
                ? achievements
                : achievements.filter(ach => !unlockedAchievements.has(ach.id));
            filteredAchievements.forEach(achievement => {
                const isUnlocked = unlockedAchievements.has(achievement.id);
                const card = document.createElement('div');
                card.className = `card achievement-card card-${currentCardSize} ${isUnlocked ? 'achievement-unlocked' : ''}`;
                card.dataset.id = achievement.id;

                let memoryButtonHTML = '';
                if (isUnlocked && memories[achievement.id]) {
                    memoryButtonHTML = `<button class="memory-icon-button" data-action="view-memory">⭐</button>`;
                } else if (isUnlocked) {
                    memoryButtonHTML = `<button class="memory-icon-button" data-action="add-memory">⭐</button>`;
                }

                let cardInnerHTML;
                if (isListView && memoryButtonHTML) {
                    cardInnerHTML = `
                        <span class="trophy-icon ${getTrophyClass(achievement.points)}">${getTrophyIcon(achievement.points)}</span>
                        <h3>${achievement.name}</h3>
                        ${memoryButtonHTML}
                        <p>${achievement.points} Points</p>
                    `;
                } else {
                    cardInnerHTML = `
                        <span class="trophy-icon ${getTrophyClass(achievement.points)}">${getTrophyIcon(achievement.points)}</span>
                        <h3>${achievement.name}</h3>
                        <p>${achievement.points} Points</p>
                        ${memoryButtonHTML}
                    `;
                }
                card.innerHTML = cardInnerHTML;

                card.addEventListener('click', (event) => {
                    const targetAction = event.target.dataset.action;
                    if (targetAction === 'view-memory') {
                        event.stopPropagation();
                        viewMemory(achievement.id);
                        return;
                    }
                    if (targetAction === 'add-memory') {
                        event.stopPropagation();
                        askForMemory(achievement.id);
                        return;
                    }
                    // Toggle lock/unlock for standard achievements
                    if (unlockedAchievements.has(achievement.id)) {
                        resetAchievement(achievement.id);
                    } else {
                        unlockAchievement(achievement.id);
                    }
                });
                achievementGrid.appendChild(card);
            });
        }

        // Apply list view styling
        if (isListView) {
            achievementGrid.classList.add('list-view');
        } else {
            achievementGrid.classList.remove('list-view');
        }
    }

    /** Show achievements for a specific category. */
    function showAchievements(category) {
        currentCategory = category;
        categoriesSection.classList.add('hidden');
        achievementsSection.classList.remove('hidden');
        backButton.classList.remove('hidden');
        updateScoreDisplay();
        renderAchievements(category);
    }

    /** Return to category view. */
    function hideAchievements() {
        currentCategory = '';
        categoriesSection.classList.remove('hidden');
        achievementsSection.classList.add('hidden');
        backButton.classList.add('hidden');
        updateScoreDisplay();
        renderCategories();
    }

    /** Unlock an achievement or goal and optionally show memory prompt. */
    function unlockAchievement(achievementId) {
        if (!unlockedAchievements.has(achievementId)) {
            unlockedAchievements.add(achievementId);
            saveData();
            const card = document.querySelector(`[data-id="${achievementId}"]`);
            if (card) {
                launchConfetti(card);
            }
            askForMemory(achievementId);
            updateScoreDisplay();
            renderAchievements(currentCategory);
        }
    }

    /** Reset (lock) an achievement or goal. */
    function resetAchievement(achievementId) {
        unlockedAchievements.delete(achievementId);
        delete memories[achievementId];
        saveData();
        updateScoreDisplay();
        renderAchievements(currentCategory);
    }

    /** Toggle showing/hiding unlocked items. */
    function toggleUnlocked() {
        areUnlockedVisible = !areUnlockedVisible;
        toggleUnlockedButton.textContent = areUnlockedVisible ? 'Hide Unlocked' : 'Show All';
        renderAchievements(currentCategory);
    }

    /** Toggle between grid and list views. */
    function toggleListView() {
        isListView = !isListView;
        toggleListViewButton.textContent = isListView ? 'Show as Grid' : 'Show as List';
        renderAchievements(currentCategory);
    }

    /** Handle changes in card size (small, medium, large). */
    function handleCardSizeChange() {
        currentCardSize = cardSizeSelect.value;
        renderAchievements(currentCategory);
    }

    /** Update both point displays (Total Points and PGP). */
    function updateScoreDisplay() {
        totalScoreElement.textContent = `Total Points: ${calculateTotalScore()}`;
        const pgpElement = document.getElementById('pgp-score');
        if (pgpElement) {
            pgpElement.textContent = `Personal Goal Points: ${calculatePGPScore()}`;
        }
        if (currentCategory) {
            const categoryScore = calculateCategoryScore(currentCategory);
            if (currentCategory === 'Personal Goals') {
                categoryTitleElement.textContent = `${currentCategory} (${categoryScore} PGP)`;
            } else {
                categoryTitleElement.textContent = `${currentCategory} (${categoryScore} Points)`;
            }
        } else {
            categoryTitleElement.textContent = 'Life Achievements';
        }
    }

    /** Save data (unlocked achievements, personal goals, memories) to localStorage. */
    function saveData() {
        const dataToSave = {
            unlocked: Array.from(unlockedAchievements),
            memories: memories,
            personalGoals: personalGoals
        };
        localStorage.setItem('achievementsData', JSON.stringify(dataToSave));
    }

    /** Load data from localStorage (if any). */
    function loadData() {
        const storedData = localStorage.getItem('achievementsData');
        if (storedData) {
            try {
                const data = JSON.parse(storedData);
                unlockedAchievements = new Set(data.unlocked);
                memories = data.memories || {};
                personalGoals = Array.isArray(data.personalGoals) ? data.personalGoals : [];
            } catch (e) {
                console.error("Failed to parse stored data, resetting.", e);
                localStorage.removeItem('achievementsData');
            }
        }
        updateScoreDisplay();
    }

    /** Launch confetti animation from a card when unlocking. */
    function launchConfetti(originElement) {
        const rect = originElement.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        const colors = ['#f44336', '#e91e63', '#9c27b0', '#673ab7', '#3f51b5',
                        '#2196f3', '#00bcd4', '#009688', '#4caf50', '#8bc34a',
                        '#ffeb3b', '#ffc107', '#ff9800', '#ff5722',
                        '#795548', '#607d8b'];
        const confettiCount = 70;

        for (let i = 0; i < confettiCount; i++) {
            const confetti = document.createElement('div');
            confetti.className = 'confetti-piece';
            confetti.style.left = `${centerX}px`;
            confetti.style.top = `${centerY}px`;
            confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
            confetti.style.width = `${Math.random() * 8 + 5}px`;
            confetti.style.height = `${Math.random() * 8 + 5}px`;
            confetti.style.borderRadius = `${Math.random() > 0.5 ? '50%' : '0%'}`;

            const angle = Math.random() * Math.PI * 0.8 + Math.PI * 0.1;
            const velocity = Math.random() * 500 + 60;
            const spread = Math.random() * 200 + 100;
            const initialUpwardVelocity = -Math.sin(angle) * velocity;
            const initialHorizontalVelocity = Math.cos(angle) * spread;

            const gravity = 0.4;
            const rotationSpeed = Math.random() * 1000 - 500;
            const initialRotation = Math.random() * 360;

            let dx = 0;
            let dy = 0;
            let animationStartTime = performance.now();
            const duration = 2000;

            function animateConfetti(currentTime) {
                const elapsedTime = currentTime - animationStartTime;
                const progress = elapsedTime / duration;
                if (progress < 1) {
                    dx = initialHorizontalVelocity * (elapsedTime / 1000);
                    dy = initialUpwardVelocity * (elapsedTime / 1000) +
                        0.5 * gravity * Math.pow(elapsedTime / 1000, 2);

                    confetti.style.setProperty('--dx', `${dx}px`);
                    confetti.style.setProperty('--dy', `${dy}px`);
                    confetti.style.setProperty('--dr', `${initialRotation + rotationSpeed * progress}deg`);
                    confetti.style.opacity = `${1 - progress}`;

                    requestAnimationFrame(animateConfetti);
                } else {
                    confetti.remove();
                }
            }
            requestAnimationFrame(animateConfetti);
            document.body.appendChild(confetti);
        }
    }

    /** Toggle dark mode. */
    function toggleDarkMode() {
        document.body.classList.toggle('dark-mode');
        const isDarkMode = document.body.classList.contains('dark-mode');
        localStorage.setItem('darkMode', isDarkMode);
    }

    /** Apply initial dark/light theme from localStorage or system preference. */
    function applyInitialTheme() {
        const savedTheme = localStorage.getItem('darkMode');
        if (savedTheme === 'true' || (savedTheme === null && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
            document.body.classList.add('dark-mode');
        }
    }

    /** Export data (including personal goals) as JSON. */
    function exportData() {
        const data = JSON.stringify(
            { unlocked: Array.from(unlockedAchievements), memories: memories, personalGoals: personalGoals },
            null, 2
        );
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'life_achievements_data.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /** Import data (including personal goals) from JSON. */
    function importData(event) {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const importedData = JSON.parse(e.target.result);
                if (importedData.unlocked && Array.isArray(importedData.unlocked)) {
                    unlockedAchievements = new Set(importedData.unlocked);
                    memories = importedData.memories || {};
                    personalGoals = Array.isArray(importedData.personalGoals) ? importedData.personalGoals : [];
                    saveData();
                    updateScoreDisplay();
                    renderCategories();
                    alert('Data imported successfully!');
                } else {
                    alert('Invalid JSON file format.');
                }
            } catch (error) {
                alert('Failed to parse JSON file.');
                console.error('Import error:', error);
            }
        };
        reader.readAsText(file);
    }

    /** Show the Add Memory modal. */
    function askForMemory(achievementId) {
        const achievement = findAchievementById(achievementId);
        if (!achievement) return;

        modalContent.innerHTML = `
            <span class="close-button">&times;</span>
            <h2 class="modal-title">Add a Memory</h2>
            <p id="memory-achievement-name">${achievement.name}</p>
            <textarea id="memory-note" placeholder="Write your memory here..."></textarea>
            <label for="memory-image-upload" class="upload-label">
                <span class="upload-icon">🖼️</span> Upload an Image
            </label>
            <input type="file" id="memory-image-upload" accept="image/*" class="hidden">
            <p id="memory-image-name" class="image-name"></p>
            <button id="save-memory-button" class="button">Save Memory</button>
        `;

        memoryModal.classList.remove('hidden');
        document.addEventListener('keydown', handleEscape);
        initializeModalListeners(achievementId);
    }

    /** Show the Memory modal in view mode. */
    function viewMemory(achievementId) {
        const memory = memories[achievementId];
        if (!memory) return;
        const achievement = findAchievementById(achievementId);

        modalContent.innerHTML = `
            <span class="close-button">&times;</span>
            <h2 class="modal-title">Memory for: ${achievement.name}</h2>
            ${memory.note ? `<p class="memory-display-content">${memory.note}</p>` : ''}
            ${memory.image ? `<img src="${memory.image}" class="memory-image-display" alt="Memory Image">` : ''}
            <button id="edit-memory-button" class="button secondary">Edit Memory</button>
        `;

        memoryModal.classList.remove('hidden');
        document.addEventListener('keydown', handleEscape);
        initializeModalListeners(achievementId);
    }

    /** Show the Memory modal in edit mode. */
    function editMemory(achievementId) {
        const memory = memories[achievementId];
        const achievement = findAchievementById(achievementId);

        modalContent.innerHTML = `
            <span class="close-button">&times;</span>
            <h2 class="modal-title">Edit Memory</h2>
            <p id="memory-achievement-name">${achievement.name}</p>
            <textarea id="memory-note" placeholder="Write your memory here...">${memory.note || ''}</textarea>
            <label for="memory-image-upload" class="upload-label">
                <span class="upload-icon">🖼️</span> Upload a New Image
            </label>
            <input type="file" id="memory-image-upload" accept="image/*" class="hidden">
            <p id="memory-image-name" class="image-name"></p>
            ${memory.image ? `<button id="remove-image-button" class="button secondary">Remove Current Image</button>` : ''}
            <button id="save-memory-button" class="button">Save Changes</button>
        `;

        memoryModal.classList.remove('hidden');
        document.addEventListener('keydown', handleEscape);
        initializeModalListeners(achievementId);
    }

    /** Initialize event listeners within the Memory modal. */
    function initializeModalListeners(achievementId) {
        const closeButton = modalContent.querySelector('.close-button');
        const saveMemoryButton = modalContent.querySelector('#save-memory-button');
        const editMemoryButton = modalContent.querySelector('#edit-memory-button');
        const removeImageButton = modalContent.querySelector('#remove-image-button');
        const memoryImageUpload = modalContent.querySelector('#memory-image-upload');
        const memoryImageName = modalContent.querySelector('#memory-image-name');
        const memoryNoteInput = modalContent.querySelector('#memory-note');

        if (closeButton) {
            closeButton.addEventListener('click', () => {
                memoryModal.classList.add('hidden');
                document.removeEventListener('keydown', handleEscape);
            });
        }

        if (saveMemoryButton) {
            saveMemoryButton.addEventListener('click', () => {
                const note = memoryNoteInput.value.trim();
                const imageFile = memoryImageUpload.files[0];
                if (!note && !imageFile && !memories[achievementId]) {
                    alert('Please add a note or an image before saving.');
                    return;
                }
                saveMemory(achievementId, note, imageFile);
            });
        }

        if (editMemoryButton) {
            editMemoryButton.addEventListener('click', () => editMemory(achievementId));
        }

        if (removeImageButton) {
            removeImageButton.addEventListener('click', () => {
                delete memories[achievementId].image;
                saveData();
                editMemory(achievementId);
            });
        }

        if (memoryImageUpload && memoryImageName) {
            memoryImageUpload.addEventListener('change', () => {
                if (memoryImageUpload.files.length > 0) {
                    memoryImageName.textContent = memoryImageUpload.files[0].name;
                } else {
                    memoryImageName.textContent = '';
                }
            });
        }
    }

    /** Save memory data to localStorage and update UI. */
    function saveMemory(achievementId, note, imageFile) {
        const newMemory = {};
        if (note) {
            newMemory.note = note;
        } else {
            newMemory.note = '';
        }

        if (imageFile) {
            const reader = new FileReader();
            reader.onload = (e) => {
                newMemory.image = e.target.result;
                memories[achievementId] = newMemory;
                saveData();
                memoryModal.classList.add('hidden');
                document.removeEventListener('keydown', handleEscape);
                renderAchievements(currentCategory);
            };
            reader.readAsDataURL(imageFile);
        } else {
            if (memories[achievementId] && memories[achievementId].image) {
                newMemory.image = memories[achievementId].image;
            }
            memories[achievementId] = newMemory;
            saveData();
            memoryModal.classList.add('hidden');
            document.removeEventListener('keydown', handleEscape);
            renderAchievements(currentCategory);
        }
    }

    // Attach event listeners for header controls
    backButton.addEventListener('click', hideAchievements);
    toggleDarkModeButton.addEventListener('click', toggleDarkMode);
    toggleUnlockedButton.addEventListener('click', toggleUnlocked);
    exportDataButton.addEventListener('click', exportData);
    importFileInput.addEventListener('change', importData);
    sarcasmGamesButton.addEventListener('click', () => {
        window.open('https://sarcasm.games', '_blank');
    });
    cardSizeSelect.addEventListener('change', handleCardSizeChange);
    toggleListViewButton.addEventListener('click', toggleListView);

    // Initial setup
    applyInitialTheme();
    loadData();
    renderCategories();
});
