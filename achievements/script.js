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
    const modalTitle = document.getElementById('modal-title');
    const memoryAchievementName = document.getElementById('memory-achievement-name');
    const memoryNoteInput = document.getElementById('memory-note');
    const memoryImageUpload = document.getElementById('memory-image-upload');
    const saveMemoryButton = document.getElementById('save-memory-button');
    const memoryImageName = document.getElementById('memory-image-name');
    const closeButton = memoryModal.querySelector('.close-button');

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

    function getTrophyIcon(points) {
        if (points >= 96) return TROPHY_ICONS.platinum;
        if (points >= 76) return TROPHY_ICONS.gold;
        if (points >= 51) return TROPHY_ICONS.silver;
        return TROPHY_ICONS.bronze;
    }

    function getTrophyClass(points) {
        if (points >= 96) return 'trophy-platinum';
        if (points >= 76) return 'trophy-gold';
        if (points >= 51) return 'trophy-silver';
        return 'trophy-bronze';
    }

    function calculateTotalScore() {
        let total = 0;
        unlockedAchievements.forEach(id => {
            const achievement = findAchievementById(id);
            if (achievement) {
                total += achievement.points;
            }
        });
        return total;
    }

    function calculateCategoryScore(categoryName) {
        let categoryTotal = 0;
        const achievements = ACHIEVEMENTS_BY_CATEGORY[categoryName] || [];
        achievements.forEach(achievement => {
            if (unlockedAchievements.has(achievement.id)) {
                categoryTotal += achievement.points;
            }
        });
        return categoryTotal;
    }

    function findAchievementById(id) {
        for (const category in ACHIEVEMENTS_BY_CATEGORY) {
            const achievement = ACHIEVEMENTS_BY_CATEGORY[category].find(ach => ach.id === id);
            if (achievement) {
                return achievement;
            }
        }
        return null;
    }

    function renderCategories() {
        categoryGrid.innerHTML = '';
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
        categoriesSection.classList.remove('hidden');
        achievementsSection.classList.add('hidden');
    }

    function renderAchievements(category) {
        achievementGrid.innerHTML = '';
        const achievements = ACHIEVEMENTS_BY_CATEGORY[category] || [];
        achievements.forEach(achievement => {
            const isUnlocked = unlockedAchievements.has(achievement.id);
            if (!areUnlockedVisible && isUnlocked) {
                return;
            }
            const card = document.createElement('div');
            card.className = `card achievement-card card-${currentCardSize} ${isUnlocked ? 'achievement-unlocked' : ''}`;
            card.dataset.id = achievement.id;

            card.innerHTML = `
                <span class="trophy-icon ${getTrophyClass(achievement.points)}">${getTrophyIcon(achievement.points)}</span>
                <h3>${achievement.name}</h3>
                <p>${achievement.points} Points</p>
                ${isUnlocked && memories[achievement.id] ? '<button class="memory-icon-button" data-action="view-memory">⭐</button>' : ''}
            `;

            card.addEventListener('click', (event) => {
                if (event.target.dataset.action === 'view-memory') {
                    event.stopPropagation();
                    viewMemory(achievement.id);
                    return;
                }
                if (isUnlocked) {
                    resetAchievement(achievement.id);
                } else {
                    unlockAchievement(achievement.id);
                }
            });
            achievementGrid.appendChild(card);
        });
        if (isListView) {
            achievementGrid.classList.add('list-view');
        } else {
            achievementGrid.classList.remove('list-view');
        }
    }

    function showAchievements(category) {
        currentCategory = category;
        categoriesSection.classList.add('hidden');
        achievementsSection.classList.remove('hidden');
        backButton.classList.remove('hidden');
        updateScoreDisplay();
        renderAchievements(category);
    }

    function hideAchievements() {
        categoriesSection.classList.remove('hidden');
        achievementsSection.classList.add('hidden');
        backButton.classList.add('hidden');
        updateScoreDisplay();
    }

    function unlockAchievement(achievementId) {
        if (!unlockedAchievements.has(achievementId)) { // Prevent unlocking an already unlocked achievement
            unlockedAchievements.add(achievementId);
            saveData();
            const achievement = findAchievementById(achievementId);
            if (achievement) {
                const card = document.querySelector(`[data-id="${achievementId}"]`);
                if (card) {
                    launchConfetti(card);
                    askForMemory(achievementId);
                }
            }
            updateScoreDisplay();
            renderAchievements(currentCategory);
        }
    }
    
    function resetAchievement(achievementId) {
        unlockedAchievements.delete(achievementId);
        delete memories[achievementId];
        saveData();
        updateScoreDisplay();
        renderAchievements(currentCategory);
    }
    
    function toggleUnlocked() {
        areUnlockedVisible = !areUnlockedVisible;
        if (areUnlockedVisible) {
            toggleUnlockedButton.textContent = 'Hide Unlocked';
        } else {
            toggleUnlockedButton.textContent = 'Show All';
        }
        renderAchievements(currentCategory);
    }

    function toggleListView() {
        isListView = !isListView;
        if (isListView) {
            toggleListViewButton.textContent = 'Show as Grid';
        } else {
            toggleListViewButton.textContent = 'Show as List';
        }
        renderAchievements(currentCategory);
    }

    function handleCardSizeChange() {
        currentCardSize = cardSizeSelect.value;
        renderAchievements(currentCategory);
    }

    function updateScoreDisplay() {
        // Fix: Use the correct element ID from the HTML
        const scoreElement = document.querySelector('.score-display');
        if (scoreElement) {
            scoreElement.textContent = `Total Points: ${calculateTotalScore()}`;
        }
        if (currentCategory) {
            const categoryScore = calculateCategoryScore(currentCategory);
            categoryTitleElement.textContent = `${currentCategory} (${categoryScore} Points)`;
        }
    }

    function saveData() {
        const dataToSave = {
            unlocked: Array.from(unlockedAchievements),
            memories: memories
        };
        localStorage.setItem('achievementsData', JSON.stringify(dataToSave));
    }

    function loadData() {
        const storedData = localStorage.getItem('achievementsData');
        if (storedData) {
            const data = JSON.parse(storedData);
            unlockedAchievements = new Set(data.unlocked);
            memories = data.memories || {};
        }
        updateScoreDisplay();
    }

    function launchConfetti(originElement) {
        const rect = originElement.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        const colors = ['#f44336', '#e91e63', '#9c27b0', '#673ab7', '#3f51b5', '#2196f3', '#00bcd4', '#009688', '#4caf50', '#8bc34a', '#ffeb3b', '#ffc107', '#ff9800', '#ff5722', '#795548', '#607d8b'];
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
                    dy = initialUpwardVelocity * (elapsedTime / 1000) + 0.5 * gravity * Math.pow(elapsedTime / 1000, 2);

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

    function toggleDarkMode() {
        document.body.classList.toggle('dark-mode');
        const isDarkMode = document.body.classList.contains('dark-mode');
        localStorage.setItem('darkMode', isDarkMode);
    }

    function applyInitialTheme() {
        const savedTheme = localStorage.getItem('darkMode');
        if (savedTheme === 'true' || (savedTheme === null && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
            document.body.classList.add('dark-mode');
        }
    }

    function exportData() {
        const data = JSON.stringify({ unlocked: Array.from(unlockedAchievements), memories: memories }, null, 2);
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

    // Modal Functions
    function askForMemory(achievementId) {
        const achievement = findAchievementById(achievementId);
        if (!achievement) return;

        modalTitle.textContent = 'Add a Memory';
        memoryAchievementName.textContent = achievement.name;
        memoryNoteInput.value = '';
        memoryImageUpload.value = null;
        memoryImageName.textContent = '';
        saveMemoryButton.textContent = 'Save Memory';
        saveMemoryButton.dataset.achievementId = achievementId;
        
        // Ensure the correct content is visible for adding a memory
        const modalContent = memoryModal.querySelector('.modal-content');
        modalContent.innerHTML = `
            <span class="close-button">&times;</span>
            <h2 id="modal-title">Add a Memory</h2>
            <p id="memory-achievement-name">${achievement.name}</p>
            <textarea id="memory-note" placeholder="Write your memory here..."></textarea>
            <label for="memory-image-upload" class="upload-label">
                <span class="upload-icon">🖼️</span> Upload an Image
            </label>
            <input type="file" id="memory-image-upload" accept="image/*" class="hidden">
            <button id="save-memory-button" class="button">Save Memory</button>
            <p id="memory-image-name" class="image-name"></p>
        `;
        
        attachModalListeners(); // Re-attach listeners to new elements
        memoryModal.classList.remove('hidden');
    }

    function viewMemory(achievementId) {
        const memory = memories[achievementId];
        if (!memory) return;
        const achievement = findAchievementById(achievementId);

        // Render the view memory content
        const modalContent = memoryModal.querySelector('.modal-content');
        modalContent.innerHTML = `
            <span class="close-button">&times;</span>
            <h2 id="modal-title">Memory for: ${achievement.name}</h2>
            ${memory.note ? `<p class="memory-display-content">${memory.note}</p>` : ''}
            ${memory.image ? `<img src="${memory.image}" class="memory-image-display" alt="Memory Image">` : ''}
        `;
        
        memoryModal.classList.remove('hidden');

        // Re-attach close button listener
        modalContent.querySelector('.close-button').addEventListener('click', () => {
            memoryModal.classList.add('hidden');
            // Re-render the original modal content for adding memories
            renderMemoryModalContent();
        });
    }

    function renderMemoryModalContent() {
         const modalContent = memoryModal.querySelector('.modal-content');
         modalContent.innerHTML = `
            <span class="close-button">&times;</span>
            <h2 id="modal-title">Add a Memory</h2>
            <p id="memory-achievement-name"></p>
            <textarea id="memory-note" placeholder="Write your memory here..."></textarea>
            <label for="memory-image-upload" class="upload-label">
                <span class="upload-icon">🖼️</span> Upload an Image
            </label>
            <input type="file" id="memory-image-upload" accept="image/*" class="hidden">
            <button id="save-memory-button" class="button">Save Memory</button>
            <p id="memory-image-name" class="image-name"></p>
        `;
        attachModalListeners();
    }

    function saveMemory() {
        const achievementId = saveMemoryButton.dataset.achievementId;
        const note = memoryNoteInput.value.trim();
        const imageFile = memoryImageUpload.files[0];
        
        if (!note && !imageFile) {
            alert('Please add a note or an image before saving.');
            return;
        }

        const newMemory = {};
        if (note) {
            newMemory.note = note;
        }
        
        if (imageFile) {
            const reader = new FileReader();
            reader.onload = (e) => {
                newMemory.image = e.target.result;
                memories[achievementId] = newMemory;
                saveData();
                memoryModal.classList.add('hidden');
                renderAchievements(currentCategory);
                renderMemoryModalContent();
            };
            reader.readAsDataURL(imageFile);
        } else {
            memories[achievementId] = newMemory;
            saveData();
            memoryModal.classList.add('hidden');
            renderAchievements(currentCategory);
            renderMemoryModalContent();
        }
    }

    function attachModalListeners() {
        const modal = document.getElementById('memory-modal');
        const closeBtn = modal.querySelector('.close-button');
        const saveBtn = modal.querySelector('#save-memory-button');
        const fileInput = modal.querySelector('#memory-image-upload');
        const fileNameDisplay = modal.querySelector('#memory-image-name');
        const memoryNote = modal.querySelector('#memory-note');
        
        if (closeBtn) closeBtn.onclick = () => {
            modal.classList.add('hidden');
            // Ensure the original modal content is restored on close
            renderMemoryModalContent();
        };
        if (saveBtn) saveBtn.onclick = saveMemory;
        if (fileInput) fileInput.onchange = () => {
            if (fileInput.files.length > 0) {
                fileNameDisplay.textContent = fileInput.files[0].name;
            } else {
                fileNameDisplay.textContent = '';
            }
        };
    }

    // Event Listeners
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

    // Initial load
    applyInitialTheme();
    loadData();
    renderCategories();
});
