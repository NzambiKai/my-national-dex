import { escapeHtml } from "./html.js";
import { matchesView } from "../model/catalog.js";

export function renderProgress(root, catalog, gameId = "") {
  const game = catalog.games.find((item) => item.id === gameId) ?? null;
  const pool = game ? catalog.entries.filter((entry) => entry.games.includes(game.id)) : catalog.entries;
  const total = pool.length;
  const caught = pool.filter((entry) => entry.caught).length;
  const percent = total === 0 ? 0 : Math.round((caught / total) * 100);
  const summary = game
    ? `of ${total} catchable in ${escapeHtml(game.short)} are caught`
    : `of ${total} tracked Pokémon caught`;

  root.innerHTML = `
    <div class="card progress-card">
      <div class="card-body">
        <div class="d-flex flex-wrap justify-content-between align-items-end gap-2">
          <div>
            <p class="eyebrow mb-1">${game ? "Catchable on Nintendo Switch" : "Living Dex progress"}</p>
            <p class="progress-count mb-0">
              <strong>${caught}</strong>
              <span>${summary}</span>
            </p>
          </div>
          <p class="progress-meta mb-0">${percent}% caught</p>
        </div>
        <div class="progress home-progress mt-3" role="progressbar" aria-valuenow="${percent}" aria-valuemin="0" aria-valuemax="100" aria-label="${game ? `Caught among Pokémon catchable in ${escapeHtml(game.short)}` : "Living Dex progress"}">
          <div class="progress-bar" style="width:${percent}%"></div>
        </div>
      </div>
    </div>
  `;
}

export function renderFilters(root, { filter, gameId = "", games, boxEntries, enabled }) {
  const counts = {
    all: boxEntries.filter((entry) => matchesView(entry, { filter: "all", gameId })).length,
    caught: boxEntries.filter((entry) => matchesView(entry, { filter: "caught", gameId })).length,
    missing: boxEntries.filter((entry) => matchesView(entry, { filter: "missing", gameId })).length,
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
        <span><i class="swatch swatch-caught"></i> Caught</span>
        <span><i class="swatch swatch-missing"></i> Missing</span>
      </div>
    </div>
  `;
}
