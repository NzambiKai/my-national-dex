import { boxProgress, caughtIn } from "../model/catalog.js";
import { formatDex, locationText } from "../model/location.js";
import { isShinyMode } from "../model/mode.js";
import { spriteFileFor } from "../model/sprites.js";
import { boxHeading, homeRange, spaceLabel, spaceTileName } from "../model/spaces.js";
import { escapeHtml } from "./html.js";

function chevron(direction) {
  const points = direction === "left" ? "14 4 6 12 14 20" : "10 4 18 12 10 20";
  return `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><polyline points="${points}" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"></polyline></svg>`;
}

function caret(open) {
  const points = open ? "6 14 12 8 18 14" : "6 10 12 16 18 10";
  return `<svg class="space-caret" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><polyline points="${points}" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"></polyline></svg>`;
}

function spaceTile(box, entries, currentBoxId, mode) {
  const progress = boxProgress(entries, box.id, mode);
  const current = box.id === currentBoxId;
  const width = progress ? Math.round((progress.caught / progress.total) * 100) : 0;
  const shiny = isShinyMode(mode);
  const range = shiny ? boxHeading(box, mode) : homeRange(box);
  const count = progress ? `${progress.caught}/${progress.total}` : "";
  const tip = count ? `${range} · ${count}` : range;
  const name = spaceTileName(box, mode);
  const kind = box.group === "alt" ? "is-alt" : "";
  const aria = shiny
    ? (count ? `${boxHeading(box, mode)}, ${count} caught` : boxHeading(box, mode))
    : (box.group === "alt" ? `Alt box ${box.number}, ${tip}` : `Box ${box.number}, ${tip}`);
  return `
    <button type="button" class="space-tile${current ? " is-current" : ""}${progress ? "" : " is-pending"} ${kind}" data-box-id="${escapeHtml(box.id)}" title="${escapeHtml(tip)}" aria-current="${current ? "true" : "false"}" aria-label="${escapeHtml(aria)}">
      <span class="space-tile-num">${escapeHtml(name)}</span>
      <span class="space-tile-bar" aria-hidden="true"><span style="width:${width}%"></span></span>
    </button>
  `;
}

function spaceRuns(space, entries, currentBoxId, mode) {
  const shiny = isShinyMode(mode);
  const runs = [];
  for (const box of space.boxes) {
    const group = box.group === "standard" ? "standard" : "alt";
    const last = runs[runs.length - 1];
    if (!last || last.group !== group) runs.push({ group, boxes: [box] });
    else last.boxes.push(box);
  }
  return runs
    .map((run) => {
      const section = shiny ? "S Alt Forms" : "Alt Forms";
      const label = run.group === "alt" ? `<p class="space-alt-label">${section}</p>` : "";
      const tiles = run.boxes.map((box) => spaceTile(box, entries, currentBoxId, mode)).join("");
      const groupLabel = run.group === "alt" ? `${section} boxes` : (shiny ? "Shiny National Dex boxes" : "National Dex boxes");
      return `${label}<div class="space-grid" role="group" aria-label="${groupLabel}">${tiles}</div>`;
    })
    .join("");
}

export function renderStrip(root, catalog, { boxId, spaceIndex, open, mode = "normal" }) {
  const space = catalog.spaces[spaceIndex] ?? catalog.spaces[0];
  const atStart = spaceIndex <= 0;
  const atEnd = spaceIndex >= catalog.spaces.length - 1;
  const popover = open
    ? `<div class="space-popover" id="space-popover" role="dialog" aria-label="Box Space ${space.number} of ${space.total}">${spaceRuns(space, catalog.entries, boxId, mode)}</div>`
    : "";

  root.innerHTML = `
    <div class="space-bar-wrap">
      <div class="space-bar">
        <button type="button" class="box-nav space-nav" data-action="space-prev" aria-label="Previous Box Space" ${atStart ? "disabled" : ""}>${chevron("left")}</button>
        <button type="button" class="space-toggle" data-action="toggle-spaces" aria-expanded="${open ? "true" : "false"}" aria-controls="space-popover">
          <span class="space-kicker">Box Space ${space.number}/${space.total}</span>
          <span class="space-summary">${escapeHtml(spaceLabel(space, mode))}</span>
          ${caret(open)}
        </button>
        <button type="button" class="box-nav space-nav" data-action="space-next" aria-label="Next Box Space" ${atEnd ? "disabled" : ""}>${chevron("right")}</button>
      </div>
      ${popover}
    </div>
  `;
}

function slotButton(entry, { selected, highlighted, mode }) {
  const caught = caughtIn(entry, mode);
  const place = locationText(entry.box, entry.slot, mode);
  const classes = [
    "slot",
    caught ? "is-caught" : "is-missing",
    selected ? "is-selected" : "",
    highlighted ? "is-highlighted" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const form = entry.formName ? `<span class="slot-form">${escapeHtml(entry.formDetail || entry.formName)}</span>` : "";
  return `
    <button type="button" class="${classes}" data-mon-id="${escapeHtml(entry.id)}" aria-pressed="${selected ? "true" : "false"}" aria-label="${escapeHtml(`${entry.title}, ${formatDex(entry.nationalDex)}, ${caught ? "caught" : "missing"}, ${place}`)}">
      <span class="slot-sprite">
        <img src="${spriteFileFor(entry, mode)}" alt="" width="128" height="128" draggable="false" loading="lazy" decoding="async">
      </span>
      <span class="slot-meta">
        <span class="slot-dex">${formatDex(entry.nationalDex)}</span>
        <span class="slot-name">${escapeHtml(entry.name)}</span>
        ${form}
      </span>
    </button>
  `;
}

export function renderBox(root, { box, entries, selectedId, highlightId, mode = "normal" }) {
  const caughtCount = entries.filter((entry) => caughtIn(entry, mode)).length;
  const progress = entries.length ? `${caughtCount}/${entries.length}` : "—";
  const heading = boxHeading(box, mode);
  const header = `
    <div class="box-header">
      <button type="button" class="box-nav" data-action="prev" aria-label="Previous box">${chevron("left")}</button>
      <div class="box-heading">
        <div class="box-title-line">
          <h2 class="box-title">${escapeHtml(heading)}</h2>
          <div class="box-count" aria-label="${entries.length ? `${heading} · ${progress} caught` : "Sprites not loaded yet"}">
            <strong>${escapeHtml(progress)}</strong>
            <span>${entries.length ? "caught" : "pending"}</span>
          </div>
        </div>
        <p class="box-subtitle mb-0">${escapeHtml(box.subtitle)}</p>
      </div>
      <button type="button" class="box-nav" data-action="next" aria-label="Next box">${chevron("right")}</button>
    </div>
  `;

  if (!box.catalogued) {
    root.innerHTML = `
      <section class="card box-card">
        <div class="card-body">
          ${header}
          <div class="pending">
            <p class="eyebrow">Catalog pending</p>
            <h3>This box is reserved on the Living Dex map</h3>
            <p>${escapeHtml(box.subtitle)} is reserved in ${escapeHtml(boxHeading(box, mode))}. Sprites for this range are not loaded yet.</p>
          </div>
        </div>
      </section>
    `;
    return;
  }

  const cells = entries
    .map((entry) => slotButton(entry, {
      selected: entry.id === selectedId,
      highlighted: entry.id === highlightId,
      mode,
    }))
    .join("");

  root.innerHTML = `
    <section class="card box-card">
      <div class="card-body">
        ${header}
        <div class="box-tray">
          <div class="box-grid">${cells}</div>
        </div>
      </div>
    </section>
  `;
}
