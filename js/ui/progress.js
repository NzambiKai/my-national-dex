import { caughtIn, matchesView } from "../model/catalog.js";
import { isShinyMode } from "../model/mode.js";
import { escapeHtml } from "./html.js";

function modeToggle(mode) {
  const shiny = isShinyMode(mode);
  const sparkle = `<svg class="mode-sparkle" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path fill="currentColor" d="M8 1.1 9.2 6.1 14.2 8 9.2 9.9 8 14.9 6.8 9.9 1.8 8 6.8 6.1Z"></path></svg>`;
  return `
    <div class="mode-toggle" role="group" aria-label="Living Dex mode">
      <button type="button" class="mode-btn${shiny ? "" : " is-active"}" data-mode="normal" aria-pressed="${shiny ? "false" : "true"}">Normal</button>
      <button type="button" class="mode-btn${shiny ? " is-active" : ""}" data-mode="shiny" aria-pressed="${shiny ? "true" : "false"}">${sparkle} Shiny</button>
    </div>
  `;
}

export function renderProgress(root, catalog, { gameId = "", mode = "normal" } = {}) {
  const shiny = isShinyMode(mode);
  const game = catalog.games.find((item) => item.id === gameId) ?? null;
  const pool = game ? catalog.entries.filter((entry) => entry.games.includes(game.id)) : catalog.entries;
  const total = pool.length;
  const caught = pool.filter((entry) => caughtIn(entry, mode)).length;
  const percent = total === 0 ? 0 : Math.round((caught / total) * 100);
  const summary = game
    ? `of ${total} catchable in ${escapeHtml(game.short)} are caught`
    : shiny
      ? `of ${total} tracked shiny Pokémon caught`
      : `of ${total} tracked Pokémon caught`;
  const eyebrow = game
    ? (shiny ? "Shiny Living Dex · Nintendo Switch" : "Catchable on Nintendo Switch")
    : (shiny ? "Shiny Living Dex progress" : "Living Dex progress");
  const barLabel = game
    ? `Caught among Pokémon catchable in ${game.short}`
    : (shiny ? "Shiny Living Dex progress" : "Living Dex progress");

  root.innerHTML = `
    <div class="card progress-card">
      <div class="card-body">
        <div class="d-flex flex-wrap justify-content-between align-items-end gap-2">
          <div>
            <p class="eyebrow mb-1">${eyebrow}</p>
            <p class="progress-count mb-0">
              <strong>${caught}</strong>
              <span>${summary}</span>
            </p>
          </div>
          <div class="progress-tools">
            ${modeToggle(mode)}
            <p class="progress-meta mb-0">${percent}% caught</p>
          </div>
        </div>
        <div class="progress home-progress mt-3" role="progressbar" aria-valuenow="${percent}" aria-valuemin="0" aria-valuemax="100" aria-label="${escapeHtml(barLabel)}">
          <div class="progress-bar" style="width:${percent}%"></div>
        </div>
      </div>
    </div>
  `;
}

export function renderFilters(root, { filter, gameId = "", games, boxEntries, enabled, mode = "normal" }) {
  const view = { gameId, mode };
  const counts = {
    all: boxEntries.filter((entry) => matchesView(entry, { filter: "all", ...view })).length,
    caught: boxEntries.filter((entry) => matchesView(entry, { filter: "caught", ...view })).length,
    missing: boxEntries.filter((entry) => matchesView(entry, { filter: "missing", ...view })).length,
  };
  const options = [
    ["all", "All"],
    ["caught", "Caught"],
    ["missing", "Missing"],
  ];
  const activeGame = games.find((game) => game.id === gameId) ?? null;
  const gameLabel = activeGame ? activeGame.short : "Any Switch game";
  const gameItems = [
    `<li><button type="button" class="dropdown-item${activeGame ? "" : " is-active"}" data-game-id="">Any Switch game</button></li>`,
    ...games.map((game) => {
      const active = game.id === gameId;
      return `<li><button type="button" class="dropdown-item${active ? " is-active" : ""}" data-game-id="${escapeHtml(game.id)}"><span class="game-dot" style="background:${escapeHtml(game.color)}"></span>${escapeHtml(game.short)}</button></li>`;
    }),
  ].join("");

  root.innerHTML = `
    <div class="filter-bar">
      <div class="filter-group" role="group" aria-label="Show Pokémon">
        ${options
          .map(([id, label]) => {
            const pressed = filter === id;
            return `<button type="button" class="btn filter-btn${pressed ? " is-active" : ""}" data-filter="${id}" aria-pressed="${pressed}" ${enabled ? "" : "disabled"}>${label} <span class="filter-count">${counts[id]}</span></button>`;
          })
          .join("")}
        <div class="dropdown game-filter">
          <button type="button" class="btn game-filter-btn dropdown-toggle${activeGame ? " is-set" : ""}" data-bs-toggle="dropdown" aria-expanded="false" aria-label="Filter by Nintendo Switch game, ${escapeHtml(gameLabel)}">
            <span class="game-dot" style="background:${activeGame ? escapeHtml(activeGame.color) : "#12b5a8"}"></span>
            ${escapeHtml(gameLabel)}
          </button>
          <ul class="dropdown-menu game-menu">${gameItems}</ul>
        </div>
      </div>
      <div class="legend" aria-hidden="true">
        <span><i class="swatch swatch-caught"></i> ${isShinyMode(mode) ? "Shiny caught" : "Caught"}</span>
        <span><i class="swatch swatch-missing"></i> Missing</span>
      </div>
    </div>
  `;
}
