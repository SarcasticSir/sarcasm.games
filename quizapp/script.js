// Quiz game logic for the General Knowledge Quiz.
// Questions and answers are loaded from a text file in the following format:
// question|category|answer1|answer2|answer3
// Players can select categories and the number of questions to play. Answers
// are case‑insensitive and ignore whitespace. A response is considered
// correct if it matches any of the provided answers with an edit distance
// of at most 1. Points are awarded based on how quickly the player answers
// correctly (1000 points if answered within 5 seconds, decreasing linearly
// to 0 points after 20 seconds).

(function () {
  // DOM references
  const startScreen = document.getElementById('startScreen');
  const categorySelection = document.getElementById('categorySelection');
  const numQuestionsInput = document.getElementById('numQuestions');
  const startGameBtn = document.getElementById('startGameBtn');
  const gameScreen = document.getElementById('gameScreen');
  const endScreen = document.getElementById('endScreen');
  const questionCountEl = document.getElementById('questionCount');
  const scoreDisplayEl = document.getElementById('scoreDisplay');
  const questionTextEl = document.getElementById('questionText');
  const answerInput = document.getElementById('answerInput');
  const submitAnswerBtn = document.getElementById('submitAnswerBtn');
  const feedbackEl = document.getElementById('feedback');
  const finalMessageEl = document.getElementById('finalMessage');
  const newGameBtn = document.getElementById('newGameBtn');
  const darkModeToggle = document.getElementById('darkModeToggle');

  // Game state
  let questions = []; // Array of {question, category, answers: []}
  let selectedCategories = [];
  let selectedQuestions = [];
  let currentIndex = 0;
  let correctCount = 0;
  let totalPoints = 0;
  let questionStartTime = 0;
  let answeredFlag = false;

  // Default questions file path
  const DEFAULT_FILE = 'questions.txt';
  // Fallback default questions data used if loading the file fails. Ensure
  // the format matches question|category|answer1|answer2|answer3 per line.
  const DEFAULT_DATA =
    'Who was the drummer for the Beatles?|Music|Ringo Starr|Sir Richard Starkey|\n' +
    'What is the capital of Norway?|Geography|Oslo||\n' +
    'What planet is known as the Red Planet?|Space|Mars|The Red Planet|';

  /**
   * Parse raw question text into an array of question objects.
   * Each line is expected to have format: question|category|ans1|ans2|ans3
   * Missing answers are allowed; empty strings are ignored.
   *
   * @param {string} text Raw file contents
   * @returns {Array}
   */
  function parseQuestions(text) {
    const list = [];
    const lines = text.split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const parts = trimmed.split('|');
      // Ensure at least question and category exist
      if (parts.length >= 2) {
        const q = parts[0].trim();
        const cat = parts[1].trim();
        const answers = [];
        for (let i = 2; i < parts.length; i++) {
          const ans = parts[i].trim();
          if (ans) answers.push(ans);
        }
        list.push({ question: q, category: cat, answers });
      }
    }
    return list;
  }

  /**
   * Populate the category selection area based on current questions array.
   */
  function populateCategories() {
    categorySelection.innerHTML = '';
    const cats = Array.from(new Set(questions.map(q => q.category))).sort();
    for (const cat of cats) {
      const label = document.createElement('label');
      label.className = 'cat-box';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.value = cat;
      const span = document.createElement('span');
      span.textContent = cat;
      label.appendChild(input);
      label.appendChild(span);
      categorySelection.appendChild(label);
    }
  }

  /**
   * Load questions from a file at a given URL. On success, update
   * the questions array and repopulate categories.
   *
   * @param {string} url File URL or path
   */
  async function loadQuestionsFromFile(url) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('Fetch failed');
      const text = await res.text();
      questions = parseQuestions(text);
      populateCategories();
    } catch (err) {
      console.warn('Failed to load questions file', url, err);
      // Use fallback default data
      questions = parseQuestions(DEFAULT_DATA);
      populateCategories();
    }
  }


  /**
   * Utility to sanitize a string: lowercases and removes all whitespace.
   * @param {string} str
   */
  function sanitize(str) {
    return str.toLowerCase().replace(/\s+/g, '');
  }

  /**
   * Compute Levenshtein edit distance between two strings. Uses a
   * dynamic programming algorithm with O(n*m) complexity.
   *
   * @param {string} a
   * @param {string} b
   */
  function editDistance(a, b) {
    const n = a.length;
    const m = b.length;
    if (n === 0) return m;
    if (m === 0) return n;
    const dp = [];
    for (let i = 0; i <= n; i++) {
      dp[i] = new Array(m + 1).fill(0);
      dp[i][0] = i;
    }
    for (let j = 0; j <= m; j++) {
      dp[0][j] = j;
    }
    for (let i = 1; i <= n; i++) {
      for (let j = 1; j <= m; j++) {
        if (a[i - 1] === b[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1];
        } else {
          dp[i][j] = Math.min(
            dp[i - 1][j] + 1,    // deletion
            dp[i][j - 1] + 1,    // insertion
            dp[i - 1][j - 1] + 1 // substitution
          );
        }
      }
    }
    return dp[n][m];
  }

  /**
   * Start the game based on selected categories and number of questions.
   */
  function startGame() {
    // Read selected categories
    const checkboxes = categorySelection.querySelectorAll('input[type="checkbox"]');
    selectedCategories = Array.from(checkboxes).filter(cb => cb.checked).map(cb => cb.value);
    if (selectedCategories.length === 0) {
      alert('Please select at least one category.');
      return;
    }
    // Number of questions
    let n = parseInt(numQuestionsInput.value, 10) || 1;
    n = Math.min(Math.max(n, 1), 99);
    numQuestionsInput.value = n;
    // Filter questions by category
    const filtered = questions.filter(q => selectedCategories.includes(q.category));
    if (filtered.length === 0) {
      alert('No questions available for the selected categories.');
      return;
    }
    // Shuffle array and take first n questions (or fewer if not enough)
    selectedQuestions = shuffleArray(filtered).slice(0, n);
    currentIndex = 0;
    correctCount = 0;
    totalPoints = 0;
    // Hide start, hide end, show game
    startScreen.style.display = 'none';
    endScreen.style.display = 'none';
    gameScreen.style.display = 'block';
    // Show first question
    showQuestion();
  }

  /**
   * Shuffle an array in place using Fisher–Yates algorithm.
   * @param {Array} arr
   */
  function shuffleArray(arr) {
    const array = arr.slice();
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  /**
   * Display the current question.
   */
  function showQuestion() {
    const total = selectedQuestions.length;
    const qObj = selectedQuestions[currentIndex];
    questionCountEl.textContent = `Question ${currentIndex + 1} of ${total}`;
    scoreDisplayEl.textContent = `Score: ${correctCount} | Points: ${totalPoints}`;
    questionTextEl.textContent = qObj.question;
    answerInput.value = '';
    answerInput.disabled = false;
    submitAnswerBtn.disabled = false;
    feedbackEl.textContent = '';
    answeredFlag = false;
    // Record start time
    questionStartTime = Date.now();

    // Automatically focus the answer input so the cursor is ready
    // when the question appears.
    answerInput.focus();
  }

  /**
   * Handle submission of an answer.
   */
  function submitAnswer() {
    if (answeredFlag) return;
    answeredFlag = true;
    // Disable input and button
    answerInput.disabled = true;
    submitAnswerBtn.disabled = true;
    const userRaw = answerInput.value.trim();
    // Determine if correct: sanitize input and compare with each possible answer
    const user = sanitize(userRaw);
    const answers = selectedQuestions[currentIndex].answers;
    let isCorrect = false;
    let matchedAnswer = '';
    for (const ans of answers) {
      const correct = sanitize(ans);
      const dist = editDistance(user, correct);
      if (dist <= 1) {
        isCorrect = true;
        matchedAnswer = ans;
        break;
      }
    }
    // Compute time taken
    const elapsedSec = (Date.now() - questionStartTime) / 1000;
    let pointsEarned = 0;
    if (isCorrect) {
      correctCount++;
      // Points: 1000 if <=5s, 0 if >=20s, linear in between
      if (elapsedSec <= 5) {
        pointsEarned = 1000;
      } else if (elapsedSec >= 20) {
        pointsEarned = 0;
      } else {
        pointsEarned = Math.round((1 - (elapsedSec - 5) / 15) * 1000);
      }
      totalPoints += pointsEarned;
      feedbackEl.textContent = `Correct! (+${pointsEarned} pts)`;
    } else {
      // Show one correct answer in feedback
      const correctAns = answers.length > 0 ? answers[0] : '';
      feedbackEl.textContent = `Wrong! Correct answer: ${correctAns}`;
    }
    // Update scoreboard immediately
    scoreDisplayEl.textContent = `Score: ${correctCount} | Points: ${totalPoints}`;
    // After 2 seconds, move to next or end
    setTimeout(() => {
      currentIndex++;
      if (currentIndex < selectedQuestions.length) {
        showQuestion();
      } else {
        showResults();
      }
    }, 2000);
  }

  /**
   * Display end screen with results.
   */
  function showResults() {
    gameScreen.style.display = 'none';
    endScreen.style.display = 'block';
    finalMessageEl.innerHTML = `You got ${correctCount} out of ${selectedQuestions.length} correct.<br>Total points: ${totalPoints}`;
  }

  /**
   * Reset to start screen without reloading questions.
   */
  function resetGame() {
    startScreen.style.display = 'block';
    gameScreen.style.display = 'none';
    endScreen.style.display = 'none';
    // Reset counters and selections
    currentIndex = 0;
    correctCount = 0;
    totalPoints = 0;
    answeredFlag = false;
    // Clear answer input
    answerInput.value = '';
  }

  /**
   * Apply dark or light mode based on preference stored in localStorage or
   * system setting. Also set icon accordingly.
   */
  function applyThemeFromPreference() {
    let pref = localStorage.getItem('darkModePref');
    let dark;
    if (pref === 'true') {
      dark = true;
    } else if (pref === 'false') {
      dark = false;
    } else {
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

  // Event listeners
  // No file input: questions are loaded from bundled file. Do nothing here.
  startGameBtn.addEventListener('click', startGame);
  submitAnswerBtn.addEventListener('click', submitAnswer);
  newGameBtn.addEventListener('click', resetGame);
  darkModeToggle.addEventListener('click', () => {
    const isDark = document.body.classList.toggle('dark-mode');
    localStorage.setItem('darkModePref', isDark);
    darkModeToggle.textContent = isDark ? '☀️' : '🌙';
  });

  // Allow pressing Enter in the answer input to submit the answer
  answerInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submitAnswer();
    }
  });

  // Kick things off by loading default questions and applying theme
  loadQuestionsFromFile(DEFAULT_FILE).then(() => {
    applyThemeFromPreference();
  });
})();
