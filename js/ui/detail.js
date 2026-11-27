import { formatDex } from "../model/location.js";
import { escapeHtml, gamePill, spritePath, typePill } from "./html.js";

function statusBanner(entry) {
  if (entry.caught) {
    return `<p class="status-banner is-caught">In the Living Dex</p>`;
  }
  return `<p class="status-banner is-missing">Still missing</p>`;
}

function gameFocus(entry, activeGame) {
  if (!activeGame) return "";
  const inGame = entry.games.includes(activeGame.id);
  const label = inGame ? `Catchable in ${activeGame.short}` : `Not catchable in ${activeGame.short}`;
  return `<p class="game-focus${inGame ? " is-in" : " is-out"}">${escapeHtml(label)}</p>`;
}

function gamesSection(entry, activeGame) {
  const focus = gameFocus(entry, activeGame);
  if (entry.gamesResolved.length === 0) {
    return `
      <section class="detail-section">
        <h3>Catchable on Nintendo Switch</h3>
        ${focus}
        <div class="unavailable">
          <strong>Not currently catchable in any Nintendo Switch main-series game.</strong>
          ${entry.availabilityNote ? `<p>${escapeHtml(entry.availabilityNote)}</p>` : ""}
        </div>
      </section>
    `;
  }

  return `
    <section class="detail-section">
      <h3>Catchable on Nintendo Switch</h3>
      ${focus}
      <div class="game-list">${entry.gamesResolved.map(gamePill).join("")}</div>
      <p class="detail-note">Main-series Switch games only. A version that is not listed cannot be obtained in that game without a trade.</p>
      ${entry.availabilityNote ? `<p class="detail-note">${escapeHtml(entry.availabilityNote)}</p>` : ""}
    </section>
  `;
}

export function renderDetail(entry, activeGame = null) {
  if (!entry) {
    return `
      <div class="detail-empty">
        <p class="eyebrow">Pokémon detail</p>
        <h2>No Pokémon in this box yet</h2>
        <p>Sprites for this box are not loaded yet. Open a Box Space that already has artwork, or search by name or Dex number.</p>
      </div>
    `;
  }

  const form = entry.formDetail
    ? `<span class="form-chip">${escapeHtml(entry.formDetail)}</span>`
    : "";

  return `
    <article class="detail-body">
      <div class="detail-hero">
        <img src="${spritePath(entry.spriteId)}" alt="${escapeHtml(entry.title)}" width="240" height="240">
      </div>
      <p class="detail-dex">${formatDex(entry.nationalDex)}</p>
      <div class="detail-name-row">
        <h2>${escapeHtml(entry.title)}</h2>
        ${form}
      </div>
      <div class="type-row">${entry.types.map(typePill).join("")}</div>
      ${statusBanner(entry)}
      <section class="detail-section">
        <h3>Box location</h3>
        <p class="location-callout">${escapeHtml(entry.locationText)}</p>
        <button type="button" class="btn home-btn" data-action="focus-selected">Highlight this slot</button>
      </section>
      ${gamesSection(entry, activeGame)}
    </article>
  `;
}
