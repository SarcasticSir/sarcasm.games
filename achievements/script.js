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
        'Health & Wellness': [
            { id: 'cook_meal', name: 'Cooked a Full Healthy Meal', points: 10 },
            { id: 'walk_10k', name: 'Walked 10,000 Steps in a Day', points: 5 },
            { id: 'exercise_daily', name: 'Exercised Every Day for a Week', points: 25 },
            { id: 'ran_5k', name: 'Ran a 5K Race', points: 50 },
            { id: 'lost_10kg', name: 'Lost 10kg Healthily', points: 75 },
            { id: 'get_checkup', name: 'Got a Full Medical Check-up', points: 30 },
            { id: 'meditate_daily', name: 'Meditated Every Day for a Month', points: 40 },
            { id: 'slept_8h_week', name: 'Slept 8 Hours a Night for a Week', points: 15 },
            { id: 'trained_for_hike', name: 'Trained for a Major Hike', points: 55 },
            { id: 'ran_half_marathon', name: 'Completed a Half Marathon', points: 70 },
            { id: 'climbed_rock_wall', name: 'Climbed an Indoor Rock Wall', points: 20 },
            { id: 'completed_30_day_challenge', name: 'Completed a 30-Day Fitness Challenge', points: 45 },
            { id: 'did_a_digital_detox', name: 'Completed a 24-Hour Digital Detox', points: 15 },
            { id: 'joined_a_sports_team', name: 'Joined a Local Sports Team', points: 35 },
            { id: 'learned_to_swim', name: 'Learned to Swim', points: 60 },
            { id: 'ate_vegan_for_a_month', name: 'Ate Vegan for a Month', points: 40 },
            { id: 'did_a_plank_for_5min', name: 'Held a Plank for 5 Minutes', points: 50 },
            { id: 'walked_100k_steps_in_week', name: 'Walked 100,000 Steps in a Week', points: 65 },
            { id: 'did_yoga_every_day', name: 'Did Yoga Every Day for 30 Days', points: 45 },
            { id: 'got_a_health_certification', name: 'Earned a Health & Fitness Certification', points: 80 },
            { id: 'fasted_for_24_hours', name: 'Fasted for 24 Hours', points: 20 },
            { id: 'ran_full_marathon', name: 'Ran a Full Marathon', points: 95 }
        ],
        'Career & Education': [
            { id: 'got_degree', name: 'Earned a College Degree', points: 95 },
            { id: 'promoted', name: 'Received a Promotion', points: 80 },
            { id: 'got_new_job', name: 'Landed Your Dream Job', points: 90 },
            { id: 'completed_course', name: 'Completed a Professional Course', points: 60 },
            { id: 'started_business', name: 'Started Your Own Business', points: 98 },
            { id: 'won_award', name: 'Won a Professional Award', points: 92 },
            { id: 'mentored_junior', name: 'Mentored a Junior Colleague', points: 45 },
            { id: 'learned_software', name: 'Mastered a New Software Program', points: 55 },
            { id: 'negotiated_raise', name: 'Successfully Negotiated a Raise', points: 70 },
            { id: 'gave_presentation', name: 'Gave a Presentation to Executives', points: 65 },
            { id: 'wrote_a_professional_paper', name: 'Authored a Professional Paper', points: 85 },
            { id: 'created_a_portfolio', name: 'Created an Online Portfolio', points: 30 },
            { id: 'taught_a_class', name: 'Taught a Class or Workshop', points: 78 },
            { id: 'became_certified', name: 'Achieved a Professional Certification', points: 90 },
            { id: 'got_first_job', name: 'Got Your First Job', points: 50 },
            { id: 'spoke_at_conference', name: 'Spoke at an Industry Conference', points: 95 },
            { id: 'wrote_a_grant_proposal', name: 'Wrote a Successful Grant Proposal', points: 85 },
            { id: 'launched_a_product', name: 'Launched a Product or Service', points: 92 },
            { id: 'learned_a_new_programming_language', name: 'Learned a New Programming Language', points: 70 },
            { id: 'patented_an_invention', name: 'Patented an Invention', points: 99 },
            { id: 'wrote_a_book_on_your_field', name: 'Published a Book on Your Professional Field', points: 99 },
            { id: 'started_a_startup', name: 'Founded a Successful Startup', points: 100 }
        ],
        'Relationships & Family': [
            { id: 'made_new_friend', name: 'Made a New Close Friend', points: 25 },
            { id: 'reconnected', name: 'Reconnected with an Old Friend', points: 30 },
            { id: 'got_married', name: 'Got Married', points: 100 },
            { id: 'had_child', name: 'Had a Child', points: 100 },
            { id: 'helped_family', name: 'Helped a Family Member in Need', points: 65 },
            { id: 'hosted_party', name: 'Hosted a Successful Party', points: 40 },
            { id: 'wrote_letter', name: 'Wrote a Sincere Letter to a Loved One', points: 20 },
            { id: 'supported_friend', name: 'Supported a Friend Through Hard Times', points: 50 },
            { id: 'adopted_pet', name: 'Adopted a Pet', points: 35 },
            { id: 'planned_family_vacation', name: 'Planned a Family Vacation', points: 45 },
            { id: 'attended_a_wedding', name: 'Attended a Wedding', points: 15 },
            { id: 'gave_a_eulogy', name: 'Gave a Eulogy', points: 75 },
            { id: 'went_on_a_date', name: 'Went on a First Date', points: 5 },
            { id: 'hosted_a_game_night', name: 'Hosted a Game Night', points: 10 },
            { id: 'organized_family_reunion', name: 'Organized a Family Reunion', points: 70 },
            { id: 'found_your_best_man', name: 'Asked or Were Asked to be Best Man/Maid of Honor', points: 85 }
        ],
        'Finance & Home': [
            { id: 'made_budget', name: 'Created and Stuck to a Budget', points: 35 },
            { id: 'saved_500', name: 'Saved $500', points: 50 },
            { id: 'paid_off_debt', name: 'Paid Off a Significant Debt', points: 75 },
            { id: 'bought_car', name: 'Bought a Car', points: 80 },
            { id: 'bought_house', name: 'Bought a House', points: 98 },
            { id: 'invested', name: 'Made Your First Investment', points: 45 },
            { id: 'started_emergency_fund', name: 'Started an Emergency Fund', points: 60 },
            { id: 'fixed_something_in_house', name: 'Fixed Something Major in the House', points: 25 },
            { id: 'sold_something_online', name: 'Sold Something Online for Profit', points: 15 },
            { id: 'completed_taxes', name: 'Completed Taxes on Your Own', points: 40 },
            { id: 'paid_off_a_loan', name: 'Paid Off a Student or Car Loan', points: 85 },
            { id: 'built_something_from_scratch', name: 'Built a Piece of Furniture from Scratch', points: 60 },
            { id: 'reduced_carbon_footprint', name: 'Reduced Your Carbon Footprint', points: 40 },
            { id: 'created_a_vegetable_garden', name: 'Planted and Grew a Vegetable Garden', points: 35 },
            { id: 'started_a_retirement_fund', name: 'Started a Retirement Fund', points: 75 },
            { id: 'designed_a_room', name: 'Designed and Decorated a Room', points: 50 }
        ],
        'Creativity & Hobbies': [
            { id: 'took_photo', name: 'Took a Photo You\'re Proud Of', points: 5 },
            { id: 'learned_song', name: 'Learned a Song on an Instrument', points: 30 },
            { id: 'painted_picture', name: 'Painted a Picture', points: 25 },
            { id: 'wrote_short_story', name: 'Wrote a Short Story', points: 50 },
            { id: 'published_book', name: 'Published a Book', points: 98 },
            { id: 'built_furniture', name: 'Built a Piece of Furniture', points: 45 },
            { id: 'hosted_art_show', name: 'Hosted Your Own Art Show', points: 85 },
            { id: 'mastered_dish', name: 'Mastered a Difficult Recipe', points: 60 },
            { id: 'finished_a_video_game', name: 'Finished a Long Video Game', points: 10 },
            { id: 'wrote_a_poem', name: 'Wrote a Poem', points: 15 },
            { id: 'performed_live', name: 'Performed for a Live Audience', points: 70 },
            { id: 'designed_a_t_shirt', name: 'Designed and Printed a T-Shirt', points: 25 },
            { id: 'learned_to_use_power_tools', name: 'Learned to Use Power Tools', points: 40 },
            { id: 'created_a_podcast', name: 'Created and Published a Podcast', points: 75 },
            { id: 'made_a_short_film', name: 'Made a Short Film', points: 85 },
            { id: 'hosted_a_workshop', name: 'Hosted a Creative Workshop', points: 60 },
            { id: 'finished_a_craft_project', name: 'Finished a Major Craft Project', points: 35 },
            { id: 'organized_a_photo_album', name: 'Organized a Photo Album', points: 20 }
        ],
        'Travel & Adventure': [
            { id: 'first_solo_trip', name: 'Took a Solo Trip', points: 40 },
            { id: 'visited_new_city', name: 'Visited a New City', points: 15 },
            { id: 'visited_new_country', name: 'Visited a New Country', points: 70 },
            { id: 'stayed_abroad', name: 'Lived Abroad for a Year', points: 95 },
            { id: 'went_camping', name: 'Went Camping for the First Time', points: 25 },
            { id: 'learned_surf', name: 'Learned to Surf or Ski', points: 55 },
            { id: 'climbed_mountain', name: 'Climbed a Major Mountain', points: 90 },
            { id: 'hiked_a_long_trail', name: 'Hiked a Long-Distance Trail', points: 80 },
            { id: 'saw_northern_lights', name: 'Saw the Northern Lights', points: 95 },
            { id: 'went_on_a_road_trip', name: 'Went on a Road Trip', points: 30 },
            { id: 'bungee_jumped', name: 'Went Bungee Jumping', points: 80 },
            { id: 'scuba_dived', name: 'Scuba Dived in a New Place', points: 75 },
            { id: 'visited_7_wonders', name: 'Visited one of the Seven Wonders', points: 90 },
            { id: 'traveled_across_country', name: 'Traveled Across the Country', points: 65 },
            { id: 'went_on_a_safari', name: 'Went on a Safari', points: 95 },
            { id: 'visited_a_national_park', name: 'Visited a National Park', points: 30 }
        ],
        'Random Acts of Kindness': [
            { id: 'helped_neighbor', name: 'Helped a Neighbor with Errands', points: 5 },
            { id: 'gave_compliment', name: 'Gave a Sincere Compliment to a Stranger', points: 5 },
            { id: 'volunteered', name: 'Volunteered for a Day', points: 20 },
            { id: 'donated_blood', name: 'Donated Blood', points: 30 },
            { id: 'supported_small_biz', name: 'Supported a Local Small Business', points: 15 },
            { id: 'picked_up_trash', name: 'Picked up Trash in Public', points: 10 },
            { id: 'donated_to_charity', name: 'Donated to a Charity', points: 25 },
            { id: 'gave_up_seat', name: 'Gave Up Your Seat on Public Transit', points: 5 },
            { id: 'left_a_generous_tip', name: 'Left a Generous Tip', points: 10 },
            { id: 'helped_a_friend_move', name: 'Helped a Friend Move', points: 30 },
            { id: 'bought_coffee_for_stranger', name: 'Bought Coffee for a Stranger', points: 15 },
            { id: 'left_a_kind_note', name: 'Left a Kind Note for a Co-worker', points: 10 }
        ]
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
        toggleUnlockedButton.textContent = areUnlockedVisible ? 'Hide Unlocked' : 'Show Unlocked';
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


