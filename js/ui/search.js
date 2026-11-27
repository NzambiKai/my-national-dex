import { formatDex } from "../model/location.js";
import { escapeHtml, spritePath } from "./html.js";

export function renderSearchResults(root, { query, results, activeIndex }) {
  const trimmed = query.trim();
  if (!trimmed) {
  root.hidden = true;
  root.innerHTML = "";
  document.querySelector("#search-input")?.setAttribute("aria-expanded", "false");
  return;
}

  root.hidden = false;
  document.querySelector("#search-input")?.setAttribute("aria-expanded", "true");
  if (results.length === 0) {
    root.innerHTML = `<p class="search-empty" role="status">No Pokémon in this catalog match “${escapeHtml(trimmed)}”.</p>`;
    return;
  }

  root.innerHTML = `
    <div class="search-list" role="listbox" aria-label="Search results">
      ${results
        .map((entry, index) => {
          const active = index === activeIndex;
          return `
            <button type="button" class="search-result${active ? " is-active" : ""}" role="option" data-result-id="${escapeHtml(entry.id)}" aria-selected="${active ? "true" : "false"}">
              <img src="${spritePath(entry.spriteId)}" alt="" width="56" height="56" loading="lazy" decoding="async">
              <span class="search-copy">
                <span class="search-title">
                  <span class="search-dex">${formatDex(entry.nationalDex)}</span>
                  ${escapeHtml(entry.title)}
                  <span class="status-pill ${entry.caught ? "is-caught" : "is-missing"}">${entry.caught ? "Caught" : "Missing"}</span>
                </span>
                <span class="search-place">${escapeHtml(entry.locationText)}</span>
              </span>
            </button>
          `;
        })
        .join("")}
    </div>
  `;
}
