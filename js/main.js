import { entriesInBox, loadCatalog } from "./model/catalog.js";
import { searchEntries } from "./model/search.js";
import { loadPreferences, savePreferences } from "./state/store.js";
import { renderBox, renderStrip, scrollCurrentChip } from "./ui/box.js";
import { renderDetail } from "./ui/detail.js";
import { renderFilters, renderProgress } from "./ui/progress.js";
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

function closeSearch() {
  state.query = "";
  state.results = [];
  state.activeIndex = 0;
  $("#search-input").value = "";
  renderSearchResults($("#search-results"), state);
}

function paint({ scrollSlot = false, scrollChip = false } = {}) {
  const box = currentBox();
  const entries = entriesInBox(catalog.entries, box.id);
  renderProgress($("#progress-root"), catalog);
  renderFilters($("#filter-root"), state.filter, entries, box.catalogued);
  renderStrip($("#strip-root"), catalog, state.boxId);
  renderBox($("#box-root"), {
    box,
    entries,
    filter: state.filter,
    selectedId: state.selectedId,
    highlightId: state.highlightId,
  });

  const html = renderDetail(selectedEntry());
  $("#detail-desktop").innerHTML = html;
  $("#detail-offcanvas-body").innerHTML = html;
  const selected = selectedEntry();
  $("#detail-offcanvas-title").textContent = selected ? selected.title : "Pokémon";

  if (scrollChip) scrollCurrentChip($("#strip-root"));
  if (scrollSlot && state.highlightId) {
    const slot = document.querySelector(`[data-mon-id="${CSS.escape(state.highlightId)}"]`);
    slot?.scrollIntoView({ block: "center", behavior: "smooth" });
  }
}

function goToBox(boxId) {
  if (!catalog.boxes.some((box) => box.id === boxId)) return;
  state.boxId = boxId;
  state.highlightId = null;
  savePreferences({ boxId });
  paint({ scrollChip: true });
}

function stepBox(delta) {
  const ids = catalog.boxes.map((box) => box.id);
  const index = ids.indexOf(state.boxId);
  goToBox(ids[(index + delta + ids.length) % ids.length]);
}

function selectEntry(entry, { pulse = false, jump = false } = {}) {
  state.selectedId = entry.id;
  state.boxId = entry.boxId;
  if (jump) state.filter = "all";
  state.highlightId = pulse ? entry.id : state.highlightId;
  savePreferences({ boxId: state.boxId, filter: state.filter });
  closeSearch();
  paint({ scrollSlot: pulse, scrollChip: jump });
  if (!isDesktop()) {
    window.bootstrap.Offcanvas.getOrCreateInstance($("#detail-offcanvas")).show();
  } else {
    window.bootstrap.Offcanvas.getInstance($("#detail-offcanvas"))?.hide();
  }
}

function setFilter(filter) {
  state.filter = filter;
  savePreferences({ filter });
  paint();
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
      selectEntry(entry, { pulse: true, jump: true });
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
    if (entry) selectEntry(entry, { pulse: true, jump: true });
  });

  document.addEventListener("click", (event) => {
    if (!$("#search-wrap").contains(event.target)) {
      $("#search-results").hidden = true;
      $("#search-input").setAttribute("aria-expanded", "false");
    }
  });

  $("#filter-root").addEventListener("click", (event) => {
    const button = event.target.closest("[data-filter]");
    if (!button || button.disabled) return;
    setFilter(button.dataset.filter);
  });

  $("#strip-root").addEventListener("click", (event) => {
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
    if (!slot || slot.classList.contains("is-filtered")) return;
    const entry = catalog.entries.find((item) => item.id === slot.dataset.monId);
    if (entry) selectEntry(entry, { pulse: true });
  });

  for (const host of [$("#detail-desktop"), $("#detail-offcanvas")]) {
    host.addEventListener("click", (event) => {
      if (!event.target.closest("[data-action='focus-selected']")) return;
      const entry = selectedEntry();
      if (entry) selectEntry(entry, { pulse: true, jump: true });
    });
  }

  document.addEventListener("keydown", (event) => {
    const typing = document.activeElement === input || document.activeElement?.tagName === "INPUT";
    if (event.key === "/" && !typing) {
      event.preventDefault();
      input.focus();
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

async function start() {
  try {
    catalog = await loadCatalog();
  } catch (error) {
    showError(error.message);
    return;
  }

  const prefs = loadPreferences();
  const knownBox = catalog.boxes.some((box) => box.id === prefs.boxId);
  state = {
    boxId: knownBox ? prefs.boxId : "standard-01",
    filter: ["all", "caught", "missing"].includes(prefs.filter) ? prefs.filter : "all",
    selectedId: null,
    highlightId: null,
    query: "",
    results: [],
    activeIndex: 0,
  };

  bind();
  paint({ scrollChip: true });
}

start();
