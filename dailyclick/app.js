const STORAGE_KEY = "daily-click-state";
const MAX_VISIBLE_BUTTONS = 30;

const BUTTON_COLORS = [
  "linear-gradient(145deg, #ef4444, #b91c1c)",
  "linear-gradient(145deg, #f97316, #c2410c)",
  "linear-gradient(145deg, #f59e0b, #b45309)",
  "linear-gradient(145deg, #10b981, #047857)",
  "linear-gradient(145deg, #06b6d4, #0e7490)",
  "linear-gradient(145deg, #3b82f6, #1d4ed8)",
  "linear-gradient(145deg, #8b5cf6, #6d28d9)",
  "linear-gradient(145deg, #ec4899, #be185d)",
];

function newBaseState() {
  return { level: 1, clicks: [0], dayFinished: false, showArchive: false };
}

function isFinished(state) {
  return Array.from({ length: state.level }, (_, i) => i + 1).every((required, i) => (state.clicks[i] ?? 0) >= required);
}

function hydrateState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return newBaseState();

  try {
    const state = JSON.parse(raw);
    if (!state || !Number.isInteger(state.level) || state.level < 1 || !Array.isArray(state.clicks)) return newBaseState();
    const level = state.level;
    const clicks = state.clicks.slice(0, level);
    while (clicks.length < level) clicks.push(0);
    return { level, clicks, dayFinished: isFinished({ level, clicks }), showArchive: false };
  } catch {
    return newBaseState();
  }
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ level: state.level, clicks: state.clicks }));
}

function setMessage(text) {
  document.getElementById("message").textContent = text;
}

function buttonColor(index) {
  return BUTTON_COLORS[index % BUTTON_COLORS.length];
}

function startNewDay(state) {
  if (isFinished(state)) {
    const nextLevel = state.level + 1;
    state.level = nextLevel;
    state.clicks = Array.from({ length: nextLevel }, () => 0);
    setMessage(`Ny dag startet! Nå er du på dag ${nextLevel}.`);
  } else {
    state.level = 1;
    state.clicks = [0];
    setMessage("Du fullførte ikke alt. Tilbake til dag 1.");
  }
  state.dayFinished = false;
  state.showArchive = false;
  saveState(state);
  render(state);
}

function createGameButton(state, index) {
  const requiredClicks = index + 1;
  const currentClicks = state.clicks[index] ?? 0;
  const remaining = Math.max(requiredClicks - currentClicks, 0);

  const button = document.createElement("button");
  button.className = "daily-button";
  button.style.background = buttonColor(index);
  button.disabled = state.dayFinished || remaining === 0;
  button.textContent = `${remaining}`;
  button.title = `Button ${requiredClicks}: ${remaining} remaining`;

  button.addEventListener("click", () => {
    if (state.dayFinished || (state.clicks[index] ?? 0) >= requiredClicks) return;

    state.clicks[index] += 1;
    const remainingAfterClick = Math.max(requiredClicks - state.clicks[index], 0);

    if (remainingAfterClick === 0) {
      setMessage(`✨ BOOM! Knapp ${requiredClicks} fullført! ✨`);
    } else {
      setMessage(`Knapp ${requiredClicks}: ${remainingAfterClick} igjen.`);
    }

    state.dayFinished = isFinished(state);
    if (state.dayFinished) {
      setMessage(`🎉 DAG ${state.level} FULLFØRT! Trykk "Start ny dag"! 🎉`);
    }

    saveState(state);
    render(state);
  });

  return button;
}

function render(state) {
  const status = document.getElementById("status");
  const buttonsContainer = document.getElementById("buttons");

  state.dayFinished = isFinished(state);
  status.textContent = state.dayFinished
    ? `Dag ${state.level} er fullført. Start ny dag for å fortsette.`
    : `Dag ${state.level}: fullfør ${state.level} knapp${state.level > 1 ? "er" : ""}.`;

  buttonsContainer.innerHTML = "";

  if (state.level <= MAX_VISIBLE_BUTTONS) {
    for (let i = 0; i < state.level; i += 1) {
      buttonsContainer.appendChild(createGameButton(state, i));
    }
  } else {
    const topRow = document.createElement("div");
    topRow.className = "overflow-row";

    const archiveButton = document.createElement("button");
    archiveButton.className = "archive-button";
    archiveButton.textContent = "⭐";
    archiveButton.title = "Vis/skjul de første 30 knappene";
    archiveButton.addEventListener("click", () => {
      state.showArchive = !state.showArchive;
      render(state);
    });

    topRow.appendChild(archiveButton);
    topRow.appendChild(createGameButton(state, state.level - 1));
    buttonsContainer.appendChild(topRow);

    if (state.showArchive) {
      const archiveGrid = document.createElement("div");
      archiveGrid.className = "archive-grid";
      for (let i = 0; i < MAX_VISIBLE_BUTTONS; i += 1) {
        archiveGrid.appendChild(createGameButton(state, i));
      }
      buttonsContainer.appendChild(archiveGrid);
    }
  }
}

function main() {
  const state = hydrateState();
  saveState(state);
  render(state);

  document.getElementById("reset").addEventListener("click", () => {
    const freshState = newBaseState();
    saveState(freshState);
    setMessage("Progress reset til dag 1.");
    render(freshState);
  });

  document.getElementById("new-day").addEventListener("click", () => startNewDay(state));

  document.getElementById("debug-streak").addEventListener("click", () => {
    const input = prompt("Sett streak/dag (1-200):", `${state.level}`);
    if (!input) return;
    const wanted = Number.parseInt(input, 10);
    if (!Number.isInteger(wanted) || wanted < 1 || wanted > 200) {
      setMessage("Ugyldig verdi. Velg et tall mellom 1 og 200.");
      return;
    }

    state.level = wanted;
    state.clicks = Array.from({ length: wanted }, () => 0);
    state.dayFinished = false;
    state.showArchive = false;
    saveState(state);
    setMessage(`Debug: satt til dag ${wanted}.`);
    render(state);
  });
}

main();
