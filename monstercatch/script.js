/*
  Monster Catch Duel logic.
  Players compete to replicate a sequence of directional inputs as quickly and
  accurately as possible. Player 1 uses the arrow keys (↑ ← ↓ →) and Player 2
  uses WASD. A round begins with a short countdown; the full sequence is
  revealed only after the countdown completes. The sequence length is
  randomly chosen between 3 and 10 steps. When a player presses an
  incorrect key, their input is temporarily locked for 0.5 seconds to
  discourage spamming, but their progress is maintained. Visual feedback is
  provided for countdown, wrong input and catching the monster.
*/

// Mapping keys to directions for each player
// Player 1 uses WASD, Player 2 uses Arrow keys, Player 3 uses TFGH,
// Player 4 uses IJKL. Keys for alphabetic players are stored in
// lower‑case to simplify comparisons.
const playerMappings = {
  1: {
    w: 'up',
    a: 'left',
    s: 'down',
    d: 'right'
  },
  2: {
    ArrowUp: 'up',
    ArrowDown: 'down',
    ArrowLeft: 'left',
    ArrowRight: 'right'
  },
  3: {
    t: 'up',
    f: 'left',
    g: 'down',
    h: 'right'
  },
  4: {
    i: 'up',
    j: 'left',
    k: 'down',
    l: 'right'
  }
};

// Unicode arrows for displaying the sequence
const arrowIcons = {
  up: '↑',
  down: '↓',
  left: '←',
  right: '→'
};

// State variables
let sequence = [];
// Tracks each player's current position within the sequence
let progress = { 1: 0, 2: 0, 3: 0, 4: 0 };
// Scoreboard counters
let score1 = 0;
let score2 = 0;
let score3 = 0;
let score4 = 0;
// Match configuration
let numPlayers = 4;
let targetPoints = 3;
let difficulty = 'easy';
// Flags for inverted directions on hard difficulty; generated alongside the sequence
let invertFlags = [];
// Flag indicating whether the match has ended (someone reached target points)
let matchOver = false;
// Round state flags
let started = false;
let roundStartTime = 0;
let keyListener = null;
// Countdown state for the start of each round
let countdownSeconds = 0;
let countdownInterval = null;
// Lock state per player to prevent spamming after a wrong key
let locked = { 1: false, 2: false, 3: false, 4: false };

// --- NYE VARIABLER FOR RASKESTE TID ---
const FASTEST_TIME_KEY = 'monsterCatchDuel_fastestTime'; // Nøkkel for localStorage
let fastestTime = null; // Holder på raskeste tid { time: 1.23, name: 'Spiller' }
// --- SLUTT PÅ NYE VARIABLER ---

// DOM elements
const score1El = document.getElementById('score1');
const score2El = document.getElementById('score2');
const score3El = document.getElementById('score3');
const score4El = document.getElementById('score4');
const messageEl = document.getElementById('message');
const sequenceDisplay = document.getElementById('sequenceDisplay');
const progress1El = document.getElementById('progress1');
const progress2El = document.getElementById('progress2');
const progress3El = document.getElementById('progress3');
const progress4El = document.getElementById('progress4');
const historyEl = document.getElementById('history');
const startBtn = document.getElementById('startBtn');
const resetBtn = document.getElementById('resetBtn');

// --- NYTT DOM-ELEMENT ---
const fastestTimeEl = document.getElementById('fastestTime');
// --- SLUTT PÅ NYTT ELEMENT ---

// Info line explaining inverted steps; toggled based on difficulty
const invertInfo = document.getElementById('invertInfo');
// Elements for displaying player names on the scoreboard
const nameDisplays = {
  1: document.getElementById('nameDisplay1'),
  2: document.getElementById('nameDisplay2'),
  3: document.getElementById('nameDisplay3'),
  4: document.getElementById('nameDisplay4')
};
// Player card elements for showing/hiding based on selected number of players
const playerCards = {
  1: document.getElementById('playerCard1'),
  2: document.getElementById('playerCard2'),
  3: document.getElementById('playerCard3'),
  4: document.getElementById('playerCard4')
};

// Start screen elements
const startScreen = document.getElementById('startScreen');
const gameContainer = document.querySelector('.game-container');
const numPlayersSelect = document.getElementById('numPlayers');
const pointsToWinInput = document.getElementById('pointsToWin');
const difficultySelect = document.getElementById('difficulty');
const startGameBtn = document.getElementById('startGameBtn');
const backBtn = document.getElementById('backBtn');
// Name inputs on start screen
const startNameInputs = {
  1: document.getElementById('startName1'),
  2: document.getElementById('startName2'),
  3: document.getElementById('startName3'),
  4: document.getElementById('startName4')
};

// Pokéball element for animations
const pokeballEl = document.querySelector('.pokeball');
// Monster image element; this will display a random Pokémon each round
const monsterImgEl = document.getElementById('monsterImg');

// Player names populated from inputs before each round. Defaults will be
// assigned if the input is empty. This is used when displaying messages
// and history entries.
let playerNames = { 1: 'Player 1', 2: 'Player 2', 3: 'Player 3', 4: 'Player 4' };

/**
 * Show or hide name input fields on the start screen based on the
 * currently selected number of players. Only the first N inputs will
 * be visible, where N is the number of players selected. This
 * improves clarity when setting up games with fewer than four
 * participants.
 */
function updateNameFields() {
  const selected = parseInt(numPlayersSelect.value, 10) || 1;
  for (let i = 1; i <= 4; i++) {
    const inputEl = startNameInputs[i];
    if (i <= selected) {
      inputEl.style.display = '';
    } else {
      inputEl.style.display = 'none';
    }
  }
}

/**
 * Fetch a random Pokémon name using the public PokéAPI. Names returned
 * from the API are all lower‑case; this helper capitalises the first
 * letter. If the fetch fails for any reason (e.g. network error or
 * API downtime), a generic fallback name is returned. Using the
 * species endpoint would provide translated names, but the standard
 * Pokémon endpoint suffices here and avoids the need for another
 * request.
 *
 * @returns {Promise<string>} A capitalised Pokémon name or a fallback.
 */
async function fetchRandomPokemonName() {
  // There are over 1000 species; pick a random index in a safe range.
  const maxId = 1010;
  const id = Math.floor(Math.random() * maxId) + 1;
  try {
    const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`);
    if (!response.ok) throw new Error('API error');
    const data = await response.json();
    let name = data.name || 'Trainer';
    // Capitalise the first letter
    return name.charAt(0).toUpperCase() + name.slice(1);
  } catch (err) {
    // Fallback to a generic trainer name if the API is unreachable
    return 'Trainer';
  }
}

/**
 * Initialise a new match based on user selections from the start screen.
 * This function reads the number of players, target points and
 * difficulty settings, assigns names (either from user input or random
 * Pokémon names when left blank), resets the game state, hides the
 * start screen and reveals the main game interface. It also ensures
 * that only the selected number of players and corresponding progress
 * bars are visible on the scoreboard.
 */
async function startGame() {
  // Parse configuration from the start screen
  numPlayers = parseInt(numPlayersSelect.value, 10) || 1;
  targetPoints = parseInt(pointsToWinInput.value, 10) || 3;
  // Constrain target points between 1 and 99 to avoid invalid values
  if (targetPoints < 1) targetPoints = 1;
  if (targetPoints > 99) targetPoints = 99;
  difficulty = difficultySelect.value || 'easy';
  matchOver = false;
  // Build the player names object. For players beyond numPlayers,
  // assign a default placeholder name; these entries will be hidden.
  playerNames = {};
  for (let i = 1; i <= 4; i++) {
    if (i <= numPlayers) {
      const nameInput = (startNameInputs[i].value || '').trim();
      if (nameInput) {
        playerNames[i] = nameInput;
      } else {
        // Await a random Pokémon name if no name was entered
        playerNames[i] = await fetchRandomPokemonName();
      }
    } else {
      // Assign a default name to hidden players
      playerNames[i] = `Player ${i}`;
    }
  }
  // Update scoreboard name displays and show/hide player cards and progress bars
  for (let i = 1; i <= 4; i++) {
    nameDisplays[i].textContent = playerNames[i];
    const cardEl = playerCards[i];
    const progEl = document.getElementById(`progress${i}`);
    if (i <= numPlayers) {
      cardEl.classList.remove('hidden');
      progEl.classList.remove('hidden');
    } else {
      cardEl.classList.add('hidden');
      progEl.classList.add('hidden');
    }
  }
  // Reset scores, progress and messages before starting a new match
  resetGame();
  // Show invert info only on hard difficulty
  if (invertInfo) {
    invertInfo.style.display = (difficulty === 'hard') ? 'block' : 'none';
  }
  // Hide the start screen and show the game container
  startScreen.style.display = 'none';
  gameContainer.classList.add('active');
  // Ensure control buttons are in the correct state
  startBtn.style.display = '';
  resetBtn.style.display = '';
  // Show the Back to Start button during gameplay so players can
  // return to the configuration screen at any time
  backBtn.style.display = '';
}

/**
 * Return to the start screen after a match concludes. This function
 * resets the game state, hides the game interface and reveals the
 * start screen again. It does not clear the values in the start
 * screen inputs, allowing users to quickly play another match with
 * the same configuration if desired.
 */
function returnToStart() {
  // Reset game state and scoreboard
  resetGame();
  matchOver = false;
  // Hide the game container and show the start screen
  gameContainer.classList.remove('active');
  startScreen.style.display = 'block';
  // Reset visibility of control buttons on the start screen
  startBtn.style.display = '';
  resetBtn.style.display = '';
  backBtn.style.display = 'none';
}

/**
 * Load a random Pokémon sprite into the monster image element. This
 * function chooses a random Pokédex ID and sets the image source to
 * the corresponding official artwork hosted on GitHub. If the image
 * fails to load (e.g. due to an invalid ID or network error), the
 * fallback silhouette is used instead. This keeps gameplay smooth
 * even if external resources are unavailable.
 */
function loadRandomPokemon() {
  // There are over 1000 Pokémon as of late 2025; pick a random ID in a safe range.
  const maxId = 1010;
  const id = Math.floor(Math.random() * maxId) + 1;
  // Directly reference the official artwork sprite. This avoids a JSON API
  // request and sidesteps CORS restrictions.
  monsterImgEl.src = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;
  // If the sprite fails to load, revert to the default silhouette
  monsterImgEl.onerror = () => {
    monsterImgEl.src = 'monster.png';
    // remove the error handler to avoid infinite loops if the fallback also fails
    monsterImgEl.onerror = null;
  };
}

// Generate a random sequence of directions. The length is randomly
// chosen between 3 and 10 (inclusive) and each step is one of four
// possible directions. This randomness gives the game replay value.
function generateSequence() {
  const directions = ['up', 'down', 'left', 'right'];
  let minLength;
  let maxLength;
  // Determine sequence length based on difficulty
  if (difficulty === 'easy') {
    minLength = 3;
    maxLength = 5;
  } else if (difficulty === 'medium') {
    minLength = 5;
    maxLength = 10;
  } else {
    // hard difficulty uses same length range as medium
    minLength = 5;
    maxLength = 10;
  }
  const length = Math.floor(Math.random() * (maxLength - minLength + 1)) + minLength;
  const seq = [];
  invertFlags = [];
  for (let i = 0; i < length; i++) {
    const dir = directions[Math.floor(Math.random() * directions.length)];
    seq.push(dir);
    // For hard difficulty, randomly invert some steps
    if (difficulty === 'hard') {
      // 50% chance to invert each step
      invertFlags.push(Math.random() < 0.5);
    } else {
      invertFlags.push(false);
    }
  }
  return seq;
}

// Render the sequence on screen
function renderSequence() {
  sequenceDisplay.innerHTML = '';
  sequence.forEach((dir, index) => {
    const stepEl = document.createElement('div');
    stepEl.className = 'sequence-step';
    stepEl.textContent = arrowIcons[dir];
    // Highlight inverted steps in hard difficulty
    if (invertFlags[index]) {
      stepEl.classList.add('invert');
    }
    sequenceDisplay.appendChild(stepEl);
  });
}

// Render progress bars for each player
function renderProgress() {
  // Helper to create progress steps
  function createProgressSteps(container, currentProgress, playerClass) {
    container.innerHTML = '';
    for (let i = 0; i < sequence.length; i++) {
      const stepBox = document.createElement('div');
      stepBox.className = 'progress-step';
      if (i < currentProgress) {
        // Mark as filled
        stepBox.classList.add('active', playerClass);
      }
      container.appendChild(stepBox);
    }
  }
  createProgressSteps(progress1El, progress[1], 'player1');
  createProgressSteps(progress2El, progress[2], 'player2');
  createProgressSteps(progress3El, progress[3], 'player3');
  createProgressSteps(progress4El, progress[4], 'player4');
}

// Update the scoreboard display
function updateScores() {
  score1El.textContent = score1;
  score2El.textContent = score2;
  score3El.textContent = score3;
  score4El.textContent = score4;
}

// Provide visual feedback when a player presses a wrong key. The
// corresponding progress bar shakes briefly to indicate an error.
function flashWrong(player) {
  let progressEl;
  switch (player) {
    case 1:
      progressEl = progress1El;
      break;
    case 2:
      progressEl = progress2El;
      break;
    case 3:
      progressEl = progress3El;
      break;
    case 4:
      progressEl = progress4El;
      break;
    default:
      return;
  }
  // Add the 'wrong' class to trigger the shake animation defined in CSS
  progressEl.classList.add('wrong');
  // Remove the class after the animation completes (~400ms)
  setTimeout(() => {
    progressEl.classList.remove('wrong');
  }, 400);
}


// --- NYE FUNKSJONER FOR RASKESTE TID ---
/**
 * Viser den raskeste reaksjonstiden på skjermen.
 */
function updateFastestTimeDisplay() {
  if (fastestTime) {
    fastestTimeEl.textContent = `Fastest reaction time: ${fastestTime.time.toFixed(2)}s (${fastestTime.name})`;
  } else {
    fastestTimeEl.textContent = 'No fastest reaction time yet';
  }
}

/**
 * Henter den lagrede raskeste tiden fra localStorage når siden lastes.
 */
function loadFastestTime() {
  const storedTime = localStorage.getItem(FASTEST_TIME_KEY);
  if (storedTime) {
    try {
      fastestTime = JSON.parse(storedTime);
    } catch (e) {
      console.error('Could not fetch reaction time from localstorage:', e);
      fastestTime = null;
    }
  }
  updateFastestTimeDisplay();
}
// --- SLUTT PÅ NYE FUNKSJONER ---


// Start a new round
function startRound() {
  if (started) return;
  started = true;
  // Do not start a new round if a match has already been won
  if (matchOver) return;
  // Load a random Pokémon sprite for this round
  loadRandomPokemon();
  // Generate a new sequence and reset progress
  sequence = generateSequence();
  progress[1] = 0;
  progress[2] = 0;
  progress[3] = 0;
  progress[4] = 0;
  renderSequence();
  renderProgress();
  // Hide sequence and progress indicators until countdown completes
  sequenceDisplay.style.visibility = 'hidden';
  progress1El.style.visibility = 'hidden';
  progress2El.style.visibility = 'hidden';
  progress3El.style.visibility = 'hidden';
  progress4El.style.visibility = 'hidden';
  // Initialise countdown
  countdownSeconds = 3;
  messageEl.textContent = countdownSeconds;
  // Start pulsing animation on the Poké Ball
  pokeballEl.classList.add('countdown');
  // Clear any existing countdown
  if (countdownInterval) {
    clearInterval(countdownInterval);
  }
  countdownInterval = setInterval(() => {
    countdownSeconds--;
    if (countdownSeconds > 0) {
      messageEl.textContent = countdownSeconds;
    } else {
      clearInterval(countdownInterval);
      pokeballEl.classList.remove('countdown');
      showSequenceAndStart();
    }
  }, 1000);
}

// Reveal the sequence after countdown and begin listening for input
function showSequenceAndStart() {
  // Show the sequence and progress indicators
  sequenceDisplay.style.visibility = 'visible';
  progress1El.style.visibility = 'visible';
  progress2El.style.visibility = 'visible';
  progress3El.style.visibility = 'visible';
  progress4El.style.visibility = 'visible';
  // Update message
  messageEl.textContent = 'Go! Replicate the sequence!';
  // Record start time for scoring
  roundStartTime = Date.now();
  // Attach key listener
  keyListener = handleKeyPress;
  document.addEventListener('keydown', keyListener);
}

// Handle key presses
function handleKeyPress(event) {
  if (!started) return;
  const rawKey = event.key;
  // Normalise key: for single characters use lower case, otherwise use as is
  const keyNorm = rawKey.length === 1 ? rawKey.toLowerCase() : rawKey;
  // Determine which player this key belongs to by checking mappings
  let player = null;
  for (let i = 1; i <= 4; i++) {
    if (playerMappings[i][keyNorm] !== undefined) {
      player = i;
      break;
    }
  }
  if (!player) {
    return; // key does not belong to any player
  }
  // Ignore input from players beyond the configured number
  if (player > numPlayers) {
    return;
  }
  // Ignore input if the player is temporarily locked due to a wrong press
  if (locked[player]) {
    return;
  }
  // Map key to direction using the normalised key
  const dir = playerMappings[player][keyNorm];
  // Check against sequence
  // Determine the expected direction, taking into account inversion flags
  const stepIndex = progress[player];
  let expectedDir = sequence[stepIndex];
  if (invertFlags[stepIndex]) {
    // Invert the direction: up <-> down, left <-> right
    const opposite = { up: 'down', down: 'up', left: 'right', right: 'left' };
    expectedDir = opposite[expectedDir];
  }
  if (dir === expectedDir) {
    // Correct step
    progress[player]++;
    renderProgress();
    // Check completion
    if (progress[player] >= sequence.length) {
      endRound(player);
    }
  } else {
    // Wrong key: temporarily lock this player's input to prevent spamming
    locked[player] = true;
    // Visual feedback for wrong input
    flashWrong(player);
    messageEl.textContent = `${playerNames[player]} pressed the wrong key!`;
    setTimeout(() => {
      locked[player] = false;
      // Only reset message if the round is still active
      if (started) {
        messageEl.textContent = 'Go! Replicate the sequence!';
      }
    }, 500);
  }
}

// --- OPPDATERT endRound-FUNKSJON ---
// End round, declare winner
function endRound(winner) {
  if (!started) return;
  started = false;
  // Remove key listener
  document.removeEventListener('keydown', keyListener);

  const timeTaken = (Date.now() - roundStartTime) / 1000;

  // Sjekk om tiden er en ny rekord
  if (!fastestTime || timeTaken < fastestTime.time) {
    fastestTime = { time: timeTaken, name: playerNames[winner] };
    localStorage.setItem(FASTEST_TIME_KEY, JSON.stringify(fastestTime));
    updateFastestTimeDisplay();
    messageEl.textContent = `${playerNames[winner]} fanget Pokémonen med NY REKORD! Tid: ${timeTaken.toFixed(2)}s`;
  } else {
    messageEl.textContent = `${playerNames[winner]} fanget Pokémonen! Tid: ${timeTaken.toFixed(2)}s`;
  }

  // Update score for the winner
  switch (winner) {
    case 1:
      score1++;
      break;
    case 2:
      score2++;
      break;
    case 3:
      score3++;
      break;
    case 4:
      score4++;
      break;
  }
  updateScores();

  // Log history entry with player name
  const entry = document.createElement('div');
  entry.textContent = `Round: ${playerNames[winner]} finished the sequence in ${timeTaken.toFixed(2)}s.`;
  historyEl.prepend(entry);

  // Trigger Poké Ball catch animation
  pokeballEl.classList.add('caught');
  setTimeout(() => {
    pokeballEl.classList.remove('caught');
  }, 600);

  // Check if this player has reached the target points and won the match
  let winnerScore;
  switch (winner) {
    case 1:
      winnerScore = score1;
      break;
    case 2:
      winnerScore = score2;
      break;
    case 3:
      winnerScore = score3;
      break;
    case 4:
      winnerScore = score4;
      break;
    default:
      winnerScore = 0;
  }
  if (winnerScore >= targetPoints) {
    // End the match and display the final winner
    matchOver = true;
    // Hide the start and reset buttons to prevent further rounds
    startBtn.style.display = 'none';
    resetBtn.style.display = 'none';
    backBtn.style.display = '';
    messageEl.textContent = `${playerNames[winner]} wins the match!`;
    return;
  }
}
// --- SLUTT PÅ OPPDATERT FUNKSJON ---

// Reset the game state
function resetGame() {
  // Clean up listener
  if (keyListener) {
    document.removeEventListener('keydown', keyListener);
  }
  started = false;
  sequence = [];
  progress[1] = 0;
  progress[2] = 0;
  progress[3] = 0;
  progress[4] = 0;
  score1 = 0;
  score2 = 0;
  score3 = 0;
  score4 = 0;
  updateScores();
  sequenceDisplay.innerHTML = '';
  progress1El.innerHTML = '';
  progress2El.innerHTML = '';
  progress3El.innerHTML = '';
  progress4El.innerHTML = '';
  messageEl.textContent = 'Press “Start Round” to begin.';
  historyEl.innerHTML = '';
  // Clear countdown and remove animations
  if (countdownInterval) {
    clearInterval(countdownInterval);
  }
  pokeballEl.classList.remove('countdown');
  pokeballEl.classList.remove('caught');
  // Reset lock state
  for (let i = 1; i <= 4; i++) {
    locked[i] = false;
  }
  // Reset monster image to a Poké Ball sprite instead of the default silhouette
  monsterImgEl.src = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/poke-ball.png';
}

// Event listeners for buttons
startBtn.addEventListener('click', startRound);
resetBtn.addEventListener('click', resetGame);

// Start screen button to begin a new match
startGameBtn.addEventListener('click', () => {
  // Disable the start button temporarily to prevent double clicks
  startGameBtn.disabled = true;
  // Call the async startGame and then re-enable the button
  startGame().finally(() => {
    startGameBtn.disabled = false;
  });
});

// Back to start button shown after a match concludes
backBtn.addEventListener('click', returnToStart);

// Update name fields when the number of players selection changes
numPlayersSelect.addEventListener('change', updateNameFields);

// Initialise the name fields to match the default selection on page load
updateNameFields();

// Dark mode toggle
const darkModeToggle = document.getElementById('darkModeToggle');
darkModeToggle.addEventListener('click', () => {
  document.body.classList.toggle('dark-mode');
  // Swap the icon: sun in dark mode, moon in light mode
  if (document.body.classList.contains('dark-mode')) {
    darkModeToggle.textContent = '☀️';
  } else {
    darkModeToggle.textContent = '🌙';
  }
});

// --- Kode lagt til for å sette mørk modus som standard ---

// Funksjon for å aktivere mørk modus basert på systeminnstillinger
function applyInitialTheme() {
  // Sjekker om brukerens system foretrekker mørk fargepalett
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    // Hvis ja, legg til 'dark-mode' klassen til <body>-elementet
    document.body.classList.add('dark-mode');
    // Oppdater ikonet på knappen for å vise solen
    const darkModeToggle = document.getElementById('darkModeToggle');
    if (darkModeToggle) {
      darkModeToggle.textContent = '☀️';
    }
  }
}

// Kall funksjonen for å sette temaet når siden lastes
applyInitialTheme();

// --- NYTT FUNKSJONSKALL FOR Å LASTE RASKESTE TID ---
loadFastestTime();
// --- SLUTT PÅ NYTT FUNKSJONSKALL ---
