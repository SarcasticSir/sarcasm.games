// Pokémon True or False game logic.
// This game asks players to determine whether randomly generated
// statements about Pokémon are true or false. Players can choose
// which generations of Pokémon to draw from and how many questions
// they want to answer. The app fetches data from the PokéAPI and
// occasionally fabricates false statements to keep things
// unpredictable.

(function () {
  // DOM elements
  const startScreen = document.getElementById('startScreen');
  const gameScreen = document.getElementById('gameScreen');
  const endScreen = document.getElementById('endScreen');
  const generationSelection = document.getElementById('generationSelection');
  const numQuestionsInput = document.getElementById('numQuestions');
  const startGameBtn = document.getElementById('startGameBtn');
  const trueBtn = document.getElementById('trueBtn');
  const falseBtn = document.getElementById('falseBtn');
  const newGameBtn = document.getElementById('newGameBtn');
  const darkModeToggle = document.getElementById('darkModeToggle');
  const questionCountEl = document.getElementById('questionCount');
  const scoreDisplayEl = document.getElementById('scoreDisplay');
  const pokemonImageEl = document.getElementById('pokemonImage');
  const pokemonNameEl = document.getElementById('pokemonName');
  const statementEl = document.getElementById('statement');
  const feedbackEl = document.getElementById('feedback');
  const finalMessageEl = document.getElementById('finalMessage');

  // Game state
  let selectedGenerations = [];
  let speciesList = [];
  let numQuestions = 5;
  let currentQuestion = 0;
  let score = 0;
  // Total points accumulated based on reaction time. Players receive up to
  // 1000 points for answers made within 1 second. The score decreases
  // linearly to zero if they take 10 seconds or more. See handleAnswer().
  let totalPoints = 0;
  let correctAnswer = true;
  let correctExplanation = '';

  // Timestamp when the current question was presented. Used for
  // calculating reaction‑time based points. Set in askNextQuestion().
  let questionStartTime = 0;

  // Preloaded data for the upcoming question. To improve perceived
  // responsiveness, we prepare the next question in the background
  // while the current question is being answered. When the next
  // question is requested, we consume this preloaded data rather
  // than waiting for network requests.
  let preloadedNext = null;

  // Track whether the player has already answered the current question
  // to prevent multiple clicks causing duplicate scoring.
  let answeredThisQuestion = false;

  // Cache for fetched generation species lists and Pokémon details
  const generationCache = {};
  const pokemonCache = {};

  // All Pokémon types for constructing false statements
  const allTypes = [
    'normal','fire','water','grass','electric','ice','fighting','poison','ground','flying',
    'psychic','bug','rock','ghost','dark','dragon','steel','fairy'
  ];

  // Map generation API names to Roman numerals for trivia questions
  const generationRomanMap = {
    'generation-i': 'I',
    'generation-ii': 'II',
    'generation-iii': 'III',
    'generation-iv': 'IV',
    'generation-v': 'V',
    'generation-vi': 'VI',
    'generation-vii': 'VII',
    'generation-viii': 'VIII',
    'generation-ix': 'IX'
  };

  // Cache for Pokémon species details (e.g., legendary status, habitat)
  const pokemonSpeciesCache = {};

  /**
   * Fetch a list of Pokémon species names introduced in a given generation.
   * Results are cached to avoid redundant network requests. Each returned
   * species name is a lowercase string.
   *
   * @param {number|string} genId The generation ID (1–9).
   * @returns {Promise<string[]>} An array of species names.
   */
  async function fetchSpeciesForGen(genId) {
    if (generationCache[genId]) {
      return generationCache[genId];
    }
    try {
      const res = await fetch(`https://pokeapi.co/api/v2/generation/${genId}/`);
      const data = await res.json();
      const species = data.pokemon_species.map(s => s.name);
      generationCache[genId] = species;
      return species;
    } catch (err) {
      console.error('Error fetching generation', genId, err);
      return [];
    }
  }

  /**
   * Fetch detailed data for a given Pokémon name. Information includes
   * base experience, height, weight, types and identifier. Results are
   * cached because the same Pokémon may appear in multiple questions.
   *
   * @param {string} name The Pokémon's species name (lowercase).
   * @returns {Promise<Object>} An object with id, name, base_experience,
   *                            height, weight and types array.
   */
  async function fetchPokemonDetails(name) {
    if (pokemonCache[name]) {
      return pokemonCache[name];
    }
    try {
      const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${name}`);
      const data = await res.json();
      const info = {
        id: data.id,
        name: data.name,
        base_experience: data.base_experience,
        height: data.height,
        weight: data.weight,
        types: data.types.map(t => t.type.name)
      };
      pokemonCache[name] = info;
      return info;
    } catch (err) {
      console.error('Error fetching Pokémon details', name, err);
      return null;
    }
  }

  /**
   * Fetch and cache species data for a given Pokémon. Returns null if fetch fails.
   * Species data provides additional trivia such as legendary status,
   * mythical status, habitat, shape, color and generation.
   *
   * @param {string} name The Pokémon's species name (lowercase).
   * @returns {Promise<Object|null>} Species data or null on failure
   */
  async function fetchSpeciesData(name) {
    if (pokemonSpeciesCache[name]) {
      return pokemonSpeciesCache[name];
    }
    try {
      // Need the Pokémon details to get the species URL
      const pokemon = await fetchPokemonDetails(name);
      if (!pokemon || !pokemon.name) return null;
      // Fetch species data via the species endpoint
      const res = await fetch(`https://pokeapi.co/api/v2/pokemon-species/${pokemon.name}`);
      const data = await res.json();
      pokemonSpeciesCache[name] = data;
      return data;
    } catch (err) {
      console.error('Error fetching species data', name, err);
      return null;
    }
  }

  /**
   * Capitalize the first letter of a string.
   *
   * @param {string} str
   */
  function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  /**
   * Generate a statement about a Pokémon. Depending on the category
   * selected, it may fabricate false information by tweaking numeric
   * values or picking an incorrect type. Returns the statement text,
   * whether the statement is true and an explanation string.
   *
   * @param {Object} pokemon The Pokémon details object.
   * @returns {{text: string, answer: boolean, explanation: string}}
   */
  function buildStatement(pokemon) {
    // Randomly choose one of several categories
    const categories = ['type', 'base_experience', 'height', 'weight', 'id'];
    const category = categories[Math.floor(Math.random() * categories.length)];
    const nameCap = capitalize(pokemon.name);
    let text;
    let answer;
    let explanation;

    switch (category) {
      case 'type': {
        // Choose a random actual type of the Pokémon (it may have one or two)
        const actualTypes = pokemon.types;
        const actualType = actualTypes[Math.floor(Math.random() * actualTypes.length)];
        // Decide whether to use a true or false type
        const useTrue = Math.random() < 0.5;
        let typeToUse;
        if (useTrue) {
          typeToUse = actualType;
          answer = true;
        } else {
          // Pick a random type that is not among the Pokémon's types
          const otherTypes = allTypes.filter(t => !actualTypes.includes(t));
          typeToUse = otherTypes[Math.floor(Math.random() * otherTypes.length)];
          answer = false;
        }
        text = `${nameCap} has ${capitalize(typeToUse)} type.`;
        explanation = `${nameCap} has ${actualTypes.map(capitalize).join(' and ')} type` + (actualTypes.length > 1 ? 's' : '') + '.';
        break;
      }
      case 'base_experience': {
        const actual = pokemon.base_experience;
        const useTrue = Math.random() < 0.5;
        let value = actual;
        if (!useTrue) {
          // Alter by ± between 10 and 50 to fabricate an incorrect base experience
          const delta = Math.floor(Math.random() * 41) + 10;
          value = Math.random() < 0.5 ? actual + delta : Math.max(1, actual - delta);
        }
        text = `${nameCap} has a base experience of ${value}.`;
        answer = (value === actual);
        explanation = `${nameCap} has a base experience of ${actual}.`;
        break;
      }
      case 'height': {
        // Height is in decimetres; convert to metres with one decimal
        const actualDecimetres = pokemon.height;
        const actualMetres = (actualDecimetres / 10).toFixed(1);
        const useTrue = Math.random() < 0.5;
        let valueMetres = actualMetres;
        if (!useTrue) {
          // Adjust height by ±0.1 to 0.5 m (i.e., ±1 to ±5 decimetres)
          const deltaDm = Math.floor(Math.random() * 5) + 1;
          const newDm = Math.random() < 0.5 ? actualDecimetres + deltaDm : Math.max(1, actualDecimetres - deltaDm);
          valueMetres = (newDm / 10).toFixed(1);
        }
        text = `${nameCap} has a height of ${valueMetres} m.`;
        answer = (valueMetres === actualMetres);
        explanation = `${nameCap}'s actual height is ${actualMetres} m.`;
        break;
      }
      case 'weight': {
        // Weight is in hectograms; convert to kilograms with one decimal
        const actualHg = pokemon.weight;
        const actualKg = (actualHg / 10).toFixed(1);
        const useTrue = Math.random() < 0.5;
        let valueKg = actualKg;
        if (!useTrue) {
          // Adjust weight by ±1 to ±5 kg (i.e., ±10 to ±50 hectograms)
          const deltaHg = (Math.floor(Math.random() * 5) + 1) * 10;
          const newHg = Math.random() < 0.5 ? actualHg + deltaHg : Math.max(1, actualHg - deltaHg);
          valueKg = (newHg / 10).toFixed(1);
        }
        text = `${nameCap} weighs ${valueKg} kg.`;
        answer = (valueKg === actualKg);
        explanation = `${nameCap}'s actual weight is ${actualKg} kg.`;
        break;
      }
      case 'id': {
        const actual = pokemon.id;
        const useTrue = Math.random() < 0.5;
        let value = actual;
        if (!useTrue) {
          // Alter id by ±1 to ±20 ensuring the new id is positive and not equal
          const delta = Math.floor(Math.random() * 20) + 1;
          value = Math.random() < 0.5 ? actual + delta : Math.max(1, actual - delta);
        }
        text = `${nameCap}'s Pokédex number is ${value}.`;
        answer = (value === actual);
        explanation = `${nameCap}'s Pokédex number is ${actual}.`;
        break;
      }
      default: {
        // Fallback to a true type statement if none of the above matched
        const actualTypes = pokemon.types;
        const actualType = actualTypes[0];
        text = `${nameCap} has ${capitalize(actualType)} type.`;
        answer = true;
        explanation = `${nameCap} has ${actualTypes.map(capitalize).join(' and ')} type.`;
      }
    }
    return { text, answer, explanation };
  }

  /**
   * Build a statement that may include trivia about legendary status,
   * mythical status, habitat, shape, color or generation. Falls back to
   * base categories when species data lacks certain properties.
   *
   * @param {Object} pokemon Pokémon details object
   * @param {Object} speciesData Pokémon species data
   * @returns {{text:string, answer:boolean, explanation:string}}
   */
  async function buildTriviaStatement(pokemon, speciesData) {
    // Always include base categories
    const baseCategories = ['type', 'base_experience', 'height', 'weight', 'id'];
    // Add trivia categories if data is present
    const triviaCats = [];
    if (speciesData) {
      if (typeof speciesData.is_legendary === 'boolean') triviaCats.push('legendary');
      if (typeof speciesData.is_mythical === 'boolean') triviaCats.push('mythical');
      // Exclude habitat and shape categories as per user request
      if (speciesData.color && speciesData.color.name) triviaCats.push('color');
      if (speciesData.generation && speciesData.generation.name) triviaCats.push('generation');
      if (speciesData.flavor_text_entries && speciesData.flavor_text_entries.length > 0) triviaCats.push('description');
    }
    // Always include name_match category, which doesn't rely on species data
    triviaCats.push('name_match');
    const categories = baseCategories.concat(triviaCats);
    // Randomly choose a category
    const category = categories[Math.floor(Math.random() * categories.length)];
    const nameCap = capitalize(pokemon.name);
    let text;
    let answer;
    let explanation;
    // Whether to hide the Pokémon name label for this question (used by name_match category)
    let hideName = false;
    switch (category) {
      case 'legendary': {
        const actual = speciesData.is_legendary;
        const useTrue = Math.random() < 0.5;
        const claim = useTrue ? actual : !actual;
        text = `${nameCap} is ${claim ? '' : 'not '}a Legendary Pokémon.`;
        answer = (claim === actual);
        explanation = `${nameCap} is ${actual ? '' : 'not '}a Legendary Pokémon.`;
        break;
      }
      case 'mythical': {
        const actual = speciesData.is_mythical;
        const useTrue = Math.random() < 0.5;
        const claim = useTrue ? actual : !actual;
        text = `${nameCap} is ${claim ? '' : 'not '}a Mythical Pokémon.`;
        answer = (claim === actual);
        explanation = `${nameCap} is ${actual ? '' : 'not '}a Mythical Pokémon.`;
        break;
      }
      case 'habitat': {
        const actualHabitat = speciesData.habitat ? speciesData.habitat.name : '';
        const habitats = ['cave','forest','grassland','mountain','rough-terrain','sea','urban','rare','waters-edge'];
        const useTrue = Math.random() < 0.5;
        let habitatToUse;
        if (useTrue) {
          habitatToUse = actualHabitat;
          answer = true;
        } else {
          const others = habitats.filter(h => h !== actualHabitat);
          habitatToUse = others[Math.floor(Math.random() * others.length)];
          answer = false;
        }
        const fmt = h => capitalize(h.replace(/-/g, ' '));
        text = `${nameCap}'s habitat is ${fmt(habitatToUse)}.`;
        explanation = speciesData.habitat
          ? `${nameCap}'s habitat is ${fmt(actualHabitat)}.`
          : `${nameCap} has no defined habitat.`;
        break;
      }
      case 'shape': {
        const actualShape = speciesData.shape ? speciesData.shape.name : '';
        const shapes = ['ball','squiggle','fish','arms','blob','upright','legs','quadruped','wings','tentacles','heads','humanoid','bug-wings','armor'];
        const useTrue = Math.random() < 0.5;
        let shapeToUse;
        if (useTrue) {
          shapeToUse = actualShape;
          answer = true;
        } else {
          const others = shapes.filter(s => s !== actualShape);
          shapeToUse = others[Math.floor(Math.random() * others.length)];
          answer = false;
        }
        const fmt = s => capitalize(s.replace(/-/g, ' '));
        text = `${nameCap}'s body shape is ${fmt(shapeToUse)}.`;
        explanation = speciesData.shape
          ? `${nameCap}'s body shape is ${fmt(actualShape)}.`
          : `${nameCap} has no defined shape.`;
        break;
      }
      case 'color': {
        const actualColor = speciesData.color ? speciesData.color.name : '';
        const colors = ['black','blue','brown','gray','green','pink','purple','red','white','yellow'];
        const useTrue = Math.random() < 0.5;
        let colorToUse;
        if (useTrue) {
          colorToUse = actualColor;
          answer = true;
        } else {
          const others = colors.filter(c => c !== actualColor);
          colorToUse = others[Math.floor(Math.random() * others.length)];
          answer = false;
        }
        text = `${nameCap} is primarily ${colorToUse}.`;
        explanation = speciesData.color
          ? `${nameCap} is primarily ${actualColor}.`
          : `${nameCap} has no defined color.`;
        break;
      }
      case 'generation': {
        const genName = speciesData.generation ? speciesData.generation.name : '';
        const actualRoman = generationRomanMap[genName] || '';
        const useTrue = Math.random() < 0.5;
        let roman;
        if (useTrue) {
          roman = actualRoman;
          answer = true;
        } else {
          const romans = Object.values(generationRomanMap);
          const others = romans.filter(r => r !== actualRoman);
          roman = others[Math.floor(Math.random() * others.length)];
          answer = false;
        }
        text = `${nameCap} was introduced in Generation ${roman}.`;
        explanation = actualRoman
          ? `${nameCap} was introduced in Generation ${actualRoman}.`
          : `${nameCap}'s generation is unknown.`;
        break;
      }
      case 'description': {
        // Use Pokédex flavor text for the statement. If true, we use a description of the current Pokémon.
        // If false, we choose a random other Pokémon from the species list and use its description.
        // Find English entries for the current species
        const englishEntries = speciesData.flavor_text_entries
          ? speciesData.flavor_text_entries.filter(ent => ent.language && ent.language.name === 'en')
          : [];
        // Helper to clean flavor text (remove newlines, control characters)
        const clean = s => s.replace(/\s+/g, ' ').replace(/[^\x20-\x7E]/g, '').trim();
        const useTrue = Math.random() < 0.5;
        let entryText = '';
        let actualName = nameCap;
        if (useTrue && englishEntries.length > 0) {
          // Use a random description for this Pokémon
          const entry = englishEntries[Math.floor(Math.random() * englishEntries.length)].flavor_text;
          entryText = clean(entry);
          answer = true;
        } else {
          // Pick another Pokémon species for a false description
          // Choose a random species name from the global speciesList
          const otherNames = speciesList.filter(n => n !== pokemon.name);
          const randomOther = otherNames[Math.floor(Math.random() * otherNames.length)];
          const otherSpecies = await fetchSpeciesData(randomOther);
          let otherEntries = [];
          if (otherSpecies && otherSpecies.flavor_text_entries) {
            otherEntries = otherSpecies.flavor_text_entries.filter(ent => ent.language && ent.language.name === 'en');
          }
          if (otherEntries.length > 0) {
            const entry = otherEntries[Math.floor(Math.random() * otherEntries.length)].flavor_text;
            entryText = clean(entry);
          } else if (englishEntries.length > 0) {
            // Fallback to current species entry if other has none
            const entry = englishEntries[Math.floor(Math.random() * englishEntries.length)].flavor_text;
            entryText = clean(entry);
          }
          answer = false;
        }
        text = `Pokédex entry: "${entryText}" describes ${nameCap}.`;
        explanation = answer
          ? `This entry indeed describes ${nameCap}.`
          : `This entry does not describe ${nameCap}.`;
        break;
      }
      case 'name_match': {
        // Present a statement "This is X" while showing the image of the actual Pokémon.
        // We hide the Pokémon name label for this question.
        hideName = true;
        const useTrue = Math.random() < 0.5;
        let displayName;
        if (useTrue) {
          displayName = nameCap;
          answer = true;
        } else {
          // Choose a different random species name for the false case
          const otherNames = speciesList.filter(n => n !== pokemon.name);
          const randomOther = otherNames[Math.floor(Math.random() * otherNames.length)];
          displayName = capitalize(randomOther);
          answer = false;
        }
        text = `This is ${displayName}.`;
        explanation = answer
          ? `This is ${nameCap}.`
          : `This is ${nameCap}, not ${displayName}.`;
        break;
      }
      default: {
        // Fallback to base statement using existing buildStatement
        const base = buildStatement(pokemon);
        text = base.text;
        answer = base.answer;
        explanation = base.explanation;
      }
    }
    return { text, answer, explanation, hideName };
  }

  /**
   * Prepare a single question by selecting a random Pokémon, fetching
   * its details and species data, and constructing a statement. Returns
   * an object containing the Pokémon details, statement text, answer,
   * explanation and whether to hide the Pokémon name. In case of
   * fetch failure, null is returned.
   *
   * @returns {Promise<Object|null>}
   */
  async function prepareQuestion() {
    // Pick a random species
    const randomName = speciesList[Math.floor(Math.random() * speciesList.length)];
    const pokemon = await fetchPokemonDetails(randomName);
    if (!pokemon) return null;
    let statementData;
    try {
      const speciesData = await fetchSpeciesData(pokemon.name);
      if (speciesData) {
        statementData = await buildTriviaStatement(pokemon, speciesData);
      } else {
        statementData = buildStatement(pokemon);
      }
    } catch (err) {
      console.warn('Error generating statement for preloaded question', err);
      statementData = buildStatement(pokemon);
    }
    return { pokemon, ...statementData };
  }

  /**
   * Preload the next question data in the background. This function
   * populates the global `preloadedNext` variable with the prepared
   * question so it can be consumed immediately when needed. If the
   * question cannot be prepared (e.g., due to a fetch error), the
   * preloaded data will remain null and `askNextQuestion` will
   * generate a fresh question on demand.
   */
  async function preloadNextQuestion() {
    // Only preload if there are remaining questions and no preload in progress
    if (currentQuestion < numQuestions) {
      preloadedNext = await prepareQuestion();
    } else {
      preloadedNext = null;
    }
  }

  /**
   * Reset game state and hide all screens except the start screen.
   */
  function resetGame() {
    selectedGenerations = [];
    speciesList = [];
    numQuestions = 5;
    currentQuestion = 0;
    score = 0;
    correctAnswer = true;
    correctExplanation = '';
    totalPoints = 0;
    // Show start screen and hide others
    startScreen.style.display = 'block';
    gameScreen.style.display = 'none';
    endScreen.style.display = 'none';
    feedbackEl.textContent = '';
  }

  /**
   * Start a new game. Gathers selected generations and number of
   * questions, loads species lists, and begins the question loop.
   */
  async function startGame() {
    // Determine which generation checkboxes are checked
    const checkboxes = generationSelection.querySelectorAll('input[type="checkbox"]');
    selectedGenerations = Array.from(checkboxes)
      .filter(cb => cb.checked)
      .map(cb => parseInt(cb.value, 10));
    if (selectedGenerations.length === 0) {
      alert('Please select at least one generation.');
      return;
    }
    // Parse number of questions and clamp between 1 and 99
    const inputVal = parseInt(numQuestionsInput.value, 10) || 1;
    numQuestions = Math.min(Math.max(inputVal, 1), 99);
    numQuestionsInput.value = numQuestions; // reflect clamped value
    // Aggregate species from the selected generations
    speciesList = [];
    for (const gen of selectedGenerations) {
      const species = await fetchSpeciesForGen(gen);
      speciesList = speciesList.concat(species);
    }
    if (speciesList.length === 0) {
      alert('Selected generations did not return any Pokémon species.');
      return;
    }
    // Reset counters
    currentQuestion = 0;
    score = 0;
    totalPoints = 0;
    scoreDisplayEl.textContent = `Score: 0 | Points: 0`;
    // Hide start screen, show game screen
    startScreen.style.display = 'none';
    endScreen.style.display = 'none';
    gameScreen.style.display = 'block';
    // Preload the first question and then begin. We don't await
    // preloadNextQuestion here to avoid delaying UI, but the first
    // call to askNextQuestion will generate a question if preloading
    // hasn't finished yet.
    preloadNextQuestion();
    askNextQuestion();
  }

  /**
   * Asynchronously load and present the next question. When all
   * questions have been answered, show the end screen instead.
   */
  async function askNextQuestion() {
    if (currentQuestion >= numQuestions) {
      showEndScreen();
      return;
    }
    // Update question header
    questionCountEl.textContent = `Question ${currentQuestion + 1} of ${numQuestions}`;
    // Display current number of correct answers and total points
    scoreDisplayEl.textContent = `Score: ${score} | Points: ${totalPoints}`;
    feedbackEl.textContent = '';
    // Retrieve preloaded data if available; otherwise prepare a question now
    let qData = preloadedNext;
    preloadedNext = null;
    if (!qData) {
      qData = await prepareQuestion();
    }
    // If still no data (e.g., fetch error), skip this question
    if (!qData) {
      currentQuestion++;
      askNextQuestion();
      return;
    }
    const { pokemon, text, answer, explanation, hideName } = qData;
    correctAnswer = answer;
    correctExplanation = explanation;
    // Reset answered flag so only the first click counts
    answeredThisQuestion = false;
    // Display Pokémon info and statement
    pokemonImageEl.src = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${pokemon.id}.png`;
    pokemonImageEl.alt = pokemon.name;
    // Show or hide the Pokémon name label based on statement type
    if (hideName) {
      pokemonNameEl.style.visibility = 'hidden';
    } else {
      pokemonNameEl.style.visibility = 'visible';
      pokemonNameEl.textContent = pokemon.name;
    }
    statementEl.textContent = text;
    // Enable answer buttons
    trueBtn.disabled = false;
    falseBtn.disabled = false;
    // Record display time
    questionStartTime = Date.now();
    // Begin preloading the next question in the background. We do
    // not await this promise; network requests happen concurrently
    // while the player reads the current question.
    preloadNextQuestion();
  }

  /**
   * Handle an answer click by the player. Displays feedback, updates
   * score and schedules the next question after a short delay.
   *
   * @param {boolean} choice Whether the player chose True.
   */
  function handleAnswer(choice) {
    // If the answer has already been handled for this question, ignore
    if (answeredThisQuestion) {
      return;
    }
    answeredThisQuestion = true;
    // Disable buttons to prevent multiple clicks
    trueBtn.disabled = true;
    falseBtn.disabled = true;
    // Calculate time taken to answer and award points if the answer is correct.
    // Compute the elapsed time in seconds since the question was shown.
    const now = Date.now();
    const elapsedSec = (now - questionStartTime) / 1000;
    let pointsEarned = 0;
    if (choice === correctAnswer) {
      // Increment count of correct answers
      score++;
      // Determine points based on reaction time. Players receive 1000
      // points for answering within 1 second. Points decrease linearly
      // to zero after 10 seconds. If the player takes longer than
      // 10 seconds, no points are awarded.
      if (elapsedSec <= 1) {
        pointsEarned = 1000;
      } else if (elapsedSec >= 10) {
        pointsEarned = 0;
      } else {
        // For times between 1 and 10 seconds, interpolate between
        // 1000 and 0 points. We subtract the first second and spread
        // the remaining 9 seconds evenly across 1000 points.
        pointsEarned = Math.round((1 - (elapsedSec - 1) / 9) * 1000);
      }
      totalPoints += pointsEarned;
      feedbackEl.textContent = `Correct! ${correctExplanation} (+${pointsEarned} pts)`;
      // Update scoreboard immediately to reflect the new score and points
      scoreDisplayEl.textContent = `Score: ${score} | Points: ${totalPoints}`;
    } else {
      feedbackEl.textContent = 'Wrong! ' + correctExplanation;
    }
    // Wait for two seconds before proceeding to the next question
    setTimeout(() => {
      currentQuestion++;
      askNextQuestion();
    }, 2000);
  }

  /**
   * Display the end screen with the final score and hide the game
   * screen.
   */
  function showEndScreen() {
    gameScreen.style.display = 'none';
    endScreen.style.display = 'block';
    finalMessageEl.innerHTML = `You got ${score} out of ${numQuestions} correct.<br>Total points: ${totalPoints}`;
  }

  // Event listeners
  startGameBtn.addEventListener('click', () => {
    startGame();
  });
  newGameBtn.addEventListener('click', () => {
    resetGame();
  });
  trueBtn.addEventListener('click', () => handleAnswer(true));
  falseBtn.addEventListener('click', () => handleAnswer(false));

  // Apply system or stored dark mode preference on initial load
  function applyThemeFromPreference() {
    let pref = localStorage.getItem('darkModePref');
    let dark;
    if (pref === 'true') {
      dark = true;
    } else if (pref === 'false') {
      dark = false;
    } else {
      // Default to system preference
      dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    if (dark) {
      document.body.classList.add('dark-mode');
      darkModeToggle.textContent = '☀️';
    } else {
      document.body.classList.remove('dark-mode');
      darkModeToggle.textContent = '🌙';
    }
  }

  // Dark mode toggle
  darkModeToggle.addEventListener('click', () => {
    const isDark = document.body.classList.toggle('dark-mode');
    // Persist preference to localStorage
    localStorage.setItem('darkModePref', isDark);
    darkModeToggle.textContent = isDark ? '☀️' : '🌙';
  });

  // Initialise by resetting the game state and applying theme
  resetGame();
  applyThemeFromPreference();
})();