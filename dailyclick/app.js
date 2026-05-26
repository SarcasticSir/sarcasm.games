import { getQuizLanguage } from '/lib/client/quiz-language.js';

const STORAGE_KEY = 'daily-click-state-v2';
const CHUNK_SIZE = 30;
const MAX_DEBUG_LEVEL = 200;

const BUTTON_COLORS = [
  'linear-gradient(145deg, #ef4444, #b91c1c)',
  'linear-gradient(145deg, #f97316, #c2410c)',
  'linear-gradient(145deg, #f59e0b, #b45309)',
  'linear-gradient(145deg, #10b981, #047857)',
  'linear-gradient(145deg, #06b6d4, #0e7490)',
  'linear-gradient(145deg, #3b82f6, #1d4ed8)',
  'linear-gradient(145deg, #8b5cf6, #6d28d9)',
  'linear-gradient(145deg, #ec4899, #be185d)'
];

const I18N = {
  en: {
    title: 'Daily Click Challenge',
    reset: 'Reset progress',
    debugAdvance: 'Debug: force next day',
    debugStreak: 'Debug streak',
    progressReset: 'Progress reset to day 1.',
    invalidDebug: `Invalid value. Choose a number between 1 and ${MAX_DEBUG_LEVEL}.`,
    debugSet: (day) => `Debug: set to day ${day}.`,
    debugPrompt: `Set streak/day (1-${MAX_DEBUG_LEVEL}):`,
    statusDone: (day) => `Day ${day} is complete. Come back tomorrow for the next day.`,
    statusPlay: (day) => `Day ${day}: complete ${day} button${day > 1 ? 's' : ''}.`,
    buttonTitle: (buttonNo, remaining) => `Button ${buttonNo}: ${remaining} remaining`,
    buttonDone: (buttonNo) => `✨ BOOM! Button ${buttonNo} completed! ✨`,
    buttonRemaining: (buttonNo, remaining) => `Button ${buttonNo}: ${remaining} left.`,
    dayDone: (day) => `🎉 DAY ${day} COMPLETE! Return tomorrow! 🎉`,
    rolloverWin: (day) => `New calendar day detected. Nice! You're now on day ${day}.`,
    rolloverLose: 'New calendar day detected. Previous day was unfinished, back to day 1.',
    archiveTitle: (n, from, to) => `Open archive ${n}: day buttons ${from}-${to}`
  },
  no: {
    title: 'Daglig Klikk-utfordring',
    reset: 'Nullstill fremgang',
    debugAdvance: 'Debug: tving ny dag',
    debugStreak: 'Debug streak',
    progressReset: 'Fremgang nullstilt til dag 1.',
    invalidDebug: `Ugyldig verdi. Velg et tall mellom 1 og ${MAX_DEBUG_LEVEL}.`,
    debugSet: (day) => `Debug: satt til dag ${day}.`,
    debugPrompt: `Sett streak/dag (1-${MAX_DEBUG_LEVEL}):`,
    statusDone: (day) => `Dag ${day} er fullført. Kom tilbake i morgen for neste dag.`,
    statusPlay: (day) => `Dag ${day}: fullfør ${day} knapp${day > 1 ? 'er' : ''}.`,
    buttonTitle: (buttonNo, remaining) => `Knapp ${buttonNo}: ${remaining} igjen`,
    buttonDone: (buttonNo) => `✨ BOOM! Knapp ${buttonNo} fullført! ✨`,
    buttonRemaining: (buttonNo, remaining) => `Knapp ${buttonNo}: ${remaining} igjen.`,
    dayDone: (day) => `🎉 DAG ${day} FULLFØRT! Kom tilbake i morgen! 🎉`,
    rolloverWin: (day) => `Ny kalenderdag oppdaget. Nice! Du er nå på dag ${day}.`,
    rolloverLose: 'Ny kalenderdag oppdaget. Forrige dag var ikke fullført, tilbake til dag 1.',
    archiveTitle: (n, from, to) => `Åpne arkiv ${n}: dag-knapper ${from}-${to}`
  }
};

function t(state) { return I18N[state.language] || I18N.en; }
function getTodayStamp() { return new Date().toISOString().slice(0, 10); }

function newBaseState(language) {
  return { language, level: 1, clicks: [0], dayFinished: false, openArchiveGroup: null, lastDayStamp: getTodayStamp() };
}

function isFinished(state) {
  return Array.from({ length: state.level }, (_, i) => i + 1).every((required, i) => (state.clicks[i] ?? 0) >= required);
}

function hydrateState(language) {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return newBaseState(language);
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || !Number.isInteger(parsed.level) || parsed.level < 1 || !Array.isArray(parsed.clicks)) return newBaseState(language);
    const level = parsed.level;
    const clicks = parsed.clicks.slice(0, level);
    while (clicks.length < level) clicks.push(0);
    return {
      language,
      level,
      clicks,
      dayFinished: isFinished({ level, clicks }),
      openArchiveGroup: null,
      lastDayStamp: typeof parsed.lastDayStamp === 'string' ? parsed.lastDayStamp : getTodayStamp()
    };
  } catch {
    return newBaseState(language);
  }
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ level: state.level, clicks: state.clicks, lastDayStamp: state.lastDayStamp }));
}
function setMessage(text) { document.getElementById('message').textContent = text; }
function buttonColor(index) { return BUTTON_COLORS[index % BUTTON_COLORS.length]; }

function startNewCalendarDay(state) {
  const texts = t(state);
  if (isFinished(state)) {
    state.level += 1;
    state.clicks = Array.from({ length: state.level }, () => 0);
    setMessage(texts.rolloverWin(state.level));
  } else {
    state.level = 1;
    state.clicks = [0];
    setMessage(texts.rolloverLose);
  }
  state.dayFinished = false;
  state.openArchiveGroup = null;
}

function applyDailyRollover(state) {
  const today = getTodayStamp();
  if (state.lastDayStamp !== today) {
    startNewCalendarDay(state);
    state.lastDayStamp = today;
    saveState(state);
  }
}

function createGameButton(state, index) {
  const texts = t(state);
  const requiredClicks = index + 1;
  const currentClicks = state.clicks[index] ?? 0;
  const remaining = Math.max(requiredClicks - currentClicks, 0);
  const button = document.createElement('button');
  button.className = 'daily-button';
  button.style.background = buttonColor(index);
  button.disabled = state.dayFinished || remaining === 0;
  button.textContent = `${remaining}`;
  button.title = texts.buttonTitle(requiredClicks, remaining);
  button.addEventListener('click', () => {
    if (state.dayFinished || (state.clicks[index] ?? 0) >= requiredClicks) return;
    state.clicks[index] += 1;
    const left = Math.max(requiredClicks - state.clicks[index], 0);
    setMessage(left === 0 ? texts.buttonDone(requiredClicks) : texts.buttonRemaining(requiredClicks, left));
    state.dayFinished = isFinished(state);
    if (state.dayFinished) setMessage(texts.dayDone(state.level));
    saveState(state);
    render(state);
  });
  return button;
}

function renderArchiveStars(state, container) {
  const fullGroupsBeforeCurrent = Math.floor((state.level - 1) / CHUNK_SIZE);
  if (fullGroupsBeforeCurrent <= 0) return;

  const starsRow = document.createElement('div');
  starsRow.className = 'stars-row';

  for (let group = 0; group < fullGroupsBeforeCurrent; group += 1) {
    const from = group * CHUNK_SIZE + 1;
    const to = (group + 1) * CHUNK_SIZE;
    const star = document.createElement('button');
    star.className = `archive-button ${state.openArchiveGroup === group ? 'active' : ''}`;
    star.textContent = `⭐${group + 1}`;
    star.title = t(state).archiveTitle(group + 1, from, to);
    star.addEventListener('click', () => {
      state.openArchiveGroup = state.openArchiveGroup === group ? null : group;
      render(state);
    });
    starsRow.appendChild(star);
  }

  container.appendChild(starsRow);

  if (state.openArchiveGroup !== null) {
    const archiveGrid = document.createElement('div');
    archiveGrid.className = 'archive-grid';
    const start = state.openArchiveGroup * CHUNK_SIZE;
    const end = start + CHUNK_SIZE;
    for (let i = start; i < end; i += 1) {
      archiveGrid.appendChild(createGameButton(state, i));
    }
    container.appendChild(archiveGrid);
  }
}

function render(state) {
  const texts = t(state);
  document.documentElement.lang = state.language === 'no' ? 'no' : 'en';
  document.getElementById('title').textContent = texts.title;
  document.getElementById('reset').textContent = texts.reset;
  document.getElementById('new-day').textContent = texts.debugAdvance;
  document.getElementById('debug-streak').textContent = texts.debugStreak;

  state.dayFinished = isFinished(state);
  document.getElementById('status').textContent = state.dayFinished ? texts.statusDone(state.level) : texts.statusPlay(state.level);

  const buttonsContainer = document.getElementById('buttons');
  buttonsContainer.innerHTML = '';

  const currentChunkStart = Math.floor((state.level - 1) / CHUNK_SIZE) * CHUNK_SIZE;
  const currentChunkEnd = state.level;
  const currentGrid = document.createElement('div');
  currentGrid.className = 'current-grid';
  for (let i = currentChunkStart; i < currentChunkEnd; i += 1) {
    currentGrid.appendChild(createGameButton(state, i));
  }

  renderArchiveStars(state, buttonsContainer);
  buttonsContainer.appendChild(currentGrid);
}

function main() {
  const language = getQuizLanguage();
  const state = hydrateState(language);
  applyDailyRollover(state);
  saveState(state);
  render(state);

  document.getElementById('reset').addEventListener('click', () => {
    const fresh = newBaseState(state.language);
    saveState(fresh);
    setMessage(t(state).progressReset);
    render(fresh);
  });

  document.getElementById('new-day').addEventListener('click', () => {
    startNewCalendarDay(state);
    state.lastDayStamp = getTodayStamp();
    saveState(state);
    render(state);
  });

  document.getElementById('debug-streak').addEventListener('click', () => {
    const input = prompt(t(state).debugPrompt, `${state.level}`);
    if (!input) return;
    const wanted = Number.parseInt(input, 10);
    if (!Number.isInteger(wanted) || wanted < 1 || wanted > MAX_DEBUG_LEVEL) {
      setMessage(t(state).invalidDebug);
      return;
    }
    state.level = wanted;
    state.clicks = Array.from({ length: wanted }, () => 0);
    state.dayFinished = false;
    state.openArchiveGroup = null;
    saveState(state);
    setMessage(t(state).debugSet(wanted));
    render(state);
  });
}

main();
