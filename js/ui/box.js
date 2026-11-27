import { boxProgress } from "../model/catalog.js";
import { boxLabel, formatDex } from "../model/location.js";
import { escapeHtml, spritePath } from "./html.js";

function chevron(direction) {
  const points = direction === "left" ? "14 4 6 12 14 20" : "10 4 18 12 10 20";
  return `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><polyline points="${points}" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"></polyline></svg>`;
}

export function renderStrip(root, catalog, currentBoxId) {
  const groups = catalog.groups
    .map((group) => {
      const boxes = catalog.boxes.filter((box) => box.group === group.id);
      const chips = boxes
        .map((box) => {
          const progress = boxProgress(catalog.entries, box.id);
          const current = box.id === currentBoxId;
          const width = progress ? Math.round((progress.caught / progress.total) * 100) : 0;
          const meta = progress ? `${progress.caught}/${progress.total}` : "—";
          const label = progress
            ? `${boxLabel(box)}, ${box.title}, ${progress.caught} of ${progress.total} caught`
            : `${boxLabel(box)}, ${box.title}, ${box.rangeLabel}, not in this mockup catalog`;
          return `
            <button type="button" class="strip-chip${current ? " is-current" : ""}${progress ? "" : " is-pending"}" data-box-id="${escapeHtml(box.id)}" aria-current="${current ? "true" : "false"}" aria-label="${escapeHtml(label)}">
              <span class="strip-num">${box.group === "alt" ? `A${box.number}` : box.number}</span>
              <span class="strip-bar"><span style="width:${width}%"></span></span>
              <span class="strip-meta">${meta}</span>
            </button>
          `;
        })
        .join("");
      return `
        <div class="strip-group">
          <h2 class="strip-label">${escapeHtml(group.label)}</h2>
          <div class="strip-scroll">${chips}</div>
        </div>
      `;
    })
    .join("");

  root.innerHTML = `<div class="card strip-card"><div class="card-body">${groups}</div></div>`;
}

export function scrollCurrentChip(root) {
  const chip = root.querySelector(".strip-chip.is-current");
  const scroller = chip?.parentElement;
  if (!chip || !scroller) return;
  scroller.scrollLeft = chip.offsetLeft - scroller.clientWidth / 2 + chip.offsetWidth / 2;
}

function slotButton(entry, { selected, highlighted, filtered }) {
  const classes = [
    "slot",
    entry.caught ? "is-caught" : "is-missing",
    selected ? "is-selected" : "",
    highlighted ? "is-highlighted" : "",
    filtered ? "is-filtered" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const badge = entry.caught
    ? `<span class="caught-badge" title="Caught"><svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="M3.2 8.3 6.3 11.4 12.8 4.6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"></path></svg></span>`
    : "";
  const form = entry.formName ? `<span class="slot-form">${escapeHtml(entry.formDetail || entry.formName)}</span>` : "";
  return `
    <button type="button" class="${classes}" data-mon-id="${escapeHtml(entry.id)}" aria-pressed="${selected ? "true" : "false"}" aria-label="${escapeHtml(`${entry.title}, ${formatDex(entry.nationalDex)}, ${entry.caught ? "caught" : "missing"}, ${entry.locationText}`)}" ${filtered ? 'tabindex="-1"' : ""}>
      ${badge}
      <span class="slot-sprite">
        <img src="${spritePath(entry.spriteId)}" alt="" width="128" height="128" draggable="false">
      </span>
      <span class="slot-meta">
        <span class="slot-dex">${formatDex(entry.nationalDex)}</span>
        <span class="slot-name">${escapeHtml(entry.name)}</span>
        ${form}
      </span>
    </button>
  `;
}

export function renderBox(root, { box, entries, filter, selectedId, highlightId }) {
  const progress = entries.length
    ? `${entries.filter((entry) => entry.caught).length}/${entries.length}`
    : "—";
  const header = `
    <div class="box-header">
      <button type="button" class="box-nav" data-action="prev" aria-label="Previous box">${chevron("left")}</button>
      <div class="box-heading">
        <p class="eyebrow mb-1">${escapeHtml(boxLabel(box))} · ${escapeHtml(box.title)}</p>
        <h2 class="box-title">${escapeHtml(box.rangeLabel)}</h2>
        <p class="box-subtitle mb-0">${escapeHtml(box.subtitle)}</p>
      </div>
      <div class="box-count" aria-label="${entries.length ? `${progress} caught in this box` : "Catalog pending"}">
        <strong>${escapeHtml(progress)}</strong>
        <span>${entries.length ? "caught" : "pending"}</span>
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
            <p>${escapeHtml(box.subtitle)} will land in ${escapeHtml(boxLabel(box))} when the full National Dex is filled in. Boxes 1, 2, and 34, plus Alt Box 1, are bundled in this mockup so search, highlights, and Switch games can be tried with real artwork.</p>
          </div>
        </div>
      </section>
    `;
    return;
  }

  const cells = entries
    .map((entry) => {
      const filtered =
        (filter === "caught" && !entry.caught) || (filter === "missing" && entry.caught);
      return slotButton(entry, {
        selected: entry.id === selectedId,
        highlighted: entry.id === highlightId,
        filtered,
      });
    })
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
