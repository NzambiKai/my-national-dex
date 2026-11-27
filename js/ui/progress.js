export function renderProgress(root, catalog) {
  const total = catalog.entries.length;
  const caught = catalog.entries.filter((entry) => entry.caught).length;
  const percent = total === 0 ? 0 : Math.round((caught / total) * 100);
  const catalogued = catalog.boxes.filter((box) => box.catalogued).length;

  root.innerHTML = `
    <div class="card progress-card">
      <div class="card-body">
        <div class="d-flex flex-wrap justify-content-between align-items-end gap-2">
          <div>
            <p class="eyebrow mb-1">Living Dex progress</p>
            <p class="progress-count mb-0">
              <strong>${caught}</strong>
              <span>of ${total} tracked Pokémon caught</span>
            </p>
          </div>
          <p class="progress-meta mb-0">${percent}% · ${catalogued} of ${catalog.boxes.length} boxes in this mockup</p>
        </div>
        <div class="progress home-progress mt-3" role="progressbar" aria-valuenow="${percent}" aria-valuemin="0" aria-valuemax="100" aria-label="Living Dex progress">
          <div class="progress-bar" style="width:${percent}%"></div>
        </div>
      </div>
    </div>
  `;
}

export function renderFilters(root, filter, boxEntries, enabled) {
  const counts = {
    all: boxEntries.length,
    caught: boxEntries.filter((entry) => entry.caught).length,
    missing: boxEntries.filter((entry) => !entry.caught).length,
  };
  const options = [
    ["all", "All"],
    ["caught", "Caught"],
    ["missing", "Missing"],
  ];

  root.innerHTML = `
    <div class="filter-bar">
      <div class="filter-group" role="group" aria-label="Show Pokémon">
        ${options
          .map(([id, label]) => {
            const pressed = filter === id;
            return `<button type="button" class="btn filter-btn${pressed ? " is-active" : ""}" data-filter="${id}" aria-pressed="${pressed}" ${enabled ? "" : "disabled"}>${label} <span class="filter-count">${counts[id]}</span></button>`;
          })
          .join("")}
      </div>
      <div class="legend" aria-hidden="true">
        <span><i class="swatch swatch-caught"></i> Caught</span>
        <span><i class="swatch swatch-missing"></i> Missing</span>
      </div>
    </div>
  `;
}
