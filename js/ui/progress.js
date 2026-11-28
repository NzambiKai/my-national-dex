import { caughtIn } from "../model/catalog.js";
import { isShinyMode } from "../model/mode.js";

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

export function renderProgress(root, catalog, mode = "normal") {
  const shiny = isShinyMode(mode);
  const total = catalog.entries.length;
  const caught = catalog.entries.filter((entry) => caughtIn(entry, mode)).length;
  const percent = total === 0 ? 0 : Math.round((caught / total) * 100);
  const summary = shiny
    ? `of ${total} tracked shiny Pokémon caught`
    : `of ${total} tracked Pokémon caught`;
  const eyebrow = shiny ? "Shiny Living Dex progress" : "Living Dex progress";

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
        <div class="progress home-progress mt-3" role="progressbar" aria-valuenow="${percent}" aria-valuemin="0" aria-valuemax="100" aria-label="${eyebrow}">
          <div class="progress-bar" style="width:${percent}%"></div>
        </div>
      </div>
    </div>
  `;
}
