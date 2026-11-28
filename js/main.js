import { entriesInBox, loadCatalog } from "./model/catalog.js";
import { normalizeMode, isShinyMode } from "./model/mode.js";
import { spaceIndexForBox } from "./model/spaces.js";
import { searchEntries } from "./model/search.js";
import { loadPreferences, savePreferences } from "./state/store.js";
import { renderBox, renderStrip } from "./ui/box.js";
import { renderDetail } from "./ui/detail.js";
import { renderProgress } from "./ui/progress.js";
import { renderSearchResults } from "./ui/search.js";

const $ = (selector) => document.querySelector(selector);

const desktopQuery = window.matchMedia("(min-width: 1200px)");
let catalog;
let state;

function isDesktop() {
  return desktopQuery.matches;
}

function selectedEntry() {
  return catalog.entries.find((entry) => entry.id === state.selectedId) ?? null;
}

function currentBox() {
  return catalog.boxes.find((box) => box.id === state.boxId) ?? catalog.boxes[0];
}

function remember() {
  savePreferences({
    boxId: state.boxId,
    selectedId: state.selectedId,
    mode: state.mode,
  });
}

function applyModeClass() {
  document.body.classList.toggle("is-shiny-mode", isShinyMode(state.mode));
}

function viewedSpaceIndex() {
  if (Number.isInteger(state.spaceCursor)) return state.spaceCursor;
  return spaceIndexForBox(catalog.spaces, state.boxId);
}

function closeSearch() {
  state.query = "";
  state.results = [];
  state.activeIndex = 0;
  $("#search-input").value = "";
  renderSearchResults($("#search-results"), state);
}

function paint({ scrollSlot = false } = {}) {
  const restoreAction = document.activeElement?.dataset?.action;
  const box = currentBox();
  const entries = entriesInBox(catalog.entries, box.id);
  renderProgress($("#progress-root"), catalog, state.mode);
  renderStrip($("#strip-root"), catalog, {
    boxId: state.boxId,
    spaceIndex: viewedSpaceIndex(),
    open: state.spaceOpen,
    mode: state.mode,
  });
  renderBox($("#box-root"), {
    box,
    entries,
    selectedId: state.selectedId,
    highlightId: state.highlightId,
    mode: state.mode,
  });

  const html = renderDetail(selectedEntry(), state.mode);
  $("#detail-desktop").innerHTML = html;
  $("#detail-offcanvas-body").innerHTML = html;
  const selected = selectedEntry();
  $("#detail-offcanvas-title").textContent = selected ? selected.title : "Pokémon";

  if (restoreAction && ["space-prev", "space-next", "toggle-spaces"].includes(restoreAction)) {
    $("#strip-root").querySelector(`[data-action="${restoreAction}"]`)?.focus();
  }
  if (scrollSlot && state.highlightId) {
    const slot = document.querySelector(`[data-mon-id="${CSS.escape(state.highlightId)}"]`);
    slot?.scrollIntoView({ block: "center", behavior: "smooth" });
  }
}

function goToBox(boxId) {
  const box = catalog.boxes.find((item) => item.id === boxId);
  if (!box) return;
  const entries = entriesInBox(catalog.entries, boxId);
  const keepSelection = entries.some((entry) => entry.id === state.selectedId);
  state.boxId = boxId;
  state.highlightId = null;
  state.selectedId = keepSelection ? state.selectedId : (entries[0]?.id ?? null);
  state.spaceOpen = false;
  state.spaceCursor = null;
  remember();
  paint();
}

function stepBox(delta) {
  const ids = catalog.boxes.map((box) => box.id);
  const index = ids.indexOf(state.boxId);
  goToBox(ids[(index + delta + ids.length) % ids.length]);
}

function stepSpace(delta) {
  const next = viewedSpaceIndex() + delta;
  if (next < 0 || next >= catalog.spaces.length) return;
  state.spaceCursor = next;
  state.spaceOpen = true;
  paint();
}

function toggleSpaces() {
  state.spaceOpen = !state.spaceOpen;
  if (!state.spaceOpen) state.spaceCursor = null;
  paint();
}

function selectEntry(entry, { pulse = false } = {}) {
  state.selectedId = entry.id;
  state.boxId = entry.boxId;
  state.highlightId = pulse ? entry.id : state.highlightId;
  state.spaceOpen = false;
  state.spaceCursor = null;
  remember();
  closeSearch();
  paint({ scrollSlot: pulse });
  if (!isDesktop()) {
    window.bootstrap.Offcanvas.getOrCreateInstance($("#detail-offcanvas")).show();
  } else {
    window.bootstrap.Offcanvas.getInstance($("#detail-offcanvas"))?.hide();
  }
}

function setMode(mode) {
  const next = normalizeMode(mode);
  if (next === state.mode) return;
  state.mode = next;
  applyModeClass();
  remember();
  if (state.query.trim()) refreshSearch();
  paint();
  document.querySelector(`.mode-btn[data-mode="${state.mode}"]`)?.focus();
}

function refreshSearch() {
  state.results = searchEntries(catalog.entries, state.query);
  if (state.activeIndex >= state.results.length) state.activeIndex = 0;
  renderSearchResults($("#search-results"), state);
}

function bind() {
  const input = $("#search-input");

  input.addEventListener("input", () => {
    state.query = input.value;
    state.activeIndex = 0;
    refreshSearch();
  });

  input.addEventListener("focus", () => {
    if (state.query.trim()) refreshSearch();
  });

  input.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (state.results.length === 0) return;
      event.preventDefault();
      const delta = event.key === "ArrowDown" ? 1 : -1;
      state.activeIndex = (state.activeIndex + delta + state.results.length) % state.results.length;
      renderSearchResults($("#search-results"), state);
      return;
    }
    if (event.key === "Enter") {
      const entry = state.results[state.activeIndex] ?? state.results[0];
      if (!entry) return;
      event.preventDefault();
      selectEntry(entry, { pulse: true });
      return;
    }
    if (event.key === "Escape") {
      closeSearch();
      input.blur();
    }
  });

  $("#search-results").addEventListener("mousedown", (event) => {
    const button = event.target.closest("[data-result-id]");
    if (!button) return;
    event.preventDefault();
    const entry = catalog.entries.find((item) => item.id === button.dataset.resultId);
    if (entry) selectEntry(entry, { pulse: true });
  });

  document.addEventListener("click", (event) => {
    if (!$("#search-wrap").contains(event.target)) {
      $("#search-results").hidden = true;
      $("#search-input").setAttribute("aria-expanded", "false");
    }
    if (state.spaceOpen && !event.composedPath().includes($("#strip-root"))) {
      state.spaceOpen = false;
      state.spaceCursor = null;
      paint();
    }
  });

  $("#progress-root").addEventListener("click", (event) => {
    const button = event.target.closest("[data-mode]");
    if (!button) return;
    setMode(button.dataset.mode);
  });

  $("#strip-root").addEventListener("click", (event) => {
    if (event.target.closest("[data-action='space-prev']")) {
      stepSpace(-1);
      return;
    }
    if (event.target.closest("[data-action='space-next']")) {
      stepSpace(1);
      return;
    }
    if (event.target.closest("[data-action='toggle-spaces']")) {
      toggleSpaces();
      return;
    }
    const button = event.target.closest("[data-box-id]");
    if (button) goToBox(button.dataset.boxId);
  });

  $("#box-root").addEventListener("click", (event) => {
    if (event.target.closest("[data-action='prev']")) {
      stepBox(-1);
      return;
    }
    if (event.target.closest("[data-action='next']")) {
      stepBox(1);
      return;
    }
    const slot = event.target.closest("[data-mon-id]");
    if (!slot) return;
    const entry = catalog.entries.find((item) => item.id === slot.dataset.monId);
    if (entry) selectEntry(entry, { pulse: true });
  });

  for (const host of [$("#detail-desktop"), $("#detail-offcanvas")]) {
    host.addEventListener("click", (event) => {
      if (!event.target.closest("[data-action='focus-selected']")) return;
      const entry = selectedEntry();
      if (entry) selectEntry(entry, { pulse: true });
    });
  }

  document.addEventListener("keydown", (event) => {
    const typing = document.activeElement === input || document.activeElement?.tagName === "INPUT";
    if (event.key === "/" && !typing) {
      event.preventDefault();
      input.focus();
      return;
    }
    if (event.key === "Escape" && state.spaceOpen) {
      state.spaceOpen = false;
      state.spaceCursor = null;
      paint();
      return;
    }
    if (typing || event.altKey || event.metaKey || event.ctrlKey) return;
    const tag = document.activeElement?.tagName;
    if (tag === "BUTTON" || tag === "A" || tag === "TEXTAREA" || tag === "SELECT") return;
    if (event.key === "ArrowLeft") stepBox(-1);
    if (event.key === "ArrowRight") stepBox(1);
  });

  desktopQuery.addEventListener("change", () => {
    if (isDesktop()) {
      window.bootstrap.Offcanvas.getInstance($("#detail-offcanvas"))?.hide();
    }
  });
}

function showError(message) {
  const error = $("#app-error");
  error.hidden = false;
  error.textContent = message;
}

function initialView(prefs) {
  const saved = catalog.entries.find((entry) => entry.id === prefs.selectedId);
  if (saved) return { boxId: saved.boxId, selectedId: saved.id };
  const knownBox = catalog.boxes.some((box) => box.id === prefs.boxId);
  const boxId = knownBox ? prefs.boxId : "standard-01";
  return { boxId, selectedId: entriesInBox(catalog.entries, boxId)[0]?.id ?? null };
}

async function start() {
  try {
    catalog = await loadCatalog();
  } catch (error) {
    showError(error.message);
    return;
  }

  const prefs = loadPreferences();
  const view = initialView(prefs);
  state = {
    boxId: view.boxId,
    selectedId: view.selectedId,
    mode: normalizeMode(prefs.mode),
    spaceOpen: false,
    spaceCursor: null,
    highlightId: null,
    query: "",
    results: [],
    activeIndex: 0,
  };
  applyModeClass();
  remember();

  bind();
  paint();
}

start();
