document.addEventListener('DOMContentLoaded', () => {
    // --- CARD DATA ---
    const actionCardData = {
        'fill-oil': { name: 'Fill Oil', type: 'MAINTENANCE' },
        'clean-lens': { name: 'Clean Lens', type: 'MAINTENANCE' },
        'repair': { name: 'Repair Mechanics', type: 'MAINTENANCE' },
        'secure-hatches': { name: 'Secure Hatches', type: 'PREPARATION' },
        'tighten-guy-ropes': { name: 'Tighten Guy Ropes', type: 'PREPARATION' },
        'concentration': { name: 'Concentration', type: 'FOCUS' },
        'momentary-stillness': { name: 'Momentary Stillness', type: 'FOCUS' },
        'stand-against': { name: 'Stand Against', type: 'RESILIENCE' },
    };

    const stormCardData = [
        // Negative Cards (approx. 70)
        { id: 's1', name: 'Monster Wind', threat: 2, req: ['PREPARATION'], aftermath: 'Discard one card from your hand.' },
        { id: 's2', name: 'Salt Spray', threat: 1, req: ['MAINTENANCE'], aftermath: 'No special effect.' },
        { id: 's3', name: 'Equipment Failure', threat: 2, req: ['MAINTENANCE', 'MAINTENANCE'], aftermath: 'Discard the top card from the action deck.' },
        { id: 's4', name: 'Lens Icing', threat: 2, req: ['MAINTENANCE', 'FOCUS'], aftermath: 'No special effect.' },
        { id: 's5', name: 'Monster Wind', threat: 2, req: ['PREPARATION'], aftermath: 'Discard one card from your hand.' },
        { id: 's6', name: 'Shakes', threat: 1, req: ['PREPARATION'], aftermath: 'No special effect.' },
        { id: 's7', name: 'Mental Strain', threat: 1, req: ['FOCUS'], aftermath: 'No special effect.' },
        { id: 's8', name: 'Total Exhaustion', threat: 2, req: ['FOCUS', 'RESILIENCE'], aftermath: 'You cannot play "Focus" cards next round.' },
        { id: 's9', name: 'Gust', threat: 1, req: ['PREPARATION'], aftermath: 'No special effect.' },
        { id: 's10', name: 'Monster Wind', threat: 2, req: ['PREPARATION'], aftermath: 'Discard one card from your hand.' },
        { id: 's11', name: 'Critical Failure', threat: 3, req: ['MAINTENANCE', 'RESILIENCE'], aftermath: 'Discard two cards from your hand.' },
        { id: 's12', name: 'Penetrating Damp', threat: 1, req: ['MAINTENANCE'], aftermath: 'Discard the top card from the action deck.' },
        { id: 's13', name: 'Monster Wind', threat: 2, req: ['PREPARATION'], aftermath: 'Discard one card from your hand.' },
        { id: 's14', name: 'Structural Failure', threat: 3, req: ['PREPARATION', 'RESILIENCE'], aftermath: 'Discard two cards from your hand.' },
        { id: 's15', name: 'Deafening Roar', threat: 1, req: ['FOCUS'], aftermath: 'No special effect.' },
        { id: 's16', name: 'Monster Wind', threat: 2, req: ['PREPARATION'], aftermath: 'Discard one card from your hand.' },
        { id: 's17', name: 'Shattered Glass', threat: 3, req: ['MAINTENANCE', 'PREPARATION', 'RESILIENCE'], aftermath: 'You lose 1 light strength regardless.' },
        { id: 's18', name: 'Relentless Rain', threat: 1, req: ['MAINTENANCE'], aftermath: 'No special effect.' },
        { id: 's19', name: 'Gale Force', threat: 2, req: ['PREPARATION', 'PREPARATION'], aftermath: 'Discard a card from your hand.' },
        { id: 's20', name: 'Electrical Fault', threat: 2, req: ['MAINTENANCE'], aftermath: 'Discard the top 2 cards from the action deck.' },
        { id: 's21', name: 'Crushing Solitude', threat: 1, req: ['FOCUS'], aftermath: 'No special effect.' },
        { id: 's22', name: 'Slippery Rung', threat: 1, req: ['RESILIENCE'], aftermath: 'Discard a card from your hand.' },
        { id: 's23', name: 'Flickering Light', threat: 2, req: ['MAINTENANCE', 'FOCUS'], aftermath: 'Lose 1 Light Strength.' },
        { id: 's24', name: 'Unexpected Splash', threat: 1, req: ['PREPARATION'], aftermath: 'No special effect.' },
        { id: 's25', name: 'Weakened Foundation', threat: 3, req: ['RESILIENCE', 'RESILIENCE'], aftermath: 'Discard 3 cards from your hand.' },
        { id: 's26', name: 'Echoing Silence', threat: 1, req: ['FOCUS'], aftermath: 'No special effect.' },
        { id: 's27', name: 'Corroded Parts', threat: 2, req: ['MAINTENANCE', 'MAINTENANCE'], aftermath: 'Discard a card from your hand.' },
        { id: 's28', name: 'Spiritual Drain', threat: 1, req: ['FOCUS', 'FOCUS'], aftermath: 'Discard a card from your hand.' },
        { id: 's29', name: 'Distant Cry', threat: 1, req: ['RESILIENCE'], aftermath: 'No special effect.' },
        { id: 's30', name: 'Broken Pulley', threat: 2, req: ['MAINTENANCE'], aftermath: 'Discard the top card from the action deck.' },
        { id: 's31', name: 'Shifting Ground', threat: 1, req: ['PREPARATION'], aftermath: 'No special effect.' },
        { id: 's32', name: 'Frigid Air', threat: 2, req: ['MAINTENANCE', 'RESILIENCE'], aftermath: 'Discard two cards from your hand.' },
        { id: 's33', name: 'Phantom Ships', threat: 1, req: ['FOCUS'], aftermath: 'No special effect.' },
        { id: 's34', name: 'Sudden Squall', threat: 2, req: ['PREPARATION'], aftermath: 'Discard a card from your hand.' },
        { id: 's35', name: 'Seeping Water', threat: 1, req: ['MAINTENANCE'], aftermath: 'No special effect.' },
        { id: 's36', name: 'Disorientation', threat: 2, req: ['FOCUS', 'RESILIENCE'], aftermath: 'You cannot play "Focus" or "Resilience" cards next round.' },
        { id: 's37', name: 'Unraveling Rope', threat: 1, req: ['MAINTENANCE'], aftermath: 'No special effect.' },
        { id: 's38', name: 'Mysterious Shadow', threat: 1, req: ['FOCUS'], aftermath: 'Discard a card from your hand.' },
        { id: 's39', name: 'Overwhelming Pressure', threat: 2, req: ['RESILIENCE'], aftermath: 'Discard the top 2 cards from the action deck.' },
        { id: 's40', name: 'Screeching Metal', threat: 1, req: ['MAINTENANCE', 'PREPARATION'], aftermath: 'No special effect.' },
        { id: 's41', name: 'Shattered Mirror', threat: 3, req: ['MAINTENANCE', 'FOCUS'], aftermath: 'You lose 1 light strength regardless.' },
        { id: 's42', name: 'Blinding Fog', threat: 1, req: ['FOCUS'], aftermath: 'No special effect.' },
        { id: 's43', name: 'Harsh Cold', threat: 2, req: ['RESILIENCE'], aftermath: 'Discard a card from your hand.' },
        { id: 's44', name: 'Ghostly Whispers', threat: 1, req: ['FOCUS'], aftermath: 'No special effect.' },
        { id: 's45', name: 'Violent Tremor', threat: 2, req: ['PREPARATION', 'RESILIENCE'], aftermath: 'Discard two cards from your hand.' },
        { id: 's46', name: 'Wailing Wind', threat: 1, req: ['PREPARATION'], aftermath: 'No special effect.' },
        { id: 's47', name: 'Loose Bolt', threat: 1, req: ['MAINTENANCE'], aftermath: 'No special effect.' },
        { id: 's48', name: 'Sudden Glitch', threat: 2, req: ['MAINTENANCE', 'MAINTENANCE'], aftermath: 'Discard the top card from the action deck.' },
        { id: 's49', name: 'Spiteful Current', threat: 2, req: ['PREPARATION', 'PREPARATION'], aftermath: 'Discard a card from your hand.' },
        { id: 's50', name: 'Endless Night', threat: 3, req: ['FOCUS', 'FOCUS'], aftermath: 'You lose 1 light strength regardless.' },
        { id: 's51', name: 'Chilling Spray', threat: 1, req: ['MAINTENANCE'], aftermath: 'No special effect.' },
        { id: 's52', name: 'Disintegrating Rock', threat: 2, req: ['PREPARATION', 'RESILIENCE'], aftermath: 'Discard two cards from your hand.' },
        { id: 's53', name: 'Spooky Sound', threat: 1, req: ['FOCUS'], aftermath: 'No special effect.' },
        { id: 's54', name: 'Broken Compass', threat: 2, req: ['MAINTENANCE', 'PREPARATION'], aftermath: 'You lose 1 light strength regardless.' },
        { id: 's55', name: 'Eroding Cliff', threat: 2, req: ['RESILIENCE'], aftermath: 'Discard the top card from the action deck.' },
        { id: 's56', name: 'Intense Fog', threat: 1, req: ['FOCUS'], aftermath: 'No special effect.' },
        { id: 's57', name: 'Shifting Barometer', threat: 1, req: ['PREPARATION'], aftermath: 'No special effect.' },
        { id: 's58', name: 'Sleepless Night', threat: 1, req: ['FOCUS'], aftermath: 'No special effect.' },
        { id: 's59', name: 'Cold Draft', threat: 1, req: ['PREPARATION'], aftermath: 'No special effect.' },
        { id: 's60', name: 'Haunting Murmur', threat: 1, req: ['FOCUS'], aftermath: 'No special effect.' },
        { id: 's61', name: 'Heavy Rain', threat: 1, req: ['MAINTENANCE'], aftermath: 'No special effect.' },
        { id: 's62', name: 'Mysterious Fissure', threat: 2, req: ['MAINTENANCE', 'PREPARATION'], aftermath: 'Discard the top card from the action deck.' },
        { id: 's63', name: 'Overcast Sky', threat: 1, req: ['MAINTENANCE'], aftermath: 'No special effect.' },
        { id: 's64', name: 'Shivering', threat: 1, req: ['RESILIENCE'], aftermath: 'No special effect.' },
        { id: 's65', name: 'Whirlwind', threat: 2, req: ['PREPARATION'], aftermath: 'Discard a card from your hand.' },
        { id: 's66', name: 'Icy Blast', threat: 2, req: ['MAINTENANCE', 'PREPARATION'], aftermath: 'Discard a card from your hand.' },
        { id: 's67', name: 'Thunderous Waves', threat: 2, req: ['PREPARATION', 'RESILIENCE'], aftermath: 'Discard two cards from your hand.' },
        { id: 's68', name: 'Worn Gears', threat: 2, req: ['MAINTENANCE', 'MAINTENANCE'], aftermath: 'You cannot play "Maintenance" cards next round.' },
        { id: 's69', name: 'Dizzying Heights', threat: 1, req: ['FOCUS'], aftermath: 'No special effect.' },
        { id: 's70', name: 'Tangled Ropes', threat: 2, req: ['MAINTENANCE'], aftermath: 'Discard 1 card from your hand.' },
        { id: 's71', name: 'Foul Odor', threat: 1, req: ['FOCUS'], aftermath: 'No special effect.' },
        { id: 's72', name: 'Sudden Slip', threat: 2, req: ['RESILIENCE'], aftermath: 'Discard 2 cards from your hand.' },

        // Positive Cards (approx. 28) with a threat on failure and reward on success
        { id: 'p1', name: 'Eye of the Storm', threat: 2, req: ['FOCUS'], reward: 3, aftermath: 'Gain 3 Light Strength.' },
        { id: 'p2', name: 'Calm', threat: 1, req: ['FOCUS'], reward: 1, aftermath: 'Restore 1 Light Strength.' },
        { id: 'p3', name: 'Glimmer of Hope', threat: 1, req: ['RESILIENCE'], reward: 0, aftermath: 'Draw two cards.' },
        { id: 'p4', name: 'Respite', threat: 2, req: ['PREPARATION'], reward: 2, aftermath: 'Restore 2 Light Strength.' },
        { id: 'p5', name: 'Found Supplies', threat: 2, req: ['MAINTENANCE'], reward: 0, aftermath: 'Draw 3 cards.' },
        { id: 'p6', name: 'A Moment of Clarity', threat: 1, req: ['FOCUS'], reward: 1, aftermath: 'Restore 1 Light Strength and draw 1 card.' },
        { id: 'p7', name: 'Passing Cloud', threat: 2, req: ['PREPARATION', 'FOCUS'], reward: 2, aftermath: 'No special effect.' },
        { id: 'p8', name: 'Lucky Break', threat: 1, req: ['RESILIENCE'], reward: 1, aftermath: 'Restore 1 Light Strength.' },
        { id: 'p9', name: 'The Tide Turns', threat: 2, req: ['MAINTENANCE', 'RESILIENCE'], reward: 2, aftermath: 'Draw a card.' },
        { id: 'p10', name: 'Beacon of Stability', threat: 2, req: ['MAINTENANCE'], reward: 2, aftermath: 'Restore 2 Light Strength.' },
        { id: 'p11', name: 'Favorable Winds', threat: 1, req: ['PREPARATION'], reward: 0, aftermath: 'Draw 2 cards.' },
        { id: 'p12', name: 'Quiet Before the Storm', threat: 2, req: ['FOCUS'], reward: 1, aftermath: 'Restore 1 Light Strength and draw 1 card.' },
        { id: 'p13', name: 'Unexpected Lull', threat: 2, req: ['MAINTENANCE', 'RESILIENCE'], reward: 2, aftermath: 'No special effect.' },
        { id: 'p14', name: 'Rejuvenation', threat: 2, req: ['MAINTENANCE'], reward: 2, aftermath: 'Restore 2 Light Strength.' },
        { id: 'p15', name: 'Gathering Strength', threat: 2, req: ['FOCUS', 'RESILIENCE'], reward: 0, aftermath: 'Draw 3 cards.' },
        { id: 'p16', name: 'Peaceful Moment', threat: 1, req: ['FOCUS'], reward: 1, aftermath: 'Restore 1 Light Strength.' },
        { id: 'p17', name: 'Clear Horizon', threat: 2, req: ['PREPARATION'], reward: 1, aftermath: 'Restore 1 Light Strength and draw 1 card.' },
        { id: 'p18', name: 'Gentle Breezes', threat: 1, req: ['PREPARATION'], reward: 1, aftermath: 'No special effect.' },
        { id: 'p19', name: 'Rising Sun', threat: 4, req: ['MAINTENANCE', 'PREPARATION', 'FOCUS', 'RESILIENCE'], reward: 10, aftermath: 'Restore all Light Strength to max (10).' },
        { id: 'p20', name: 'Miraculous Recovery', threat: 3, req: ['MAINTENANCE', 'FOCUS'], reward: 2, aftermath: 'Restore 2 Light Strength and draw 2 cards.' },
        { id: 'p21', name: 'Restored Hope', threat: 2, req: ['RESILIENCE'], reward: 0, aftermath: 'Draw 3 cards.' },
        { id: 'p22', name: 'Guiding Star', threat: 1, req: ['FOCUS'], reward: 1, aftermath: 'No special effect.' },
        { id: 'p23', name: 'Good Fortune', threat: 1, req: ['PREPARATION'], reward: 1, aftermath: 'Restore 1 Light Strength.' },
        { id: 'p24', name: 'Renewal', threat: 2, req: ['MAINTENANCE'], reward: 1, aftermath: 'Restore 1 Light Strength and draw 1 card.' },
        { id: 'p25', name: 'Serenity', threat: 2, req: ['FOCUS', 'RESILIENCE'], reward: 0, aftermath: 'Draw 2 cards.' },
        { id: 'p26', name: 'Promising Dawn', threat: 2, req: ['MAINTENANCE', 'PREPARATION'], reward: 2, aftermath: 'Restore 2 Light Strength.' },
        { id: 'p27', name: 'Steady Hand', threat: 1, req: ['MAINTENANCE'], reward: 0, aftermath: 'Draw 1 card.' },
        { id: 'p28', name: 'A Helping Hand', threat: 1, req: ['RESILIENCE'], reward: 1, aftermath: 'Restore 1 Light Strength.' },
        { id: 'p29', name: 'Perfect Calm', threat: 2, req: ['FOCUS', 'PREPARATION'], reward: 2, aftermath: 'No special effect.' },
        { id: 'p30', name: 'The Storm Passes', threat: 3, req: ['MAINTENANCE', 'PREPARATION', 'RESILIENCE'], reward: 0, aftermath: 'Draw 4 cards.' },
    ];


    // --- GAME VARIABLES ---
    let lightStrength;
    let actionDeck, stormDeck, playerHand, actionDiscard, stormDiscard;
    let activeStormCard;
    let selectedCards = [];

    // --- DOM ELEMENTS ---
    const lightStrengthEl = document.getElementById('light-strength');
    const playerHandEl = document.getElementById('player-hand');
    const stormDeckCounterEl = document.getElementById('storm-deck-counter');
    const actionDeckCounterEl = document.getElementById('action-deck-counter');
    const activeStormCardSlotEl = document.getElementById('active-storm-card-slot');
    const playButton = document.getElementById('play-button');
    const passButton = document.getElementById('pass-button');
    
    // Modals
    const rulesButton = document.getElementById('rules-button');
    const rulesModal = document.getElementById('rules-modal');
    const gameOverModal = document.getElementById('game-over-modal');
    const closeModalButton = document.querySelector('.close-button');
    const restartButton = document.getElementById('restart-button');

    // --- FUNCTIONS ---

    function createFullDecks() {
        actionDeck = [];
        // Create a balanced deck of 40 cards
        for(let i=0; i<5; i++) {
            actionDeck.push({...actionCardData['fill-oil'], id: `ao${i}`});
            actionDeck.push({...actionCardData['clean-lens'], id: `al${i}`});
            actionDeck.push({...actionCardData['repair'], id: `ar${i}`});
            actionDeck.push({...actionCardData['secure-hatches'], id: `asl${i}`});
            actionDeck.push({...actionCardData['tighten-guy-ropes'], id: `asb${i}`});
            actionDeck.push({...actionCardData['concentration'], id: `ak${i}`});
            actionDeck.push({...actionCardData['momentary-stillness'], id: `aos${i}`});
            actionDeck.push({...actionCardData['stand-against'], id: `asi${i}`});
        }
    }
    
    function shuffle(deck) {
        for (let i = deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [deck[i], deck[j]] = [deck[j], deck[i]];
        }
    }

    function initGame() {
        lightStrength = 10;
        playerHand = [];
        actionDiscard = [];
        stormDiscard = [];
        selectedCards = [];
        activeStormCard = null;
        
        createFullDecks();
        shuffle(actionDeck);
        
        // Select a random set of 20 storm cards
        shuffle(stormCardData);
        stormDeck = stormCardData.slice(0, 20);

        for(let i=0; i<5; i++) {
            drawActionCard();
        }

        gameOverModal.classList.add('hidden');
        updateUI();
        renderPlayerHand();
        drawStormCard();
    }

    function drawActionCard(count = 1) {
        for(let i=0; i<count; i++) {
            if (actionDeck.length === 0) {
                if (actionDiscard.length === 0) {
                    console.log("No more action cards!");
                    return; 
                }
                actionDeck = [...actionDiscard];
                actionDiscard = [];
                shuffle(actionDeck);
            }
            playerHand.push(actionDeck.pop());
        }
    }

    function drawStormCard() {
        if (stormDeck.length === 0) {
            endGame(true); // Victory!
            return;
        }
        activeStormCard = stormDeck.pop();
        renderActiveStormCard();
        updateUI();
    }

    function renderCard(cardData) {
        const cardEl = document.createElement('div');
        if (cardData.req !== undefined) { // Storm Card
            cardEl.className = 'card storm-card';
            let threatDescription = `<strong>Threat:</strong> Lose ${cardData.threat} Light Strength`;
            let rewardDescription = `<strong>Reward:</strong> Gain ${cardData.reward} Light Strength`;
            
            // Only show reward if it exists
            const rewardHtml = cardData.reward !== undefined ? `<div class="reward">${rewardDescription}</div>` : '';
            
            cardEl.innerHTML = `
                <div class="card-title">${cardData.name}</div>
                <div class="card-description">
                    <div class="threat">${threatDescription}</div>
                    <div class="requirement"><strong>Requirement:</strong> ${cardData.req.join(', ') || 'None'}</div>
                    ${rewardHtml}
                    <div class="aftermath"><strong>Aftermath:</strong> ${cardData.aftermath}</div>
                </div>`;

        } else { // Action Card
            cardEl.className = 'card action-card';
            cardEl.dataset.cardId = cardData.id;
            cardEl.dataset.type = cardData.type;
            cardEl.innerHTML = `
                <div class="card-title">${cardData.name}</div>
                <div class="card-description"></div>
                <div class="card-type-banner">${cardData.type}</div>`;
            cardEl.addEventListener('click', () => selectCard(cardEl, cardData));
        }
        return cardEl;
    }

    function renderPlayerHand() {
        playerHandEl.innerHTML = '';
        playerHand.forEach(card => {
            const cardEl = renderCard(card);
            playerHandEl.appendChild(cardEl);
        });
    }
    
    function renderActiveStormCard() {
        activeStormCardSlotEl.innerHTML = '';
        if (activeStormCard) {
            activeStormCardSlotEl.appendChild(renderCard(activeStormCard));
        }
    }

    function updateUI() {
        lightStrengthEl.textContent = lightStrength;
        stormDeckCounterEl.textContent = stormDeck.length;
        actionDeckCounterEl.textContent = actionDeck.length;
        if(lightStrength <= 3) {
            lightStrengthEl.style.color = '#e74c3c';
        } else {
            lightStrengthEl.style.color = 'white';
        }
    }

    function selectCard(cardEl, cardData) {
        const index = selectedCards.findIndex(c => c.id === cardData.id);
        if (index > -1) {
            selectedCards.splice(index, 1);
            cardEl.classList.remove('selected');
        } else {
            selectedCards.push(cardData);
            cardEl.classList.add('selected');
        }
    }
    
    function resolveTurn(didPlayCards) {
        if (!activeStormCard) return;

        let success = false;
        if (didPlayCards) {
            const playedTypes = selectedCards.map(c => c.type).sort();
            const requiredTypes = [...activeStormCard.req].sort();
            
            if (playedTypes.length >= requiredTypes.length) {
                const tempPlayed = [...playedTypes];
                success = requiredTypes.every(reqType => {
                    const index = tempPlayed.findIndex(playedType => playedType === reqType);
                    if (index > -1) {
                        tempPlayed.splice(index, 1);
                        return true;
                    }
                    return false;
                });
            }
        }

        // 1. Handle Threat or Reward
        if (success) {
            if (activeStormCard.reward !== undefined) {
                 lightStrength += activeStormCard.reward;
            }
        } else {
            lightStrength -= activeStormCard.threat;
        }

        // 2. Handle Aftermath
        handleAftermath(activeStormCard.id);

        // 3. Clean up
        if (didPlayCards) {
            selectedCards.forEach(card => {
                const handIndex = playerHand.findIndex(c => c.id === card.id);
                if (handIndex > -1) {
                    actionDiscard.push(playerHand.splice(handIndex, 1)[0]);
                }
            });
            selectedCards = [];
        }
        stormDiscard.push(activeStormCard);
        activeStormCard = null;
        
        // 4. Draw new cards
        const cardsToDraw = 5 - playerHand.length;
        if (cardsToDraw > 0) {
            drawActionCard(cardsToDraw);
        }

        // 5. Update game and check status
        updateUI();
        renderPlayerHand();
        renderActiveStormCard();

        if (lightStrength <= 0) {
            endGame(false);
            return;
        }

        setTimeout(drawStormCard, 1000);
    }

    function handleAftermath(stormCardId) {
        switch(stormCardId) {
            case 's1': case 's5': case 's10': case 's13': case 's16': case 's19': case 's22': case 's27': case 's28': case 's34': case 's38': case 's43': case 's49': case 's65': case 's66': case 's70': case 's72':
                if (playerHand.length > 0) actionDiscard.push(playerHand.pop());
                break;
            case 's3': case 's12': case 's20': case 's30': case 's39': case 's48': case 's55': case 's62':
                if (actionDeck.length > 0) actionDiscard.push(actionDeck.pop());
                break;
            case 's11': case 's14': case 's32': case 's45': case 's52': case 's67':
                for(let i=0; i<2; i++) if (playerHand.length > 0) actionDiscard.push(playerHand.pop());
                break;
            case 's17': case 's23': case 's41': case 's50': case 's54':
                lightStrength -= 1;
                break;
            case 's25':
                for(let i=0; i<3; i++) if (playerHand.length > 0) actionDiscard.push(playerHand.pop());
                break;
            case 's8': case 's36': case 's68':
                // Not implemented. Requires state management for card types.
                break;
            case 'p3': case 'p11': case 'p15': case 'p21': case 'p25': case 'p30':
                drawActionCard(2);
                break;
            case 'p6': case 'p12': case 'p17': case 'p24':
                drawActionCard(1);
                break;
            case 'p5': case 'p15': case 'p21':
                 drawActionCard(3);
                 break;
            case 'p9': case 'p27':
                 drawActionCard(1);
                 break;
            case 'p20':
                 drawActionCard(2);
                 break;
        }
        // Ensure light strength doesn't exceed the max
        if (lightStrength > 10) lightStrength = 10;
    }
    
    function endGame(isWin) {
        const title = document.getElementById('game-over-title');
        const message = document.getElementById('game-over-message');
        if (isWin) {
            title.textContent = "You survived the storm!";
            message.textContent = "The light is safe, and dawn is breaking. Well done, Lighthouse Keeper!";
        } else {
            title.textContent = "The light has gone out...";
            message.textContent = "The storm was too mighty. Darkness has won this time.";
        }
        gameOverModal.classList.remove('hidden');
    }

    // --- EVENT LISTENERS ---
    playButton.addEventListener('click', () => resolveTurn(true));
    passButton.addEventListener('click', () => resolveTurn(false));
    
    rulesButton.addEventListener('click', () => rulesModal.classList.remove('hidden'));
    closeModalButton.addEventListener('click', () => rulesModal.classList.add('hidden'));
    rulesModal.addEventListener('click', (e) => {
        if(e.target === rulesModal) rulesModal.classList.add('hidden');
    });
    restartButton.addEventListener('click', initGame);

    // --- START GAME ---
    initGame();
});